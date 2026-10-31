import type { Schemas } from '@atria/contracts';
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
  type QueryKey,
} from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { z } from 'zod';
import { api } from '../../../shared/api/client';
import { ApiProblem } from '../../../shared/api/problem';
import { hasMessage, registerMessages } from '../../../shared/i18n/i18n';
import { pushToast } from '../../../shared/toast/toast-store';
import messages from '../i18n/pt-br.json';

// Todas as telas da feature passam por aqui; o registro é idempotente.
registerMessages('notes', messages);

const PAGE_SIZE = 20;
const PREVIEW_LENGTH = 160;

export type Note = Schemas['NoteResponse'];
export type NotePage = Schemas['NotePage'];
export type Visibility = Schemas['Visibility'];
export type NoteSort = Schemas['NoteSortParam'];
type SearchResponse = Schemas['SearchResponse'];

export const NOTE_SORTS = ['updated_at', 'created_at'] as const satisfies readonly NoteSort[];
export const NOTE_VISIBILITIES = ['personal', 'shared'] as const satisfies readonly Visibility[];

/** O que a lista mostra de cada nota; a busca só devolve título e trecho. */
export interface NoteListItem {
  id: string;
  title: string;
  preview: string;
  updated_at: string | null;
}

export interface NoteListPage {
  items: NoteListItem[];
  next_cursor: string | null;
}

export interface NoteFilters {
  visibility?: Visibility | undefined;
  sort?: NoteSort | undefined;
  q?: string | undefined;
}

/** Corpo do `PATCH /notes/{id}`: o que não vem fica como está. */
export interface NotePatch {
  title?: string;
  body?: string;
  visibility?: Visibility;
}

export interface NoteInput {
  title: string;
  body: string;
  visibility?: Visibility;
}

type NoteList = InfiniteData<NoteListPage, string | undefined>;

const optionalText = z.preprocess(
  (value) =>
    (typeof value === 'string' && value !== '') || typeof value === 'number'
      ? String(value)
      : undefined,
  z.string().optional(),
);

/** Filtros, ordem, busca e visualização da lista, como ficam na URL ([project/frontend-13]). */
export const notesSearchSchema = z.object({
  visibility: z.enum(NOTE_VISIBILITIES).optional(),
  sort: z.enum(NOTE_SORTS).default('updated_at'),
  q: optionalText,
  view: z.enum(['list', 'grid']).default('list'),
});

export type NotesSearch = z.output<typeof notesSearchSchema>;

export function searchToFilters(search: NotesSearch): NoteFilters {
  return { visibility: search.visibility, sort: search.sort, q: search.q };
}

export const noteKeys = {
  all: ['notes'] as const,
  lists: ['notes', 'list'] as const,
  list: (filters: NoteFilters) => ['notes', 'list', filters] as const,
  detail: (id: string) => ['notes', 'detail', id] as const,
};

/** Chave de tradução do aviso quando o servidor recusa uma mudança. */
export function refusalMessageKey(error: unknown): string {
  if (error instanceof ApiProblem) {
    const key = `common.errors.${error.code}`;
    if (hasMessage(key)) return key;
  }
  return 'common.errors.generic';
}

export function isNoteNotFound(error: unknown): boolean {
  return error instanceof ApiProblem && error.code === 'note_not_found';
}

/** Começo do texto, em uma linha só, para a lista. */
export function notePreview(body: string): string {
  const flat = body.replace(/\s+/g, ' ').trim();
  return flat.length > PREVIEW_LENGTH ? `${flat.slice(0, PREVIEW_LENGTH).trimEnd()}…` : flat;
}

function toListItem(note: Note): NoteListItem {
  return {
    id: note.id,
    title: note.title,
    preview: notePreview(note.body),
    updated_at: note.updated_at,
  };
}

async function fetchPage(
  filters: NoteFilters,
  cursor: string | undefined,
  signal: AbortSignal,
): Promise<NoteListPage> {
  // O conteúdo das notas é criptografado: com texto, a busca é a do servidor, em memória
  // (decisão 13). Ela não filtra por visibilidade nem ordena, e vem inteira, sem cursor.
  if (filters.q !== undefined) {
    const found = await api.get<SearchResponse>('/search', {
      query: { q: filters.q, contexts: 'notes' },
      signal,
    });
    const hits = found.groups.find((group) => group.context === 'notes')?.items ?? [];
    return {
      items: hits.map((hit) => ({
        id: hit.id,
        title: hit.title,
        preview: hit.snippet ?? '',
        updated_at: null,
      })),
      next_cursor: null,
    };
  }
  const page = await api.get<NotePage>('/notes', {
    query: {
      visibility: filters.visibility,
      sort: filters.sort,
      cursor,
      limit: PAGE_SIZE,
    },
    signal,
  });
  return { items: page.items.map(toListItem), next_cursor: page.next_cursor ?? null };
}

