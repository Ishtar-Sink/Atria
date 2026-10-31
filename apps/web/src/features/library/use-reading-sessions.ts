import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { api } from '../../shared/api/client';
import { registerMessages } from '../../shared/i18n/i18n';
import { pushToast } from '../../shared/toast/toast-store';
import messages from './i18n/pt-br.json';
import { bookProgressPercent, sumPagesRead } from './use-book-progress';
import type { ReadingSession, ReadingSessionList } from './use-book';
import { itemPath, libraryKeys, refusalMessageKey, type Book } from './use-library-items';

registerMessages('library', messages);

/** Corpo da sessão: só páginas lidas, data e observação (PD-60, DEC-004); nunca `from_page` nem `to_page`. */
export interface SessionInput {
  pages_read: number;
  read_on: string;
  observation?: string | null;
}

interface Snapshot {
  sessions: ReadingSessionList | undefined;
  book: Book | undefined;
}

function sessionsPath(book_id: string): string {
  return `${itemPath('book', book_id)}/reading-sessions`;
}

let temp_counter = 0;

interface Config<TVariables, TData> {
  book_id: string;
  mutation_fn: (variables: TVariables) => Promise<TData>;
  apply: (items: ReadingSession[], variables: TVariables) => ReadingSession[];
  /** Depois de gravar, a tela de formulário volta ao livro. */
  go_back?: boolean;
}

/** Reflete as sessões no total lido e no progresso do livro, para a tela mudar antes do servidor (RNF-09). */
function recount(book: Book, items: readonly ReadingSession[]): Book {
  const pages = sumPagesRead(items);
  const percent = bookProgressPercent(book.page_count, pages);
  return {
    ...book,
    pages_read_total: pages,
    ...(percent === null ? {} : { progress_percent: percent }),
  };
}

function useSessionMutation<TVariables, TData>({
  book_id,
  mutation_fn,
  apply,
  go_back = false,
}: Config<TVariables, TData>) {
  const client = useQueryClient();
  const navigate = useNavigate();
  const key = libraryKeys.sessions(book_id);
  const detail_key = libraryKeys.detail('book', book_id);
  return useMutation<TData, Error, TVariables, Snapshot>({
    mutationFn: mutation_fn,
    onMutate: async (variables) => {
      await client.cancelQueries({ queryKey: libraryKeys.all });
      const snapshot: Snapshot = {
        sessions: client.getQueryData<ReadingSessionList>(key),
        book: client.getQueryData<Book>(detail_key),
      };
      if (snapshot.sessions) {
        const items = apply(snapshot.sessions.items, variables);
        client.setQueryData<ReadingSessionList>(key, { ...snapshot.sessions, items });
        client.setQueryData<Book>(detail_key, (book) => book && recount(book, items));
      }
      return snapshot;
    },
    onError: (error, _variables, snapshot) => {
      client.setQueryData(key, snapshot?.sessions);
      client.setQueryData(detail_key, snapshot?.book);
      pushToast({ tone: 'danger', message_key: refusalMessageKey(error) });
    },
    onSuccess: async () => {
      if (go_back) await navigate({ to: `/library/books/${book_id}` });
    },
    onSettled: () => client.invalidateQueries({ queryKey: libraryKeys.all }),
  });
}

export function useCreateReadingSession(book_id: string) {
  const client = useQueryClient();
  return useSessionMutation<SessionInput, ReadingSession>({
    book_id,
    go_back: true,
    mutation_fn: (input) =>
      api.post<ReadingSession>(sessionsPath(book_id), {
        pages_read: input.pages_read,
        read_on: input.read_on,
        ...(input.observation ? { observation: input.observation } : {}),
      }),
    apply: (items, input) => {
      temp_counter += 1;
      const book = client.getQueryData<Book>(libraryKeys.detail('book', book_id));
      const stamp = book?.updated_at ?? '';
      return [
        ...items,
        {
          id: `pending-${String(temp_counter)}`,
          book_id,
          owner_id: book?.owner_id ?? '',
          pages_read: input.pages_read,
          read_on: input.read_on,
          observation: input.observation ?? null,
          created_at: stamp,
          updated_at: stamp,
        },
      ];
    },
  });
}

export function useUpdateReadingSession(book_id: string) {
  return useSessionMutation<{ id: string } & SessionInput, ReadingSession>({
    book_id,
    go_back: true,
    mutation_fn: ({ id, ...input }) =>
      api.patch<ReadingSession>(`${sessionsPath(book_id)}/${encodeURIComponent(id)}`, {
        pages_read: input.pages_read,
        read_on: input.read_on,
        observation: input.observation ?? null,
      }),
    apply: (items, { id, ...input }) =>
      items.map((item) =>
        item.id === id
          ? {
              ...item,
              pages_read: input.pages_read,
              read_on: input.read_on,
              observation: input.observation ?? null,
            }
          : item,
      ),
  });
}

export function useDeleteReadingSession(book_id: string) {
  return useSessionMutation<{ id: string }, undefined>({
    book_id,
    mutation_fn: ({ id }) =>
      api.delete<undefined>(`${sessionsPath(book_id)}/${encodeURIComponent(id)}`),
    apply: (items, { id }) => items.filter((item) => item.id !== id),
  });
}
