import type { Schemas } from '@atria/contracts';
import {
  useMutation,
  useQueryClient,
  type QueryClient,
  type QueryKey,
} from '@tanstack/react-query';
import { api } from '../../shared/api/client';
import { ApiProblem } from '../../shared/api/problem';
import { hasMessage } from '../../shared/i18n/i18n';
import { pushToast } from '../../shared/toast/toast-store';
import { linkKeys, type Link } from './use-connections';
import './use-linked-titles';

type CreateLinkRequest = Schemas['CreateLinkRequest'];

type Snapshot = [QueryKey, Link[] | undefined][];

function snapshotOf(client: QueryClient): Snapshot {
  return client.getQueriesData<Link[]>({ queryKey: linkKeys.all });
}

function restore(client: QueryClient, snapshot: Snapshot | undefined) {
  snapshot?.forEach(([key, data]) => {
    client.setQueryData(key, data);
  });
}

/** Chave de tradução do aviso quando o servidor recusa a criação. */
function refusalKey(error: unknown): string {
  if (error instanceof ApiProblem) {
    const own = `connections.errors.${error.code}`;
    if (hasMessage(own)) return own;
    const common = `common.errors.${error.code}`;
    if (hasMessage(common)) return common;
  }
  return 'common.errors.generic';
}

/** Remove a ligação dos dois lados na hora; se o servidor recusar, ela volta com aviso (RNF-09). */
export function useRemoveConnection() {
  const client = useQueryClient();
  return useMutation<undefined, Error, { id: string }, Snapshot>({
    mutationFn: ({ id }) => api.delete<undefined>(`/links/${encodeURIComponent(id)}`),
    onMutate: async ({ id }) => {
      await client.cancelQueries({ queryKey: linkKeys.all });
      const snapshot = snapshotOf(client);
      snapshot.forEach(([key, data]) => {
        if (data) {
          client.setQueryData(
            key,
            data.filter((link) => link.id !== id),
          );
        }
      });
      return snapshot;
    },
    onError: (_error, _variables, snapshot) => {
      restore(client, snapshot);
      pushToast({ tone: 'danger', message_key: 'connections.undo_notice' });
    },
    onSettled: () => client.invalidateQueries({ queryKey: linkKeys.all }),
  });
}

/** Cria a ligação e já a mostra nas listas dos dois lados, antes de o servidor responder. */
export function useCreateConnection() {
  const client = useQueryClient();
  return useMutation<Link, Error, CreateLinkRequest, Snapshot>({
    mutationFn: (input) => api.post<Link>('/links', input),
    onMutate: async (input) => {
      await client.cancelQueries({ queryKey: linkKeys.all });
      const snapshot = snapshotOf(client);
      const now = new Date().toISOString();
      const sides = [
        {
          entity: [input.source_type, input.source_id],
          other: [input.target_type, input.target_id],
        },
        {
          entity: [input.target_type, input.target_id],
          other: [input.source_type, input.source_id],
        },
      ] as const;
      snapshot.forEach(([key, data]) => {
        if (!data) return;
        const side = sides.find(({ entity }) => key[2] === entity[0] && key[3] === entity[1]);
        if (!side || (key[4] !== '' && key[4] !== side.other[0])) return;
        const temp: Link = {
          id: `pending-${side.other[0]}-${side.other[1]}`,
          owner_id: '',
          source_type: input.source_type,
          source_id: input.source_id,
          target_type: input.target_type,
          target_id: input.target_id,
          linked_type: side.other[0],
          linked_id: side.other[1],
          visibility: input.visibility ?? 'personal',
          created_at: now,
          updated_at: now,
        };
        client.setQueryData(key, [temp, ...data]);
      });
      return snapshot;
    },
    onError: (error, _input, snapshot) => {
      restore(client, snapshot);
      pushToast({ tone: 'danger', message_key: refusalKey(error) });
    },
    onSettled: () => client.invalidateQueries({ queryKey: linkKeys.all }),
  });
}
