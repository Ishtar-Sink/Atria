import type { Schemas } from '@atria/contracts';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useRouterState } from '@tanstack/react-router';
import { z } from 'zod';
import { api } from '../../shared/api/client';
import { ApiProblem } from '../../shared/api/problem';
import { hasMessage, registerMessages } from '../../shared/i18n/i18n';
import { useListSearch } from '../../shared/url-state/use-list-search';
import messages from './i18n/pt-br.json';

registerMessages('library', messages);

export type Book = Schemas['BookResponse'];
export type Article = Schemas['ArticleResponse'];
export type Video = Schemas['VideoResponse'];
export type BookPage = Schemas['BookPage'];
export type ArticlePage = Schemas['ArticlePage'];
export type VideoPage = Schemas['VideoPage'];
export type BookStatus = Schemas['BookStatus'];
export type ReadingStatus = Schemas['ReadingStatus'];
export type VideoStatus = Schemas['VideoStatus'];
export type Visibility = Schemas['Visibility'];

export type LibraryKind = 'book' | 'article' | 'video';
export type LibraryTab = 'books' | 'articles' | 'videos';
export type LibraryItem = Book | Article | Video;

export const LIBRARY_TABS = ['books', 'articles', 'videos'] as const;

export const BOOK_STATUSES = ['want_to_read', 'reading', 'read'] as const;
export const ARTICLE_STATUSES = ['to_read', 'reading', 'read'] as const;
export const VIDEO_STATUSES = ['to_watch', 'watching', 'watched'] as const;

/** Os valores de status de cada aba (PD-35): o parâmetro da API também muda por tipo. */
export const TAB_STATUSES: Record<LibraryTab, readonly string[]> = {
  books: BOOK_STATUSES,
  articles: ARTICLE_STATUSES,
  videos: VIDEO_STATUSES,
};

export const TAB_KIND: Record<LibraryTab, LibraryKind> = {
  books: 'book',
  articles: 'article',
  videos: 'video',
};

export const KIND_TAB: Record<LibraryKind, LibraryTab> = {
  book: 'books',
  article: 'articles',
  video: 'videos',
};

/** Segmento da coleção na API: `/books`, `/articles` e `/videos`. */
export const KIND_PATH: Record<LibraryKind, string> = {
  book: '/books',
  article: '/articles',
  video: '/videos',
};

const PAGE_SIZE = 24;

const optionalText = z.preprocess(
  (value) =>
    (typeof value === 'string' && value !== '') || typeof value === 'number'
      ? String(value)
      : undefined,
  z.string().optional(),
);

/** Aba, status, busca, etiqueta e visualização da estante, como ficam na URL ([project/frontend-13]). */
export const librarySearchSchema = z.object({
  tab: z.enum(LIBRARY_TABS).default('books'),
  status: optionalText,
  q: optionalText,
  tag: optionalText,
  view: z.enum(['grid', 'list']).default('grid'),
});

export type LibrarySearch = z.output<typeof librarySearchSchema>;

export interface LibraryFilters {
  tab: LibraryTab;
  status?: string | undefined;
  q?: string | undefined;
  tag?: string | undefined;
}

/** O status da URL só vale se for um valor da aba aberta (PD-35). */
export function searchToFilters(search: LibrarySearch): LibraryFilters {
  const valid = search.status !== undefined && TAB_STATUSES[search.tab].includes(search.status);
  return {
    tab: search.tab,
    status: valid ? search.status : undefined,
    q: search.q,
    tag: search.tag,
  };
}

export const libraryKeys = {
  all: ['library'] as const,
  lists: ['library', 'list'] as const,
  list: (filters: LibraryFilters) => ['library', 'list', filters] as const,
  detail: (kind: LibraryKind, id: string) => ['library', 'detail', kind, id] as const,
  sessions: (book_id: string) => ['library', 'sessions', book_id] as const,
  notes: (kind: LibraryKind, id: string) => ['library', 'notes', kind, id] as const,
};

/** Chave de tradução do aviso de recusa do servidor (RNF-09). */
export function refusalMessageKey(error: unknown): string {
  if (error instanceof ApiProblem) {
    const key = `common.errors.${error.code}`;
    if (hasMessage(key)) return key;
  }
  return 'library.undo_notice';
}

/** Estado da estante na URL, com a visualização lembrada por aba (PD-24). */
export function useLibrarySearch() {
  const raw_tab = useRouterState({
    select: (state) => (state.location.search as Record<string, unknown>).tab,
  });
  const parsed = z.enum(LIBRARY_TABS).safeParse(raw_tab);
  const tab = parsed.success ? parsed.data : 'books';
  return useListSearch(librarySearchSchema, { view_key: `library:${tab}` });
}

export function statusParam(tab: LibraryTab): 'reading_status' | 'watch_status' {
  return tab === 'videos' ? 'watch_status' : 'reading_status';
}

export type LibraryPage = BookPage | ArticlePage | VideoPage;

/** Uma consulta por aba: `GET /books`, `GET /articles` ou `GET /videos` (PD-35). */
export function useLibraryItems(filters: LibraryFilters) {
  const kind = TAB_KIND[filters.tab];
  return useInfiniteQuery({
    queryKey: libraryKeys.list(filters),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) =>
      api.get<LibraryPage>(KIND_PATH[kind], {
        query: {
          q: filters.q,
          tag: filters.tag,
          [statusParam(filters.tab)]: filters.status,
          cursor: pageParam,
          limit: PAGE_SIZE,
        },
        signal,
      }),
    getNextPageParam: (last) => last.next_cursor ?? undefined,
  });
}

function itemPath(kind: LibraryKind, id: string): string {
  return `${KIND_PATH[kind]}/${encodeURIComponent(id)}`;
}

export function useArticle(id: string) {
  return useQuery({
    queryKey: libraryKeys.detail('article', id),
    queryFn: ({ signal }) => api.get<Article>(itemPath('article', id), { signal }),
  });
}

export function useVideo(id: string) {
  return useQuery({
    queryKey: libraryKeys.detail('video', id),
    queryFn: ({ signal }) => api.get<Video>(itemPath('video', id), { signal }),
  });
}

export { itemPath };
