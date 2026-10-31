import { useQuery } from '@tanstack/react-query';
import { api } from '../../../shared/api/client';
import { useT } from '../../../shared/i18n/i18n';
import { useOptimisticMutation } from '../../../shared/optimistic/use-optimistic-mutation';
import { usePreferences } from '../../../shared/preferences/preferences-context';
import { DASH_LIMIT } from '../blocks';
import { addDays, endOfDayUtc, localDate, localHour, monthOf, startOfDayUtc } from './dates';

// ---- Tipos locais das respostas (contratos de /tasks, /reminders, /transactions...) ----

interface Page<T> {
  items: T[];
  next_cursor?: string | null;
}

interface TaskDto {
  id: string;
  title: string;
  is_recurring: boolean;
  due_on?: string | null;
}

interface OccurrenceDto {
  task_id: string;
  occurrence_date: string;
  completed: boolean;
}

interface FireDto {
  reminder_id: string;
  title: string;
  fire_at: string;
}

interface TransactionDto {
  id?: string | null;
  kind: 'income' | 'expense';
  description?: string | null;
  expected_amount: number;
  expected_date: string;
  currency: string;
  recurrence_id?: string | null;
  occurrence_date?: string | null;
}

interface FlowDto {
  realized: number;
  forecast: number;
}

interface SummaryDto {
  currency: string;
  balance: { current: number; accounts: { id: string; name: string; balance_amount: number }[] };
  totals: { income: FlowDto; expense: FlowDto; surplus: FlowDto };
}

interface JournalEntryDto {
  id: string;
  occurred_at: string;
  text: string;
  emotions: { emotion_id: string; name?: string | null; system_key?: string | null }[];
}

interface BookDto {
  id: string;
  title: string;
  progress_percent?: number | null;
}

// ---- Relógio e fuso ----

/** O "hoje" do usuário, pelo relógio da página e pelo fuso das preferências. */
export function useToday() {
  const { time_zone } = usePreferences();
  const now = new Date();
  return { now, time_zone, today: localDate(now, time_zone) };
}

const KEY = 'dashboard';

// ---- Tarefas de hoje ----

export interface TodayTask {
  task_id: string;
  title: string;
  recurring: boolean;
  /** Vencimento da pontual; nulo na ocorrência de uma recorrente. */
  due_on: string | null;
  overdue: boolean;
}

export interface TodayTasks {
  items: TodayTask[];
  total_today: number;
}

export function useTodayTasks(enabled: boolean) {
  const { today } = useToday();
  return useQuery({
    queryKey: [KEY, 'today-tasks', today],
    enabled,
    queryFn: async ({ signal }): Promise<TodayTasks> => {
      const [occurrences, open, recurring] = await Promise.all([
        api.get<{ items: OccurrenceDto[] }>('/tasks/occurrences', {
          query: { from: today, to: today },
          signal,
        }),
        // As pontuais abertas com vencimento até hoje: as de hoje e as vencidas.
        api.get<Page<TaskDto>>('/tasks', { query: { status: 'open', due_to: today }, signal }),
        api.get<Page<TaskDto>>('/tasks', { query: { status: 'open', recurring: true }, signal }),
      ]);
      const titles = new Map(recurring.items.map((task) => [task.id, task.title]));
      const single = open.items.filter((task) => !task.is_recurring && task.due_on != null);
      const items: TodayTask[] = [
        ...single
          .filter((task) => (task.due_on ?? today) < today)
          .sort((a, b) => (a.due_on ?? '').localeCompare(b.due_on ?? ''))
          .map((task) => ({
            task_id: task.id,
            title: task.title,
            recurring: false,
            due_on: task.due_on ?? null,
            overdue: true,
          })),
        ...single
          .filter((task) => task.due_on === today)
          .map((task) => ({
            task_id: task.id,
            title: task.title,
            recurring: false,
            due_on: today,
            overdue: false,
          })),
        ...occurrences.items
          .filter((occ) => !occ.completed && titles.has(occ.task_id))
          .map((occ) => ({
            task_id: occ.task_id,
            title: titles.get(occ.task_id) ?? '',
            recurring: true,
            due_on: null,
            overdue: false,
          })),
      ];
      // O dia conta também as já concluídas hoje.
      const ids = new Set<string>([
        ...single.map((task) => task.id),
        ...occurrences.items.map((occ) => occ.task_id),
      ]);
      return { items, total_today: ids.size };
    },
  });
}

