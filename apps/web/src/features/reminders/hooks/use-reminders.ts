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

registerMessages('reminders', messages);

export type Reminder = Schemas['ReminderResponse'];
export type ReminderPage = Schemas['ReminderPageResponse'];
export type CreateReminderBody = Schemas['CreateReminderBody'];
export type UpdateReminderBody = Schemas['PatchReminderBody'];
type ContractRule = Schemas['RecurrenceRule'];

export const REMINDERS_KEY = ['reminders'] as const;
const PAGE_SIZE = 100;

/** Parâmetros da URL da listagem ([project/frontend-13]); valor inválido volta ao padrão. */
export const remindersSearchSchema = z.object({
  kind: z.enum(['any', 'one_off', 'recurring']).catch('any'),
  q: z.string().catch(''),
  view: z.enum(['list', 'day']).catch('list'),
});
export type RemindersSearch = z.output<typeof remindersSearchSchema>;
export type ReminderFilters = Pick<RemindersSearch, 'kind' | 'q'>;

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

/** O horário é obrigatório nos Lembretes: a tela já o validou antes de enviar. */
export function toRequestRule(rule: RecurrenceRule): ContractRule {
  const { time, month_day, ends_on, ...rest } = rule;
  return {
    ...rest,
    time: time ?? '',
    ...(month_day === null ? {} : { month_day }),
    ...(ends_on === null ? {} : { ends_on }),
  };
}

// ---------- data e hora no fuso do usuário ----------

function zonedParts(instant: Date, time_zone: string): Record<string, number> {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: time_zone,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
  }).formatToParts(instant);
  const found: Record<string, number> = {};
  for (const part of parts) if (part.type !== 'literal') found[part.type] = Number(part.value);
  return found;
}

/** Quantos ms o relógio de `time_zone` está à frente do UTC naquele instante. */
function zoneOffset(instant: Date, time_zone: string): number {
  const p = zonedParts(instant, time_zone);
  const as_utc = Date.UTC(p.year ?? 0, (p.month ?? 1) - 1, p.day ?? 1, p.hour ?? 0, p.minute ?? 0);
  return as_utc - Math.floor(instant.getTime() / 60000) * 60000;
}

/** `YYYY-MM-DDTHH:mm` no fuso do usuário vira o instante em UTC (RFC 3339). */
export function localToUtc(local: string, time_zone: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local);
  if (match === null) return '';
  const [year, month, day, hour, minute] = match.slice(1).map(Number) as [
    number,
    number,
    number,
    number,
    number,
  ];
  const wall = Date.UTC(year, month - 1, day, hour, minute);
  let guess = wall - zoneOffset(new Date(wall), time_zone);
  // Perto de uma troca de horário de verão o primeiro palpite pode errar uma hora.
  guess = wall - zoneOffset(new Date(guess), time_zone);
  return new Date(guess).toISOString();
}

/** O instante em UTC vira `YYYY-MM-DDTHH:mm` no fuso do usuário. */
export function utcToLocal(iso: string, time_zone: string): string {
  const p = zonedParts(new Date(iso), time_zone);
  const two = (value: number | undefined) => String(value ?? 0).padStart(2, '0');
  return `${String(p.year ?? 0).padStart(4, '0')}-${two(p.month)}-${two(p.day)}T${two(p.hour)}:${two(p.minute)}`;
}

/** O dia local (`YYYY-MM-DD`) de um instante em UTC. */
export function localDay(iso: string, time_zone: string): string {
  return utcToLocal(iso, time_zone).slice(0, 10);
}

// ---------- consultas ----------

function listQuery(filters: ReminderFilters, cursor: string | undefined) {
  return {
    limit: PAGE_SIZE,
    cursor,
    q: filters.q === '' ? undefined : filters.q,
    kind: filters.kind === 'any' ? undefined : filters.kind,
  };
}

export function useReminders(filters: ReminderFilters) {
  const query = useInfiniteQuery({
    queryKey: [...REMINDERS_KEY, 'list', filters.q, filters.kind],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) =>
      api.get<ReminderPage>('/reminders', { query: listQuery(filters, pageParam), signal }),
    getNextPageParam: (last) => last.next_cursor ?? undefined,
  });
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query;
  // O agrupamento por dia precisa da lista inteira.
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);
  return query;
}

export function useReminder(reminder_id: string) {
  return useQuery({
    queryKey: [...REMINDERS_KEY, 'detail', reminder_id],
    queryFn: ({ signal }) => api.get<Reminder>(`/reminders/${reminder_id}`, { signal }),
  });
}

/** Próximo disparo primeiro; sem próximo disparo por último, com o título nos empates. */
export function sortReminders(items: readonly Reminder[], locale: string): Reminder[] {
  return [...items].sort((a, b) => {
    const left = a.next_fire_at ?? null;
    const right = b.next_fire_at ?? null;
    if (left !== right) {
      if (left === null) return 1;
      if (right === null) return -1;
      return left < right ? -1 : 1;
    }
    return a.title.localeCompare(b.title, locale);
  });
}

