import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { api } from '../../../shared/api/client';
import { pushToast } from '../../../shared/toast/toast-store';
import { goalProgress, type Goal, type Milestone, type MilestonePage } from '../lib/goal-progress';
import { goalKeys, refusalMessageKey } from './use-goals';

function base(goal_id: string): string {
  return `/goals/${encodeURIComponent(goal_id)}/milestones`;
}

export function useMilestones(goal_id: string) {
  return useQuery({
    queryKey: goalKeys.milestones(goal_id),
    queryFn: ({ signal }) => api.get<MilestonePage>(base(goal_id), { signal }),
    select: (page) => [...page.items].sort((a, b) => a.position - b.position),
  });
}

/** Reflete os marcos nos números da meta, para a lista e o cabeçalho mudarem junto. */
function recount(goal: Goal, milestones: readonly Milestone[]): Goal {
  return {
    ...goal,
    milestone_count: milestones.length,
    completed_milestone_count: milestones.filter((milestone) => milestone.completed).length,
    progress_percent: goalProgress(goal, milestones),
  };
}

interface Snapshot {
  milestones: MilestonePage | undefined;
  detail: Goal | undefined;
}

let temp_counter = 0;

interface Config<TVariables, TData> {
  goal_id: string;
  mutation_fn: (variables: TVariables) => Promise<TData>;
  apply: (items: Milestone[], variables: TVariables) => Milestone[];
}

function useMilestoneMutation<TVariables, TData>({
  goal_id,
  mutation_fn,
  apply,
}: Config<TVariables, TData>) {
  const client = useQueryClient();
  const key = goalKeys.milestones(goal_id);
  return useMutation<TData, Error, TVariables, Snapshot>({
    mutationFn: mutation_fn,
    onMutate: async (variables) => {
      await client.cancelQueries({ queryKey: goalKeys.all });
      const snapshot: Snapshot = {
        milestones: client.getQueryData<MilestonePage>(key),
        detail: client.getQueryData<Goal>(goalKeys.detail(goal_id)),
      };
      if (snapshot.milestones) {
        const items = apply(snapshot.milestones.items, variables);
        client.setQueryData<MilestonePage>(key, { ...snapshot.milestones, items });
        client.setQueryData<Goal>(goalKeys.detail(goal_id), (goal) => goal && recount(goal, items));
      }
      return snapshot;
    },
    onError: (error, _variables, snapshot) => {
      rollback(client, goal_id, snapshot);
      pushToast({ tone: 'danger', message_key: refusalMessageKey(error) });
    },
    onSettled: () => client.invalidateQueries({ queryKey: goalKeys.all }),
  });
}

function rollback(client: QueryClient, goal_id: string, snapshot: Snapshot | undefined) {
  client.setQueryData(goalKeys.milestones(goal_id), snapshot?.milestones);
  client.setQueryData(goalKeys.detail(goal_id), snapshot?.detail);
}

export function useCreateMilestone(goal_id: string) {
  const client = useQueryClient();
  return useMilestoneMutation<{ title: string }, Milestone>({
    goal_id,
    mutation_fn: ({ title }) => api.post<Milestone>(base(goal_id), { title }),
    apply: (items, { title }) => {
      const goal = client.getQueryData<Goal>(goalKeys.detail(goal_id));
      temp_counter += 1;
      const position = items.reduce((max, item) => Math.max(max, item.position), 0) + 1;
      // Provisório até o servidor responder: as datas e o dono vêm da própria meta.
      const stamp = goal?.updated_at ?? '';
      return [
        ...items,
        {
          id: `pending-${String(temp_counter)}`,
          goal_id,
          owner_id: goal?.owner_id ?? '',
          title,
          completed: false,
          position,
          visibility: goal?.visibility ?? 'personal',
          created_at: stamp,
          updated_at: stamp,
        },
      ];
    },
  });
}

/** Conclui (`completed: true`) ou reabre (`false`) o marco. */
export function useToggleMilestone(goal_id: string) {
  return useMilestoneMutation<{ id: string; completed: boolean }, Milestone>({
    goal_id,
    mutation_fn: ({ id, completed }) =>
      api.patch<Milestone>(`${base(goal_id)}/${encodeURIComponent(id)}`, { completed }),
    apply: (items, { id, completed }) =>
      items.map((item) => (item.id === id ? { ...item, completed } : item)),
  });
}

export function useRenameMilestone(goal_id: string) {
  return useMilestoneMutation<{ id: string; title: string }, Milestone>({
    goal_id,
    mutation_fn: ({ id, title }) =>
      api.patch<Milestone>(`${base(goal_id)}/${encodeURIComponent(id)}`, { title }),
    apply: (items, { id, title }) =>
      items.map((item) => (item.id === id ? { ...item, title } : item)),
  });
}

export function useDeleteMilestone(goal_id: string) {
  return useMilestoneMutation<{ id: string }, undefined>({
    goal_id,
    mutation_fn: ({ id }) => api.delete<undefined>(`${base(goal_id)}/${encodeURIComponent(id)}`),
    apply: (items, { id }) => items.filter((item) => item.id !== id),
  });
}