/** Conclui a tarefa de hoje: o item some na hora e volta com aviso se o servidor recusar. */
export function useCompleteTask() {
  const { today } = useToday();
  return useOptimisticMutation<unknown, TodayTask, TodayTasks>({
    query_key: [KEY, 'today-tasks', today],
    mutation_fn: (task) =>
      task.recurring
        ? api.post(`/tasks/${task.task_id}/completion`, { occurrence_date: today })
        : api.post(`/tasks/${task.task_id}/completion`),
    apply: (current, task) => ({
      items: (current?.items ?? []).filter((item) => item.task_id !== task.task_id),
      total_today: current?.total_today ?? 0,
    }),
  });
}

// ---- Lembretes de hoje ----

export type DayPeriod = 'morning' | 'afternoon' | 'night';

export interface DashReminder {
  reminder_id: string;
  title: string;
  fire_at: string;
  period: DayPeriod;
}

export function periodOfHour(hour: number): DayPeriod {
  if (hour < 12) return 'morning';
  if (hour < 18) return 'afternoon';
  return 'night';
}

export function useTodayReminders(enabled: boolean) {
  const { today, time_zone } = useToday();
  return useQuery({
    queryKey: [KEY, 'today-reminders', today, time_zone],
    enabled,
    queryFn: async ({ signal }): Promise<{ items: DashReminder[]; total: number }> => {
      const response = await api.get<{ items: FireDto[] }>('/reminders/upcoming', {
        query: {
          from: startOfDayUtc(today, time_zone).toISOString(),
          to: endOfDayUtc(today, time_zone).toISOString(),
        },
        signal,
      });
      const items = response.items
        .map((fire) => ({
          ...fire,
          period: periodOfHour(localHour(new Date(fire.fire_at), time_zone)),
        }))
        .sort((a, b) => a.fire_at.localeCompare(b.fire_at));
      return { items, total: items.length };
    },
  });
}

// ---- Próximos dias ----

export interface UpcomingItem {
  key: string;
  /** Dia local, `AAAA-MM-DD`. */
  date: string;
  kind: 'transaction' | 'reminder';
  title: string;
  href: string;
  amount?: number;
  currency?: string;
  /** Hora local de um lembrete, para ordenar dentro do dia. */
  at?: string;
}

export function useUpcomingDays(enabled: boolean) {
  const { today, time_zone } = useToday();
  const t = useT();
  return useQuery({
    queryKey: [KEY, 'upcoming', today, time_zone],
    enabled,
    queryFn: async ({ signal }): Promise<UpcomingItem[]> => {
      const tomorrow = addDays(today, 1);
      const end = addDays(today, 7);
      const [transactions, reminders] = await Promise.all([
        api.get<Page<TransactionDto>>('/transactions', {
          query: { settled: false, from: tomorrow, to: end },
          signal,
        }),
        api.get<{ items: FireDto[] }>('/reminders/upcoming', {
          query: {
            from: startOfDayUtc(tomorrow, time_zone).toISOString(),
            to: endOfDayUtc(end, time_zone).toISOString(),
          },
          signal,
        }),
      ]);
      const money: UpcomingItem[] = transactions.items.map((tx) => {
        const virtual = tx.id == null;
        return {
          key: tx.id ?? `${tx.recurrence_id ?? ''}:${tx.occurrence_date ?? tx.expected_date}`,
          date: tx.expected_date,
          kind: 'transaction',
          title: tx.description?.trim() || t('dashboard.balance.bill_fallback'),
          href: virtual
            ? `/finance/recurring-transactions/${tx.recurrence_id ?? ''}`
            : `/finance/transactions/${tx.id ?? ''}`,
          amount: tx.kind === 'expense' ? -tx.expected_amount : tx.expected_amount,
          currency: tx.currency,
        };
      });
      const alarms: UpcomingItem[] = reminders.items.map((fire) => ({
        key: `${fire.reminder_id}:${fire.fire_at}`,
        date: localDate(new Date(fire.fire_at), time_zone),
        kind: 'reminder',
        title: fire.title,
        href: `/reminders/${fire.reminder_id}`,
        at: fire.fire_at,
      }));
      return [...money, ...alarms]
        .sort((a, b) => a.date.localeCompare(b.date) || (a.at ?? '').localeCompare(b.at ?? ''))
        .slice(0, DASH_LIMIT);
    },
  });
}

