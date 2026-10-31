import type { Schemas } from '@atria/contracts';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../shared/api/client';
import { registerMessages } from '../../shared/i18n/i18n';
import messages from './i18n/pt-br.json';
import { itemPath, libraryKeys, type Book } from './use-library-items';

registerMessages('library', messages);

export type ReadingSession = Schemas['ReadingSessionResponse'];
export type ReadingSessionList = Schemas['ReadingSessionList'];

export function useBook(id: string) {
  return useQuery({
    queryKey: libraryKeys.detail('book', id),
    queryFn: ({ signal }) => api.get<Book>(itemPath('book', id), { signal }),
  });
}

function byMostRecent(a: ReadingSession, b: ReadingSession): number {
  return b.read_on.localeCompare(a.read_on) || b.created_at.localeCompare(a.created_at);
}

/** Sessões do livro, da data mais recente para a mais antiga (PD-60). */
export function useReadingSessionList(book_id: string) {
  return useQuery({
    queryKey: libraryKeys.sessions(book_id),
    queryFn: ({ signal }) =>
      api.get<ReadingSessionList>(`${itemPath('book', book_id)}/reading-sessions`, { signal }),
    select: (list) => [...list.items].sort(byMostRecent),
  });
}
