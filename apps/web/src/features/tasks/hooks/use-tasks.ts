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
import { useEffect, useMemo } from 'react';
import { z } from 'zod';
import { api } from '../../../shared/api/client';
import { ApiProblem } from '../../../shared/api/problem';
import type { RecurrenceRule } from '../../../shared/forms/recurrence-fields';
import { hasMessage, registerMessages } from '../../../shared/i18n/i18n';
import { usePreferences } from '../../../shared/preferences/preferences-context';
import { pushToast } from '../../../shared/toast/toast-store';
import messages from '../i18n/pt-br.json';

registerMessages('tasks', messages);

export type Task = Schemas['TaskResponse'];
export type TaskPage = Schemas['TaskPageResponse'];
export type TaskOccurrence = Schemas['OccurrenceResponse'];
export type OccurrenceList = Schemas['OccurrenceListResponse'];
export type CreateTaskBody = Schemas['CreateTaskRequest'];
export type UpdateTaskBody = Schemas['UpdateTaskRequest'];
type ContractRule = Schemas['RecurrenceRule'];

export const TASKS_KEY = ['tasks'] as const;
const PAGE_SIZE = 100;
/** As recorrentes mostram hoje e os seis dias seguintes (PD-32). */
export const OCCURRENCE_DAYS = 7;

/** Parâmetros da URL da listagem ([project/frontend-13]); valor inválido volta ao padrão. */
export const tasksSearchSchema = z.object({
  status: z.enum(['open', 'completed', 'all']).catch('open'),
  recurring: z.enum(['any', 'single', 'recurring']).catch('any'),
  label: z.string().catch(''),
  range: z.enum(['today', 'week', 'all']).catch('today'),
  q: z.string().catch(''),
  view: z.enum(['list', 'day']).catch('list'),
});
export type TasksSearch = z.output<typeof tasksSearchSchema>;
export type TaskFilters = Pick<TasksSearch, 'status' | 'recurring' | 'label' | 'range' | 'q'>;

// ---------- datas locais ----------

/** O "hoje" no fuso do usuário, em `YYYY-MM-DD` ([project/code-style-06]). */
export function todayIn(time_zone: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: time_zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Janela das ocorrências: nunca começa antes de hoje, porque as recorrentes não guardam histórico. */
export function occurrenceWindow(today: string, range: TasksSearch['range']) {
  const days = range === 'today' ? 1 : OCCURRENCE_DAYS;
  return { from: today, to: addDays(today, days - 1) };
}

// ---------- regra de recorrência ----------

export function toRule(rule: ContractRule): RecurrenceRule {
  return {
    frequency: rule.frequency,
    interval: rule.interval,
    weekdays: rule.weekdays ?? [],
    month_day: rule.month_day ?? null,
    time: rule.time === '' ? null : rule.time,
    timezone: rule.timezone,
    starts_on: rule.starts_on,
    ends_on: rule.ends_on ?? null,
  };
}

/** O horário é opcional nas Tarefas: sem ele, o campo `time` não vai no corpo. */
export function toRequestRule(rule: RecurrenceRule): ContractRule {
  const { time, ...rest } = rule;
  return (time === null ? rest : { ...rest, time }) as ContractRule;
}

// ---------- consultas ----------

function listQuery(filters: TaskFilters, cursor: string | undefined) {
  return {
    limit: PAGE_SIZE,
    cursor,
    q: filters.q === '' ? undefined : filters.q,
    label: filters.label === '' ? undefined : filters.label,
    recurring: filters.recurring === 'any' ? undefined : filters.recurring === 'recurring',
    // Com recorrentes na lista o status vem das ocorrências: só a lista de pontuais o envia.
    status: filters.recurring === 'single' && filters.status !== 'all' ? filters.status : undefined,
  };
}

export function useTasks(filters: TaskFilters) {
  const query = useInfiniteQuery({
    queryKey: [...TASKS_KEY, 'list', filters.q, filters.label, filters.recurring, filters.status],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) =>
      api.get<TaskPage>('/tasks', { query: listQuery(filters, pageParam), signal }),
    getNextPageParam: (last) => last.next_cursor ?? undefined,
  });
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query;
  // As ocorrências são juntadas por `task_id`: a lista precisa estar inteira.
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);
  return query;
}

