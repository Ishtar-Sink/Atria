import { vi } from 'vitest';
import { rootRoute } from '../../app/router';
import { renderWithProviders } from '../../shared/test/render';
import { createLibraryRoutes, type LibraryRoutesOptions } from './routes';
import type { ItemNote } from './use-item-notes';
import type { ReadingSession } from './use-book';
import type { Article, Book, Video } from './use-library-items';

/** API falsa em memória do Acervo, para os testes das telas: itens, sessões e notas. */

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function bookOf(overrides: Partial<Book> = {}): Book {
  return {
    id: 'b-1',
    owner_id: 'u-1',
    title: 'Dom Casmurro',
    author: 'Machado de Assis',
    publisher: 'Editora Exemplo',
    page_count: 200,
    pages_read_total: 0,
    reading_status: 'want_to_read',
    tags: [],
    visibility: 'personal',
    created_at: '2026-10-01T10:00:00Z',
    updated_at: '2026-10-02T10:00:00Z',
    ...overrides,
  };
}

export function articleOf(overrides: Partial<Article> = {}): Article {
  return {
    id: 'a-1',
    owner_id: 'u-1',
    title: 'Sobre a atenção',
    author: 'Ana Souza',
    source: 'Revista Exemplo',
    url: 'https://exemplo.test/atencao',
    reading_status: 'to_read',
    tags: [],
    visibility: 'personal',
    created_at: '2026-10-01T10:00:00Z',
    updated_at: '2026-10-02T10:00:00Z',
    ...overrides,
  };
}

export function videoOf(overrides: Partial<Video> = {}): Video {
  return {
    id: 'v-1',
    owner_id: 'u-1',
    title: 'Aula de redes',
    url: 'https://www.youtube.com/watch?v=abc',
    channel: 'Canal Exemplo',
    watch_status: 'to_watch',
    tags: [],
    visibility: 'personal',
    created_at: '2026-10-01T10:00:00Z',
    updated_at: '2026-10-02T10:00:00Z',
    ...overrides,
  };
}

export function sessionOf(overrides: Partial<ReadingSession> = {}): ReadingSession {
  return {
    id: 's-1',
    book_id: 'b-1',
    owner_id: 'u-1',
    pages_read: 25,
    read_on: '2026-10-25',
    created_at: '2026-10-25T10:00:00Z',
    updated_at: '2026-10-25T10:00:00Z',
    ...overrides,
  };
}

export interface Call {
  method: string;
  url: URL;
  body: Record<string, unknown>;
  /** Corpo cru (capa, miniatura e PDF). */
  file: File | undefined;
  content_type: string | null;
}

export interface Server {
  books: Book[];
  articles: Article[];
  videos: Video[];
  sessions: ReadingSession[];
  notes: ItemNote[];
  calls: Call[];
  mode: 'ok' | 'loading' | 'error';
  /** Resposta de erro para as chamadas que casarem (método e caminho). */
  reject: { method: string; match: RegExp; status: number; code: string }[];
}

type Collection = 'books' | 'articles' | 'videos';