// ---- Dinheiro ----

export interface MoneyBill {
  key: string;
  title: string;
  date: string;
  amount: number;
  currency: string;
}

export interface MoneyBlock {
  currency: string;
  total: number;
  accounts: { id: string; name: string; amount: number }[];
  month_left: { income: number; expense: number };
  next_month: { from: string; to: string; income: number; expense: number; surplus: number };
  bills: MoneyBill[];
  has_more_bills: boolean;
}

function leftOver(flow: FlowDto): number {
  return Math.max(0, flow.forecast - flow.realized);
}

export function useMoneyBlock(enabled: boolean) {
  const { today, time_zone } = useToday();
  const t = useT();
  return useQuery({
    queryKey: [KEY, 'money', today, time_zone],
    enabled,
    queryFn: async ({ signal }): Promise<MoneyBlock> => {
      const current = monthOf(today);
      const next = monthOf(today, 1);
      const [now_summary, next_summary, bills] = await Promise.all([
        api.get<SummaryDto>('/financial-summaries', {
          query: { from: current.from, to: current.to },
          signal,
        }),
        api.get<SummaryDto>('/financial-summaries', {
          query: { from: next.from, to: next.to },
          signal,
        }),
        api.get<Page<TransactionDto>>('/transactions', {
          query: {
            kind: 'expense',
            settled: false,
            from: next.from,
            to: next.to,
            limit: DASH_LIMIT,
          },
          signal,
        }),
      ]);
      return {
        currency: now_summary.currency,
        total: now_summary.balance.current,
        accounts: now_summary.balance.accounts.map((account) => ({
          id: account.id,
          name: account.name,
          amount: account.balance_amount,
        })),
        month_left: {
          income: leftOver(now_summary.totals.income),
          expense: leftOver(now_summary.totals.expense),
        },
        next_month: {
          ...next,
          income: next_summary.totals.income.forecast,
          expense: next_summary.totals.expense.forecast,
          surplus: next_summary.totals.surplus.forecast,
        },
        bills: bills.items.slice(0, DASH_LIMIT).map((tx) => ({
          key: tx.id ?? `${tx.recurrence_id ?? ''}:${tx.occurrence_date ?? tx.expected_date}`,
          title: tx.description?.trim() || t('dashboard.balance.bill_fallback'),
          date: tx.expected_date,
          amount: tx.expected_amount,
          currency: tx.currency,
        })),
        has_more_bills: bills.next_cursor != null,
      };
    },
  });
}

// ---- Diário e leituras ----

export interface LastJournalEntry {
  id: string;
  occurred_at: string;
  text: string;
  emotions: { id: string; name: string }[];
}

export function useLastJournalEntry(enabled: boolean) {
  return useQuery({
    queryKey: [KEY, 'journal'],
    enabled,
    queryFn: async ({ signal }): Promise<LastJournalEntry | null> => {
      const page = await api.get<Page<JournalEntryDto>>('/journal-entries', {
        query: { limit: 1 },
        signal,
      });
      const entry = page.items[0];
      if (entry === undefined) return null;
      return {
        id: entry.id,
        occurred_at: entry.occurred_at,
        text: entry.text,
        emotions: entry.emotions.map((emotion) => ({
          id: emotion.emotion_id,
          name: emotion.name ?? emotion.system_key ?? '',
        })),
      };
    },
  });
}

export interface ReadingBook {
  id: string;
  title: string;
  percent: number;
}

export function useReadingNow(enabled: boolean) {
  return useQuery({
    queryKey: [KEY, 'reading'],
    enabled,
    queryFn: async ({ signal }): Promise<ReadingBook[]> => {
      const page = await api.get<Page<BookDto>>('/books', {
        query: { reading_status: 'reading', limit: 3 },
        signal,
      });
      return page.items.slice(0, 3).map((book) => ({
        id: book.id,
        title: book.title,
        percent: Math.round(book.progress_percent ?? 0),
      }));
    },
  });
}
