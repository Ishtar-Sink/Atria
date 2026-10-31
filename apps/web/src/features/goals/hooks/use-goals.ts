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
import {
  GOAL_STATUSES,
  goalProgress,
  type Goal,
  type GoalPage,
  type GoalStatus,
  type Visibility,
} from '../lib/goal-progress';

// Todas as telas da feature passam por aqui; o registro é idempotente.
registerMessages('goals', messages);

const PAGE_SIZE = 20;

export interface GoalFilters {
  status?: GoalStatus | undefined;
  label?: string | undefined;
  has_deadline?: boolean | undefined;
  q?: string | undefined;
}

/** Corpo do `PATCH /goals/{id}`: o que não vem fica como está. */
export interface GoalPatch {
  title?: string;
  description?: string | null;
  deadline?: string | null;
  status?: GoalStatus;
  labels?: string[];
  visibility?: Visibility;
}

export interface GoalInput {
  title: string;
  description?: string | null;
  deadline?: string | null;
  status?: GoalStatus;
  labels?: string[];
  visibility?: Visibility;
}

type GoalList = InfiniteData<GoalPage, string | undefined>;

const optionalText = z.preprocess(
  (value) =>
    (typeof value === 'string' && value !== '') || typeof value === 'number'
      ? String(value)
      : undefined,
  z.string().optional(),
);
// O roteador entrega `true` e `false` da URL como booleanos.
const optionalFlag = z.preprocess(
  (value) => (value === 'true' ? true : value === 'false' ? false : value),
  z.boolean().optional(),
);

/** Filtros, busca e visualização da lista, como ficam na URL ([project/frontend-13]). */
export const goalsSearchSchema = z.object({
  status: z.enum(GOAL_STATUSES).optional(),
  label: optionalText,
  has_deadline: optionalFlag,
  q: optionalText,
  view: z.enum(['list', 'grid']).default('list'),
});

export type GoalsSearch = z.output<typeof goalsSearchSchema>;

export function searchToFilters(search: GoalsSearch): GoalFilters {
  return {
    status: search.status,
    label: search.label,
    has_deadline: search.has_deadline,
    q: search.q,
  };
}

export const goalKeys = {
  all: ['goals'] as const,
  lists: ['goals', 'list'] as const,
  list: (filters: GoalFilters) => ['goals', 'list', filters] as const,
  detail: (id: string) => ['goals', 'detail', id] as const,
  milestones: (id: string) => ['goals', 'milestones', id] as const,
};

/** Chave de tradução do aviso quando o servidor recusa uma mudança. */
export function refusalMessageKey(error: unknown): string {
  if (error instanceof ApiProblem) {
    const key = `common.errors.${error.code}`;
    if (hasMessage(key)) return key;
  }
  return 'common.errors.generic';
}

export function useGoals(filters: GoalFilters) {
  return useInfiniteQuery({
    queryKey: goalKeys.list(filters),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) =>
      api.get<GoalPage>('/goals', {
        query: {
          status: filters.status,
          label: filters.label,
          has_deadline: filters.has_deadline,
          q: filters.q,
          cursor: pageParam,
          limit: PAGE_SIZE,
        },
        signal,
      }),
    getNextPageParam: (last) => last.next_cursor ?? undefined,
  });
}

export function useGoal(id: string) {
  return useQuery({
    queryKey: goalKeys.detail(id),
    queryFn: ({ signal }) => api.get<Goal>(`/goals/${encodeURIComponent(id)}`, { signal }),
  });
}

function mapLists(client: QueryClient, change: (page: GoalPage) => GoalPage) {
  client.setQueriesData<GoalList>({ queryKey: goalKeys.lists }, (current) =>
    current === undefined
      ? current
      : { ...current, pages: current.pages.map((page) => change(page)) },
  );
}

