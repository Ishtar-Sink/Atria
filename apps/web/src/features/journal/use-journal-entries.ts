import type { Schemas } from '@atria/contracts';
import { resolvePeriod, type PeriodValue } from '@atria/ui';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import { z } from 'zod';
import { api } from '../../shared/api/client';
import { registerMessages } from '../../shared/i18n/i18n';
import { usePreferences } from '../../shared/preferences/preferences-context';
import messages from './i18n/pt-br.json';

registerMessages('journal', messages);

export type JournalEntry = Schemas['JournalEntryResponse'];
export type JournalEntryPage = Schemas['JournalEntryPage'];
export type CreateJournalEntryBody = Schemas['CreateJournalEntryRequest'];
export type UpdateJournalEntryBody = Schemas['UpdateJournalEntryRequest'];

export const JOURNAL_KEY = ['journal'] as const;
const PAGE_SIZE = 100;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Parâmetros da URL da listagem ([project/frontend-13]); valor inválido volta ao padrão. */
export const journalSearchSchema = z.object({
  q: z.string().catch(''),
  emotion: z.string().catch(''),
  period: z
    .enum(['this_month', 'last_month', 'last_30_days', 'this_year', 'all', 'custom'])
    .catch('all'),
  from: z.string().regex(ISO_DAY).optional().catch(undefined),
  to: z.string().regex(ISO_DAY).optional().catch(undefined),
  view: z.enum(['list', 'timeline']).catch('list'),
});
export type JournalSearch = z.output<typeof journalSearchSchema>;
export type JournalFilters = Pick<JournalSearch, 'q' | 'emotion' | 'period' | 'from' | 'to'>;

// ---------- datas no fuso do usuário ([project/code-style-06]) ----------

const pad = (n: number) => String(n).padStart(2, '0');

function zoneParts(instant: number, time_zone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: time_zone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(instant));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((item) => item.type === type)?.value ?? 0);
  return {
    year: part('year'),
    month: part('month'),
    day: part('day'),
    hour: part('hour'),
    minute: part('minute'),
    second: part('second'),
  };
}

/** Diferença, em minutos, entre o relógio do fuso e o UTC naquele instante. */
function offsetMinutes(instant: number, time_zone: string): number {
  const p = zoneParts(instant, time_zone);
  const as_utc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((as_utc - Math.floor(instant / 1000) * 1000) / 60000);
}

function resolveLocal(date: string, time: string, time_zone: string) {
  const [y = 1970, mo = 1, d = 1] = date.split('-').map(Number);
  const [h = 0, mi = 0] = time.split(':').map(Number);
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  let offset = offsetMinutes(guess, time_zone);
  let instant = guess - offset * 60000;
  const check = offsetMinutes(instant, time_zone);
  if (check !== offset) {
    offset = check;
    instant = guess - offset * 60000;
  }
  return { instant, offset };
}

/** O "hoje" no fuso do usuário, em `YYYY-MM-DD`. */
export function todayIn(time_zone: string, now: Date = new Date()): string {
  const p = zoneParts(now.getTime(), time_zone);
  return `${String(p.year)}-${pad(p.month)}-${pad(p.day)}`;
}

/** O agora no fuso do usuário, em `YYYY-MM-DDTHH:mm`, o valor do campo de data e hora. */
export function nowLocalInput(time_zone: string, now: Date = new Date()): string {
  return toLocalInput(now.toISOString(), time_zone);
}

/** Instante (RFC 3339, UTC) para o valor `YYYY-MM-DDTHH:mm` do campo de data e hora. */
export function toLocalInput(iso: string, time_zone: string): string {
  const p = zoneParts(new Date(iso).getTime(), time_zone);
  return `${String(p.year)}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

/** `YYYY-MM-DDTHH:mm` no fuso do usuário para RFC 3339 com o deslocamento do fuso. */
export function toRfc3339(local: string, time_zone: string): string {
  const [date = '', time = '00:00'] = local.split('T');
  const { offset } = resolveLocal(date, time, time_zone);
  const sign = offset < 0 ? '-' : '+';
  const abs = Math.abs(offset);
  return `${date}T${time}:00${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

/** O início do dia no fuso do usuário, como instante UTC. */
export function startOfDay(date: string, time_zone: string): string {
  return new Date(resolveLocal(date, '00:00', time_zone).instant).toISOString();
}

export function addDays(date: string, days: number): string {
  const moved = new Date(`${date}T00:00:00Z`);
  moved.setUTCDate(moved.getUTCDate() + days);
  return moved.toISOString().slice(0, 10);
}

/** O dia (`YYYY-MM-DD`) de um instante no fuso do usuário. */
export function dayOf(iso: string, time_zone: string): string {
  return todayIn(time_zone, new Date(iso));
}

// ---------- período ----------

export function toPeriodValue(
  filters: Pick<JournalFilters, 'period' | 'from' | 'to'>,
): PeriodValue {
  if (filters.period !== 'custom') return { preset: filters.period };
  const { from, to } = filters;
  if (from === undefined || to === undefined || from > to) return { preset: 'all' };
  return { preset: 'custom', from, to };
}

/**
 * `from` e `to` da API: o início do primeiro dia e o início do dia depois do último, porque o
 * `to` é excluso. "Qualquer período" não envia nenhum dos dois.
 */
export function periodQuery(
  filters: Pick<JournalFilters, 'period' | 'from' | 'to'>,
  time_zone: string,
  now: Date = new Date(),
): { from: string; to: string } | null {
  const range = resolvePeriod(toPeriodValue(filters), todayIn(time_zone, now));
  if (range === null) return null;
  return {
    from: startOfDay(range.from, time_zone),
    to: startOfDay(addDays(range.to, 1), time_zone),
  };
}

// ---------- consulta ----------

export function useJournalEntries(filters: JournalFilters) {
  const { time_zone } = usePreferences();
  const range = periodQuery(filters, time_zone);
  const from = range?.from;
  const to = range?.to;
  const emotion = filters.emotion === '' ? undefined : filters.emotion;

  const query = useInfiniteQuery({
    queryKey: [...JOURNAL_KEY, 'list', from ?? null, to ?? null, emotion ?? null],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) =>
      api.get<JournalEntryPage>('/journal-entries', {
        query: { limit: PAGE_SIZE, cursor: pageParam, from, to, emotion_id: emotion },
        signal,
      }),
    getNextPageParam: (last) => last.next_cursor ?? undefined,
  });
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query;
  // Os dias são agrupados no cliente: a lista precisa estar inteira.
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const all = useMemo(() => query.data?.pages.flatMap((page) => page.items) ?? [], [query.data]);
  const entries = useMemo(() => {
    const needle = filters.q.trim().toLowerCase();
    const found =
      needle === '' ? all : all.filter((entry) => entry.text.toLowerCase().includes(needle));
    return [...found].sort((a, b) => Date.parse(b.occurred_at) - Date.parse(a.occurred_at));
  }, [all, filters.q]);

  const failed = query.isError;
  return {
    entries,
    is_loading: (query.isPending || hasNextPage) && !failed,
    is_error: failed,
    refetch: () => {
      void query.refetch();
    },
  };
}
