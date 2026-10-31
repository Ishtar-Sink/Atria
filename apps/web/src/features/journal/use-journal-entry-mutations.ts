import {
  useMutation,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
  type QueryKey,
} from '@tanstack/react-query';
import { api } from '../../shared/api/client';
import { pushToast } from '../../shared/toast/toast-store';
import { EMOTIONS_KEY, type EmotionList } from './use-emotions';
import {
  JOURNAL_KEY,
  type CreateJournalEntryBody,
  type JournalEntry,
  type JournalEntryPage,
  type UpdateJournalEntryBody,
} from './use-journal-entries';

type Snapshot = [QueryKey, unknown][];

const UNDO_KEY = 'journal.undo_notice';

function mapLists(client: QueryClient, change: (items: JournalEntry[]) => JournalEntry[]) {
  client.setQueriesData<InfiniteData<JournalEntryPage>>(
    { queryKey: [...JOURNAL_KEY, 'list'] },
    (data) =>
      data === undefined
        ? data
        : { ...data, pages: data.pages.map((page) => ({ ...page, items: change(page.items) })) },
  );
}

/** Lembra o nome de cada emoção da lista para montar a entrada antes da resposta. */
function entryEmotions(client: QueryClient, wanted: CreateJournalEntryBody['emotions']) {
  const list = client.getQueryData<EmotionList>(EMOTIONS_KEY)?.items ?? [];
  return wanted.map((item) => {
    const found = list.find((emotion) => emotion.id === item.emotion_id);
    return {
      emotion_id: item.emotion_id,
      intensity: item.intensity ?? null,
      name: found?.name ?? null,
      system_key: found?.system_key ?? null,
      deleted: false,
    };
  });
}

interface OptimisticOptions<TData, TVariables> {
  mutation_fn: (variables: TVariables) => Promise<TData>;
  apply: (client: QueryClient, variables: TVariables) => void;
}

/** Aplica nos caches do diário na hora e desfaz com aviso se o servidor recusar (RNF-09). */
function useJournalOptimistic<TData, TVariables>({
  mutation_fn,
  apply,
}: OptimisticOptions<TData, TVariables>) {
  const client = useQueryClient();
  return useMutation<TData, Error, TVariables, { snapshot: Snapshot }>({
    mutationFn: mutation_fn,
    onMutate: async (variables) => {
      await client.cancelQueries({ queryKey: JOURNAL_KEY });
      const snapshot = client.getQueriesData({ queryKey: JOURNAL_KEY });
      apply(client, variables);
      return { snapshot };
    },
    onError: (_error, _variables, context) => {
      context?.snapshot.forEach(([key, data]) => {
        client.setQueryData(key, data);
      });
      pushToast({ tone: 'danger', message_key: UNDO_KEY });
    },
    onSettled: () => client.invalidateQueries({ queryKey: JOURNAL_KEY }),
  });
}

export function useCreateJournalEntry() {
  return useJournalOptimistic<JournalEntry, CreateJournalEntryBody>({
    mutation_fn: (body) => api.post<JournalEntry>('/journal-entries', body),
    apply: (client, body) => {
      const now = new Date().toISOString();
      const pending: JournalEntry = {
        id: `pending-${now}`,
        owner_id: '',
        occurred_at: new Date(body.occurred_at).toISOString(),
        text: body.text,
        emotions: entryEmotions(client, body.emotions),
        visibility: body.visibility ?? 'personal',
        created_at: now,
        updated_at: now,
      };
      mapLists(client, (items) => [pending, ...items]);
    },
  });
}

export interface UpdateJournalEntryVariables {
  id: string;
  body: UpdateJournalEntryBody;
}

function applyUpdate(client: QueryClient, entry: JournalEntry, body: UpdateJournalEntryBody) {
  const next: JournalEntry = { ...entry };
  if (body.text != null) next.text = body.text;
  if (body.occurred_at != null) next.occurred_at = new Date(body.occurred_at).toISOString();
  if (body.visibility != null) next.visibility = body.visibility;
  if (body.emotions != null) next.emotions = entryEmotions(client, body.emotions);
  return next;
}

export function useUpdateJournalEntry() {
  return useJournalOptimistic<JournalEntry, UpdateJournalEntryVariables>({
    mutation_fn: ({ id, body }) => api.patch<JournalEntry>(`/journal-entries/${id}`, body),
    apply: (client, { id, body }) => {
      mapLists(client, (items) =>
        items.map((entry) => (entry.id === id ? applyUpdate(client, entry, body) : entry)),
      );
      client.setQueryData<JournalEntry>([...JOURNAL_KEY, 'detail', id], (entry) =>
        entry === undefined ? entry : applyUpdate(client, entry, body),
      );
    },
  });
}

export function useDeleteJournalEntry() {
  return useJournalOptimistic<unknown, string>({
    mutation_fn: (id) => api.delete<unknown>(`/journal-entries/${id}`),
    apply: (client, id) => {
      mapLists(client, (items) => items.filter((entry) => entry.id !== id));
    },
  });
}