/** Aplica o `PATCH` ao que a tela já mostra, antes de o servidor responder. */
export function applyGoalPatch(goal: Goal, patch: GoalPatch): Goal {
  const next: Goal = {
    ...goal,
    ...(patch.title === undefined ? {} : { title: patch.title }),
    ...(patch.description === undefined ? {} : { description: patch.description }),
    ...(patch.deadline === undefined ? {} : { deadline: patch.deadline }),
    ...(patch.status === undefined ? {} : { status: patch.status }),
    ...(patch.labels === undefined ? {} : { labels: patch.labels }),
    ...(patch.visibility === undefined ? {} : { visibility: patch.visibility }),
  };
  // Sem marcos, o progresso segue o status (RN-15).
  return next.milestone_count === 0 ? { ...next, progress_percent: goalProgress(next, []) } : next;
}

interface Snapshot {
  lists: [QueryKey, GoalList | undefined][];
  detail: [QueryKey, Goal | undefined] | undefined;
}

export function useUpdateGoal() {
  const client = useQueryClient();
  return useMutation<Goal, Error, { id: string; patch: GoalPatch }, Snapshot>({
    mutationFn: ({ id, patch }) => api.patch<Goal>(`/goals/${encodeURIComponent(id)}`, patch),
    onMutate: async ({ id, patch }) => {
      await client.cancelQueries({ queryKey: goalKeys.all });
      const snapshot: Snapshot = {
        lists: client.getQueriesData<GoalList>({ queryKey: goalKeys.lists }),
        detail: [goalKeys.detail(id), client.getQueryData<Goal>(goalKeys.detail(id))],
      };
      mapLists(client, (page) => ({
        ...page,
        items: page.items.map((goal) => (goal.id === id ? applyGoalPatch(goal, patch) : goal)),
      }));
      client.setQueryData<Goal>(goalKeys.detail(id), (goal) =>
        goal === undefined ? goal : applyGoalPatch(goal, patch),
      );
      return snapshot;
    },
    onError: (error, _variables, snapshot) => {
      snapshot?.lists.forEach(([key, data]) => {
        client.setQueryData(key, data);
      });
      if (snapshot?.detail) client.setQueryData(snapshot.detail[0], snapshot.detail[1]);
      pushToast({ tone: 'danger', message_key: refusalMessageKey(error) });
    },
    onSettled: () => client.invalidateQueries({ queryKey: goalKeys.all }),
  });
}

/** Criar não é otimista na lista: a meta só existe depois do servidor, e a tela abre nela. */
export function useCreateGoal() {
  const client = useQueryClient();
  const navigate = useNavigate();
  return useMutation<Goal, Error, GoalInput>({
    mutationFn: (input) => api.post<Goal>('/goals', input),
    onSuccess: async (goal) => {
      await client.invalidateQueries({ queryKey: goalKeys.all });
      await navigate({ to: `/goals/${goal.id}` });
    },
  });
}

export function useDeleteGoal() {
  const client = useQueryClient();
  const navigate = useNavigate();
  return useMutation<undefined, Error, { id: string }, Snapshot>({
    mutationFn: ({ id }) => api.delete<undefined>(`/goals/${encodeURIComponent(id)}`),
    onMutate: async ({ id }) => {
      await client.cancelQueries({ queryKey: goalKeys.lists });
      const snapshot: Snapshot = {
        lists: client.getQueriesData<GoalList>({ queryKey: goalKeys.lists }),
        detail: undefined,
      };
      mapLists(client, (page) => ({
        ...page,
        items: page.items.filter((goal) => goal.id !== id),
      }));
      return snapshot;
    },
    onError: (error, _variables, snapshot) => {
      snapshot?.lists.forEach(([key, data]) => {
        client.setQueryData(key, data);
      });
      pushToast({ tone: 'danger', message_key: refusalMessageKey(error) });
    },
    onSuccess: async (_data, { id }) => {
      client.removeQueries({ queryKey: goalKeys.detail(id) });
      await navigate({ to: '/goals' });
    },
    onSettled: () => client.invalidateQueries({ queryKey: goalKeys.lists }),
  });
}