export function useReminderRows(filters: ReminderFilters) {
  const { locale } = usePreferences();
  const query = useReminders(filters);
  const items = useMemo(() => query.data?.pages.flatMap((page) => page.items) ?? [], [query.data]);
  const rows = useMemo(() => sortReminders(items, locale), [items, locale]);
  return {
    rows,
    is_loading: (query.isPending || query.hasNextPage) && !query.isError,
    is_error: query.isError,
    refetch: () => {
      void query.refetch();
    },
  };
}

// ---------- mutações ----------

type Snapshot = [QueryKey, unknown][];

function errorKey(error: unknown, fallback: string): string {
  if (error instanceof ApiProblem && hasMessage(`common.errors.${error.code}`)) {
    return `common.errors.${error.code}`;
  }
  return fallback;
}

export function mapReminder(
  client: QueryClient,
  reminder_id: string,
  change: (reminder: Reminder) => Reminder,
) {
  client.setQueriesData<InfiniteData<ReminderPage>>(
    { queryKey: [...REMINDERS_KEY, 'list'] },
    (data) =>
      data === undefined
        ? data
        : {
            ...data,
            pages: data.pages.map((page) => ({
              ...page,
              items: page.items.map((item) => (item.id === reminder_id ? change(item) : item)),
            })),
          },
  );
  client.setQueryData<Reminder>([...REMINDERS_KEY, 'detail', reminder_id], (reminder) =>
    reminder === undefined ? reminder : change(reminder),
  );
}

interface OptimisticOptions<TData, TVariables> {
  mutation_fn: (variables: TVariables) => Promise<TData>;
  /** Aplica a mudança nos caches antes de o servidor responder. */
  apply: (client: QueryClient, variables: TVariables) => void;
}

/** Mutação otimista sobre os caches de lembretes; desfaz com aviso na recusa (RNF-09). */
function useRemindersOptimistic<TData, TVariables>(options: OptimisticOptions<TData, TVariables>) {
  const client = useQueryClient();
  const { mutation_fn, apply } = options;
  return useMutation<TData, Error, TVariables, { snapshot: Snapshot }>({
    mutationFn: mutation_fn,
    onMutate: async (variables) => {
      await client.cancelQueries({ queryKey: REMINDERS_KEY });
      const snapshot = client.getQueriesData({ queryKey: REMINDERS_KEY });
      apply(client, variables);
      return { snapshot };
    },
    onError: (error, _variables, context) => {
      context?.snapshot.forEach(([key, data]) => {
        client.setQueryData(key, data);
      });
      pushToast({ tone: 'danger', message_key: errorKey(error, 'common.errors.generic') });
    },
    onSettled: () => client.invalidateQueries({ queryKey: REMINDERS_KEY }),
  });
}

/** Não é otimista na lista: as ocorrências e o próximo disparo vêm do servidor. */
export function useCreateReminder() {
  const client = useQueryClient();
  return useMutation<Reminder, Error, CreateReminderBody>({
    mutationFn: (body) => api.post<Reminder>('/reminders', body),
    onSuccess: () => client.invalidateQueries({ queryKey: REMINDERS_KEY }),
  });
}

export interface UpdateReminderVariables {
  id: string;
  body: UpdateReminderBody;
}

function applyUpdate(reminder: Reminder, body: UpdateReminderBody): Reminder {
  const next: Reminder = { ...reminder };
  if (body.title != null) next.title = body.title;
  if (body.notes !== undefined) next.notes = body.notes;
  if (body.visibility != null) next.visibility = body.visibility;
  if (body.timezone != null) next.timezone = body.timezone;
  if (body.remind_at != null) {
    next.kind = 'one_off';
    next.remind_at = body.remind_at;
    next.next_fire_at = body.remind_at;
    next.rule = null;
  }
  // A regra nova muda os próximos disparos no servidor (RN-08): aqui só o tipo e a regra.
  if (body.rule != null) {
    next.kind = 'recurring';
    next.rule = body.rule;
    next.remind_at = null;
  }
  return next;
}

export function useUpdateReminder() {
  return useRemindersOptimistic<Reminder, UpdateReminderVariables>({
    mutation_fn: ({ id, body }) => api.patch<Reminder>(`/reminders/${id}`, body),
    apply: (client, { id, body }) => {
      mapReminder(client, id, (reminder) => applyUpdate(reminder, body));
    },
  });
}

export function useDeleteReminder() {
  return useRemindersOptimistic<unknown, string>({
    mutation_fn: (id) => api.delete<unknown>(`/reminders/${id}`),
    apply: (client, id) => {
      client.setQueriesData<InfiniteData<ReminderPage>>(
        { queryKey: [...REMINDERS_KEY, 'list'] },
        (data) =>
          data === undefined
            ? data
            : {
                ...data,
                pages: data.pages.map((page) => ({
                  ...page,
                  items: page.items.filter((item) => item.id !== id),
                })),
              },
      );
    },
  });
}
