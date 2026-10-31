import type { Schemas } from '@atria/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../shared/api/client';
import { registerMessages } from '../../shared/i18n/i18n';
import { pushToast } from '../../shared/toast/toast-store';
import messages from './i18n/pt-br.json';
import { itemPath, libraryKeys, refusalMessageKey, type LibraryKind } from './use-library-items';

registerMessages('library', messages);

export type ItemNote = Schemas['ItemNoteResponse'];
export type ItemNoteList = Schemas['ItemNoteList'];
export type ItemNoteInput = Schemas['CreateItemNoteRequest'];

const SEGMENT: Record<LibraryKind, string> = {
  book: 'book-notes',
  article: 'article-notes',
  video: 'video-notes',
};

function notesPath(kind: LibraryKind, id: string): string {
  return `${itemPath(kind, id)}/${SEGMENT[kind]}`;
}

/** Notas do item, da mais recente para a mais antiga. */
export function useItemNotes(kind: LibraryKind, id: string) {
  return useQuery({
    queryKey: libraryKeys.notes(kind, id),
    queryFn: ({ signal }) => api.get<ItemNoteList>(notesPath(kind, id), { signal }),
    select: (list) => [...list.items].sort((a, b) => b.created_at.localeCompare(a.created_at)),
  });
}

let temp_counter = 0;

/** Cria a nota na hora e desfaz com aviso se o servidor recusar (RNF-09). */
export function useCreateItemNote(kind: LibraryKind, id: string) {
  const client = useQueryClient();
  const key = libraryKeys.notes(kind, id);
  return useMutation<ItemNote, Error, ItemNoteInput, { previous: ItemNoteList | undefined }>({
    mutationFn: (input) => api.post<ItemNote>(notesPath(kind, id), input),
    onMutate: async (input) => {
      await client.cancelQueries({ queryKey: key });
      const previous = client.getQueryData<ItemNoteList>(key);
      temp_counter += 1;
      const stamp = new Date().toISOString();
      client.setQueryData<ItemNoteList>(key, {
        items: [
          ...(previous?.items ?? []),
          {
            id: `pending-${String(temp_counter)}`,
            owner_id: '',
            quote: input.quote ?? null,
            comment: input.comment ?? null,
            page: input.page ?? null,
            created_at: stamp,
            updated_at: stamp,
          },
        ],
      });
      return { previous };
    },
    onError: (error, _input, context) => {
      client.setQueryData(key, context?.previous);
      pushToast({ tone: 'danger', message_key: refusalMessageKey(error) });
    },
    onSettled: () => client.invalidateQueries({ queryKey: key }),
  });
}