/** Instala o `fetch` falso; chame `vi.unstubAllGlobals()` no fim de cada teste. */
export function stubLibraryServer(initial: Partial<Server> = {}): Server {
  const server: Server = {
    books: [],
    articles: [],
    videos: [],
    sessions: [],
    notes: [],
    calls: [],
    mode: 'ok',
    reject: [],
    ...initial,
  };
  let next_id = 1;
  const book_view = (book: Book): Book => {
    const own = server.sessions.filter((session) => session.book_id === book.id);
    if (own.length === 0 && book.pages_read_total !== 0) return book;
    const pages = own.reduce((sum, session) => sum + session.pages_read, 0);
    const percent =
      book.page_count && book.page_count > 0
        ? Math.min(100, Math.round((pages / book.page_count) * 1000) / 10)
        : undefined;
    return {
      ...book,
      pages_read_total: pages,
      ...(percent === undefined ? {} : { progress_percent: percent }),
    };
  };

  vi.stubGlobal(
    'fetch',
    vi.fn((input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(input instanceof Request ? input.url : input, 'http://localhost');
      const method = init?.method ?? 'GET';
      const headers = new Headers(init?.headers);
      const raw = init?.body instanceof File ? init.body : undefined;
      const body =
        typeof init?.body === 'string' ? (JSON.parse(init.body) as Record<string, unknown>) : {};
      if (url.pathname === '/api/v1/me')
        return Promise.resolve(json({ id: 'u-1', email: 'a@b.c' }));
      server.calls.push({
        method,
        url,
        body,
        file: raw,
        content_type: headers.get('Content-Type'),
      });
      if (server.mode === 'loading') return new Promise<Response>(() => undefined);
      if (server.mode === 'error') return Promise.resolve(json({ code: 'boom', title: 'x' }, 500));
      const refused = server.reject.find(
        (rule) => rule.method === method && rule.match.test(url.pathname),
      );
      if (refused) return Promise.resolve(json({ code: refused.code, title: 'x' }, refused.status));

      const parts = url.pathname.replace('/api/v1/', '').split('/').filter(Boolean);
      const [collection, id, section, section_id] = parts as [
        Collection,
        string | undefined,
        string | undefined,
        string | undefined,
      ];
      const items = server[collection] as { id: string }[];

      if (id === undefined) {
        if (method === 'POST') {
          const created = {
            ...(collection === 'books'
              ? bookOf()
              : collection === 'articles'
                ? articleOf()
                : videoOf()),
            id: `new-${String(next_id++)}`,
            ...body,
          };
          (items as unknown[]).push(created);
          return Promise.resolve(json(created, 201));
        }
        const status =
          url.searchParams.get('reading_status') ?? url.searchParams.get('watch_status');
        const q = url.searchParams.get('q')?.toLowerCase();
        const tag = url.searchParams.get('tag');
        const found = (items as (Book | Article | Video)[])
          .filter((item) => {
            const own_status = 'watch_status' in item ? item.watch_status : item.reading_status;
            if (status && own_status !== status) return false;
            if (tag && !item.tags.includes(tag)) return false;
            if (q && !(item.title ?? '').toLowerCase().includes(q)) return false;
            return true;
          })
          .map((item) => ('page_count' in item ? book_view(item) : item));
        return Promise.resolve(json({ items: found, next_cursor: null }));
      }

      if (section === 'reading-sessions') {
        if (section_id === undefined) {
          if (method === 'POST') {
            const created = sessionOf({
              id: `s-new-${String(next_id++)}`,
              book_id: id,
              ...(body as Partial<ReadingSession>),
            });
            server.sessions.push(created);
            return Promise.resolve(json(created, 201));
          }
          return Promise.resolve(
            json({ items: server.sessions.filter((session) => session.book_id === id) }),
          );
        }
        if (method === 'PATCH') {
          server.sessions = server.sessions.map((session) =>
            session.id === section_id ? { ...session, ...body } : session,
          );
          return Promise.resolve(
            json(server.sessions.find((session) => session.id === section_id)),
          );
        }
        server.sessions = server.sessions.filter((session) => session.id !== section_id);
        return Promise.resolve(new Response(null, { status: 204 }));
      }

      if (section?.endsWith('-notes')) {
        if (method === 'POST') {
          const created: ItemNote = {
            id: `n-${String(next_id++)}`,
            owner_id: 'u-1',
            created_at: '2026-10-26T10:00:00Z',
            updated_at: '2026-10-26T10:00:00Z',
            ...body,
          };
          server.notes.push(created);
          return Promise.resolve(json(created, 201));
        }
        return Promise.resolve(json({ items: server.notes }));
      }

      const found = (items as (Book | Article | Video)[]).find((item) => item.id === id);
      if (!found) return Promise.resolve(json({ code: 'not_found', title: 'x' }, 404));

      if (section === 'cover' || section === 'thumbnail' || section === 'pdf') {
        if (method === 'DELETE') {
          Object.assign(found, { cover_file_id: null, thumbnail_file_id: null });
          return Promise.resolve(new Response(null, { status: 204 }));
        }
        const file_id = `file-${String(next_id++)}`;
        if (section === 'pdf') Object.assign(found, { pdf_file_id: file_id });
        else if (section === 'thumbnail') Object.assign(found, { thumbnail_file_id: file_id });
        else Object.assign(found, { cover_file_id: file_id });
        return Promise.resolve(json(found));
      }
      if (method === 'DELETE') {
        (server[collection] as { id: string }[]) = items.filter((item) => item.id !== id);
        return Promise.resolve(new Response(null, { status: 204 }));
      }
      if (method === 'PATCH') {
        Object.assign(found, body);
        return Promise.resolve(json(found));
      }
      return Promise.resolve(json('page_count' in found ? book_view(found) : found));
    }),
  );
  return server;
}

/** Monta as rotas do Acervo no app de teste, na URL pedida. */
export function renderLibrary(route: string, options: LibraryRoutesOptions = {}) {
  return renderWithProviders(null, { routes: createLibraryRoutes(rootRoute, options), route });
}