export function useNotes(filters: NoteFilters) {
  return useInfiniteQuery({
    queryKey: noteKeys.list(filters),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) => fetchPage(filters, pageParam, signal),
    getNextPageParam: (last) => last.next_cursor ?? undefined,
  });
}

export function useNote(id: string) {
  return useQuery({
    queryKey: noteKeys.detail(id),
    queryFn: ({ signal }) => api.get<Note>(`/notes/${encodeURIComponent(id)}`, { signal }),
    retry: (count, error) => !isNoteNotFound(error) && count < 2,
  });
}

function mapLists(client: QueryClient, change: (page: NoteListPage) => NoteListPage) {
  client.setQueriesData<NoteList>({ queryKey: noteKeys.lists }, (current) =>
    current === undefined
      ? current
      : { ...current, pages: current.pages.map((page) => change(page)) },
  );
}

/** Aplica o `PATCH` à nota que a tela já mostra, antes de o servidor responder. */
export function applyNotePatch(note: Note, patch: NotePatch, now: string): Note {
  return {
    ...note,
    ...(patch.title === undefined ? {} : { title: patch.title }),
    ...(patch.body === undefined ? {} : { body: patch.body }),
    ...(patch.visibility === undefined ? {} : { visibility: patch.visibility }),
    updated_at: now,
  };
}

interface Snapshot {
  lists: [QueryKey, NoteList | undefined][];
  detail: [QueryKey, Note | undefined] | undefined;
}

function restore(client: QueryClient, snapshot: Snapshot | undefined) {
  snapshot?.lists.forEach(([key, data]) => {
    client.setQueryData(key, data);
  });
  if (snapshot?.detail) client.setQueryData(snapshot.detail[0], snapshot.detail[1]);
}

export function useUpdateNote() {
  const client = useQueryClient();
  return useMutation<Note, Error, { id: string; patch: NotePatch }, Snapshot>({
    mutationFn: ({ id, patch }) => api.patch<Note>(`/notes/${encodeURIComponent(id)}`, patch),
    onMutate: async ({ id, patch }) => {
      await client.cancelQueries({ queryKey: noteKeys.all });
      const snapshot: Snapshot = {
        lists: client.getQueriesData<NoteList>({ queryKey: noteKeys.lists }),
        detail: [noteKeys.detail(id), client.getQueryData<Note>(noteKeys.detail(id))],
      };
      const now = new Date().toISOString();
      mapLists(client, (page) => ({
        ...page,
        items: page.items.map((item) =>
          item.id === id
            ? {
                ...item,
                ...(patch.title === undefined ? {} : { title: patch.title }),
                ...(patch.body === undefined ? {} : { preview: notePreview(patch.body) }),
                updated_at: now,
              }
            : item,
        ),
      }));
      client.setQueryData<Note>(noteKeys.detail(id), (note) =>
        note === undefined ? note : applyNotePatch(note, patch, now),
      );
      return snapshot;
    },
    onError: (error, _variables, snapshot) => {
      restore(client, snapshot);
      pushToast({ tone: 'danger', message_key: refusalMessageKey(error) });
    },
    onSettled: () => client.invalidateQueries({ queryKey: noteKeys.all }),
  });
}

/** Criar não é otimista na lista: o id vem do servidor, e a tela abre na nota criada. */
export function useCreateNote() {
  const client = useQueryClient();
  const navigate = useNavigate();
  return useMutation<Note, Error, NoteInput>({
    mutationFn: (input) => api.post<Note>('/notes', input),
    onSuccess: async (note) => {
      await client.invalidateQueries({ queryKey: noteKeys.all });
      await navigate({ to: `/notes/${note.id}` });
    },
  });
}

export function useDeleteNote() {
  const client = useQueryClient();
  const navigate = useNavigate();
  return useMutation<undefined, Error, { id: string }, Snapshot>({
    mutationFn: ({ id }) => api.delete<undefined>(`/notes/${encodeURIComponent(id)}`),
    onMutate: async ({ id }) => {
      await client.cancelQueries({ queryKey: noteKeys.lists });
      const snapshot: Snapshot = {
        lists: client.getQueriesData<NoteList>({ queryKey: noteKeys.lists }),
        detail: undefined,
      };
      mapLists(client, (page) => ({
        ...page,
        items: page.items.filter((item) => item.id !== id),
      }));
      return snapshot;
    },
    onError: (error, _variables, snapshot) => {
      restore(client, snapshot);
      pushToast({ tone: 'danger', message_key: refusalMessageKey(error) });
    },
    onSuccess: async (_data, { id }) => {
      client.removeQueries({ queryKey: noteKeys.detail(id) });
      await navigate({ to: '/notes' });
    },
    onSettled: () => client.invalidateQueries({ queryKey: noteKeys.lists }),
  });
}
