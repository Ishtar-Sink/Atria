import { resolvePeriod, type PeriodPreset, type PeriodValue } from '@atria/ui';
import { useNavigate, useRouterState } from '@tanstack/react-router';
import { useCallback, useMemo, useState } from 'react';
import { z } from 'zod';
import { usePreferences } from '../../shared/preferences/preferences-context';
import {
  ENTITY_FILTERS,
  FILTER_PARAM,
  REPORT_MODULES,
  findReport,
  hasPeriod,
  type EntityFilterKey,
  type FilterParam,
  type ReportModule,
} from './report-catalog';

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

const PRESETS = [
  'this_month',
  'last_month',
  'next_30_days',
  'last_30_days',
  'this_year',
  'all',
] as const satisfies readonly PeriodPreset[];

/** Valores aceitos de cada parâmetro da URL; o que não passa é descartado sem erro. */
const FIELDS = {
  period: z.enum([...PRESETS, 'custom']),
  from: z.string().regex(ISO_DAY),
  to: z.string().regex(ISO_DAY),
  account_id: z.uuid(),
  category_id: z.uuid(),
  book_id: z.uuid(),
  emotion: z.uuid(),
  goal_id: z.uuid(),
  project_id: z.uuid(),
  type: z.enum(['book', 'article', 'video']),
  goal_status: z.enum(['planned', 'in_progress', 'completed', 'abandoned']),
  from_module: z.enum(REPORT_MODULES),
  run: z.literal('1'),
} as const;

type FieldKey = keyof typeof FIELDS;

/** O roteador entrega `run=1` como número; tudo vira texto antes de validar. */
function asText(value: unknown): string | undefined {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : undefined;
}

function pick<K extends FieldKey>(
  raw: Record<string, unknown>,
  key: K,
): z.output<(typeof FIELDS)[K]> | undefined {
  const text = asText(raw[key]);
  if (text === undefined) return undefined;
  const parsed = FIELDS[key].safeParse(text);
  return parsed.success ? (parsed.data as z.output<(typeof FIELDS)[K]>) : undefined;
}

export type ReportFilters = Partial<Record<FilterParam, string>>;

export interface ReportSearch {
  period: PeriodValue['preset'];
  from?: string;
  to?: string;
  filters: ReportFilters;
  from_module?: ReportModule;
  run: boolean;
}

function readFilters(report_id: string, raw: Record<string, unknown>): ReportFilters {
  const entry = findReport(report_id);
  const filters: ReportFilters = {};
  if (!entry) return filters;
  for (const key of Object.keys(FILTER_PARAM) as EntityFilterKey[]) {
    const accepted: readonly string[] = entry.filters;
    if (!accepted.includes(key)) continue;
    const param = FILTER_PARAM[key];
    const value = pick(raw, param);
    if (value !== undefined) filters[param] = value;
  }
  return filters;
}

function comesFromEntity(report_id: string, filters: ReportFilters): boolean {
  const entry = findReport(report_id);
  if (!entry) return false;
  const accepted: readonly string[] = entry.filters;
  return ENTITY_FILTERS.some(
    (key) => accepted.includes(key) && filters[FILTER_PARAM[key]] !== undefined,
  );
}

/**
 * Lê a busca da URL para o relatório. Sem `period`, vale "Qualquer período" para quem chega
 * por uma entidade com `run=1` (como o `period: 'all'` do protótipo) e "Este mês" nos outros casos.
 */
export function parseReportSearch(report_id: string, raw: Record<string, unknown>): ReportSearch {
  const filters = readFilters(report_id, raw);
  const run = pick(raw, 'run') === '1';
  const from_module = pick(raw, 'from_module');
  const base = { filters, run, ...(from_module ? { from_module } : {}) };
  if (!hasPeriod(report_id)) return { ...base, period: 'this_month' };

  const fallback: PeriodPreset = run && comesFromEntity(report_id, filters) ? 'all' : 'this_month';
  const period = pick(raw, 'period') ?? fallback;
  if (period !== 'custom') return { ...base, period };
  const from = pick(raw, 'from');
  const to = pick(raw, 'to');
  if (from === undefined || to === undefined || from > to) return { ...base, period: fallback };
  return { ...base, period, from, to };
}

/** O valor do `PeriodField` para a busca lida. */
export function toPeriodValue(search: Pick<ReportSearch, 'period' | 'from' | 'to'>): PeriodValue {
  if (search.period === 'custom' && search.from !== undefined && search.to !== undefined) {
    return { preset: 'custom', from: search.from, to: search.to };
  }
  return { preset: search.period };
}

/** Os parâmetros do período que vão para a URL; `from` e `to` só existem no personalizado. */
export function fromPeriodValue(value: PeriodValue): {
  period: string;
  from: string | undefined;
  to: string | undefined;
} {
  const custom = value.preset === 'custom';
  return {
    period: value.preset,
    from: custom ? value.from : undefined,
    to: custom ? value.to : undefined,
  };
}

/** A data de hoje (`AAAA-MM-DD`) no fuso do usuário, a partir do relógio injetado. */
export function todayInTimeZone(now: Date, time_zone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: time_zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

/** Os parâmetros de `GET /reports/{report}`: sem `from_module` e `run`, e `emotion` vira `emotion_id`. */
export function apiParams(
  report_id: string,
  search: ReportSearch,
  today: string,
): Record<string, string> {
  const params: Record<string, string> = {};
  for (const [param, value] of Object.entries(search.filters)) {
    params[param === 'emotion' ? 'emotion_id' : param] = value;
  }
  if (!hasPeriod(report_id)) return params;
  const range = resolvePeriod(toPeriodValue(search), today);
  if (range) {
    params.from = range.from;
    params.to = range.to;
  }
  return params;
}

/** "Hoje" no fuso do usuário, lido uma vez por tela. */
export function useToday(): string {
  const { time_zone } = usePreferences();
  const [now] = useState(() => new Date());
  return useMemo(() => todayInTimeZone(now, time_zone), [now, time_zone]);
}

export interface SubmitValues {
  period?: PeriodValue;
  filters: ReportFilters;
}

/** Estado do relatório na URL ([project/frontend-13]): lê e grava período, filtros e `run`. */
export function useReportSearch(report_id: string) {
  const raw: Record<string, unknown> = useRouterState({
    select: (state) => state.location.search as Record<string, unknown>,
  });
  const navigate = useNavigate();
  const search = useMemo(() => parseReportSearch(report_id, raw), [report_id, raw]);

  const submit = useCallback(
    ({ period, filters }: SubmitValues) => {
      const range = period ? fromPeriodValue(period) : undefined;
      const cleared = Object.fromEntries(
        (Object.values(FILTER_PARAM) as FilterParam[]).map((param) => [
          param,
          filters[param] || undefined,
        ]),
      );
      void navigate({
        to: '.',
        replace: true,
        search: (previous: Record<string, unknown>) => ({
          ...previous,
          ...cleared,
          period: range?.period,
          from: range?.from,
          to: range?.to,
          run: 1,
        }),
      });
    },
    [navigate],
  );

  return { search, submit };
}