export function useTaskOccurrences(from: string, to: string, enabled = true) {
  return useQuery({
    queryKey: [...TASKS_KEY, 'occurrences', from, to],
    queryFn: ({ signal }) =>
      api.get<OccurrenceList>('/tasks/occurrences', { query: { from, to }, signal }),
    enabled,
  });
}

export function useTask(task_id: string) {
  return useQuery({
    queryKey: [...TASKS_KEY, 'detail', task_id],
    queryFn: ({ signal }) => api.get<Task>(`/tasks/${task_id}`, { signal }),
  });
}

// ---------- linhas da listagem ----------

export interface TaskRow {
  key: string;
  task: Task;
  /** Só nas ocorrências das recorrentes. */
  occurrence_date: string | null;
  done: boolean;
  /** A data da ocorrência ou o vencimento da pontual. */
  date: string | null;
}

function wantsStatus(status: TasksSearch['status'], done: boolean): boolean {
  return status === 'all' || (status === 'completed' ? done : !done);
}

export function buildRows(
  tasks: readonly Task[],
  occurrences: readonly TaskOccurrence[],
  filters: TaskFilters,
  today: string,
): TaskRow[] {
  const { to } = occurrenceWindow(today, filters.range);
  const rows: TaskRow[] = [];

  if (filters.recurring !== 'recurring') {
    for (const task of tasks.filter((item) => !item.is_recurring)) {
      const done = (task.completed_at ?? null) !== null;
      if (!wantsStatus(filters.status, done)) continue;
      // Vencida e não concluída continua aberta; só o que vence depois da janela sai.
      const later = task.due_on != null && task.due_on > to;
      if (!done && filters.range !== 'all' && later) continue;
      rows.push({ key: task.id, task, occurrence_date: null, done, date: task.due_on ?? null });
    }
  }

  if (filters.recurring !== 'single') {
    const by_id = new Map(tasks.map((task) => [task.id, task]));
    for (const occurrence of occurrences) {
      const task = by_id.get(occurrence.task_id);
      if (task === undefined || occurrence.occurrence_date < today) continue;
      if (!wantsStatus(filters.status, occurrence.completed)) continue;
      rows.push({
        key: `${task.id}:${occurrence.occurrence_date}`,
        task,
        occurrence_date: occurrence.occurrence_date,
        done: occurrence.completed,
        date: occurrence.occurrence_date,
      });
    }
  }
  return rows;
}

/** Abertas antes das concluídas na lista; por data (sem data por último) e título nos empates. */
export function sortRows(rows: readonly TaskRow[], view: TasksSearch['view'], locale: string) {
  return [...rows].sort((a, b) => {
    if (view === 'list' && a.done !== b.done) return a.done ? 1 : -1;
    if (a.date !== b.date) {
      if (a.date === null) return 1;
      if (b.date === null) return -1;
      return a.date < b.date ? -1 : 1;
    }
    return a.task.title.localeCompare(b.task.title, locale);
  });
}

/** Pontuais do período mais as ocorrências das recorrentes, juntadas por `task_id`. */
export function useTaskRows(filters: TaskFilters, view: TasksSearch['view'] = 'list') {
  const { time_zone, locale } = usePreferences();
  const today = todayIn(time_zone);
  const { from, to } = occurrenceWindow(today, filters.range);
  const tasks = useTasks(filters);
  const occurrences = useTaskOccurrences(from, to, filters.recurring !== 'single');

  const items = useMemo(() => tasks.data?.pages.flatMap((page) => page.items) ?? [], [tasks.data]);
  const rows = useMemo(
    () => sortRows(buildRows(items, occurrences.data?.items ?? [], filters, today), view, locale),
    [items, occurrences.data, filters, today, view, locale],
  );

  const pending =
    tasks.isPending ||
    tasks.hasNextPage ||
    (filters.recurring !== 'single' && occurrences.isPending);
  const failed = tasks.isError || (filters.recurring !== 'single' && occurrences.isError);
  return {
    rows,
    today,
    is_loading: pending && !failed,
    is_error: failed,
    refetch: () => {
      void tasks.refetch();
      void occurrences.refetch();
    },
  };
}

// ---------- mutações ----------

type Snapshot = [QueryKey, unknown][];

function errorKey(error: unknown, fallback: string): string {
  if (error instanceof ApiProblem) {
    for (const key of [`tasks.completion.${error.code}`, `common.errors.${error.code}`]) {
      if (hasMessage(key)) return key;
    }
  }
  return fallback;
}

export function mapTask(client: QueryClient, task_id: string, change: (task: Task) => Task) {
  client.setQueriesData<InfiniteData<TaskPage>>({ queryKey: [...TASKS_KEY, 'list'] }, (data) =>
    data === undefined
      ? data
      : {
          ...data,
          pages: data.pages.map((page) => ({
            ...page,
            items: page.items.map((task) => (task.id === task_id ? change(task) : task)),
          })),
        },
  );
  client.setQueryData<Task>([...TASKS_KEY, 'detail', task_id], (task) =>
    task === undefined ? task : change(task),
  );
}

export function mapOccurrences(
  client: QueryClient,
  change: (items: TaskOccurrence[]) => TaskOccurrence[],
) {
  client.setQueriesData<OccurrenceList>({ queryKey: [...TASKS_KEY, 'occurrences'] }, (data) =>
    data === undefined ? data : { ...data, items: change(data.items) },
  );
}

export interface TasksOptimisticOptions<TData, TVariables> {
  mutation_fn: (variables: TVariables) => Promise<TData>;
  /** Aplica a mudança nos caches antes de o servidor responder. */
  apply: (client: QueryClient, variables: TVariables) => void;
  error_message_key?: string;
}

/** Mutação otimista sobre todos os caches de tarefas; desfaz com aviso na recusa ([project/frontend-18]). */
export function useTasksOptimistic<TData, TVariables>(
  options: TasksOptimisticOptions<TData, TVariables>,
) {
  const client = useQueryClient();
  const { mutation_fn, apply } = options;
  const fallback = options.error_message_key ?? 'common.errors.generic';
  return useMutation<TData, Error, TVariables, { snapshot: Snapshot }>({
    mutationFn: mutation_fn,
    onMutate: async (variables) => {
      await client.cancelQueries({ queryKey: TASKS_KEY });
      const snapshot = client.getQueriesData({ queryKey: TASKS_KEY });
      apply(client, variables);
      return { snapshot };
    },
    onError: (error, _variables, context) => {
      context?.snapshot.forEach(([key, data]) => {
        client.setQueryData(key, data);
      });
      pushToast({ tone: 'danger', message_key: errorKey(error, fallback) });
    },
    onSettled: () => client.invalidateQueries({ queryKey: TASKS_KEY }),
  });
}

export function useCreateTask() {
  const client = useQueryClient();
  return useMutation<Task, Error, CreateTaskBody>({
    mutationFn: (body) => api.post<Task>('/tasks', body),
    onSuccess: () => client.invalidateQueries({ queryKey: TASKS_KEY }),
  });
}

export interface UpdateTaskVariables {
  id: string;
  body: UpdateTaskBody;
}

function applyUpdate(task: Task, body: UpdateTaskBody): Task {
  const next: Task = { ...task };
  if (body.title != null) next.title = body.title;
  if (body.description !== undefined) next.description = body.description;
  if (body.due_on !== undefined) next.due_on = body.due_on;
  if (body.labels != null) next.labels = body.labels;
  if (body.visibility != null) next.visibility = body.visibility;
  if (body.recurrence !== undefined) {
    next.recurrence = body.recurrence;
    next.is_recurring = body.recurrence !== null;
  }
  return next;
}

export function useUpdateTask() {
  return useTasksOptimistic<Task, UpdateTaskVariables>({
    mutation_fn: ({ id, body }) => api.patch<Task>(`/tasks/${id}`, body),
    apply: (client, { id, body }) => {
      mapTask(client, id, (task) => applyUpdate(task, body));
    },
  });
}

export function useDeleteTask() {
  return useTasksOptimistic<unknown, string>({
    mutation_fn: (id) => api.delete<unknown>(`/tasks/${id}`),
    apply: (client, id) => {
      client.setQueriesData<InfiniteData<TaskPage>>({ queryKey: [...TASKS_KEY, 'list'] }, (data) =>
        data === undefined
          ? data
          : {
              ...data,
              pages: data.pages.map((page) => ({
                ...page,
                items: page.items.filter((task) => task.id !== id),
              })),
            },
      );
      mapOccurrences(client, (items) => items.filter((item) => item.task_id !== id));
    },
  });
}
