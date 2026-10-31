import { resolvePeriod, type PeriodPreset, type PeriodRange, type PeriodValue } from '@atria/ui';
import { z } from 'zod';

/** Os seis presets do `PeriodField`, na ordem dele (PD-55); o cálculo é do `resolvePeriod`. */
export const FINANCE_PERIOD_PRESETS: readonly PeriodPreset[] = [
  'this_month',
  'last_month',
  'next_30_days',
  'last_30_days',
  'this_year',
  'all',
];

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

export const financePeriodSearchSchema = z.object({
  period: z
    .enum([
      'this_month',
      'last_month',
      'next_30_days',
      'last_30_days',
      'this_year',
      'all',
      'custom',
    ])
    .default('this_month'),
  from: z.string().regex(ISO_DAY).optional(),
  to: z.string().regex(ISO_DAY).optional(),
});

export type FinancePeriodSearch = z.output<typeof financePeriodSearchSchema>;

export interface FinancePeriodParams {
  period: PeriodValue['preset'];
  from?: string;
  to?: string;
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

/** O valor do `PeriodField`; o personalizado incompleto ou invertido volta a "Este mês". */
export function toPeriodValue(search: Partial<FinancePeriodSearch>): PeriodValue {
  const period = search.period ?? 'this_month';
  if (period !== 'custom') return { preset: period };
  const { from, to } = search;
  if (from === undefined || to === undefined || from > to) return { preset: 'this_month' };
  return { preset: 'custom', from, to };
}

/** `{ from, to }` do período, ou `null` em "Qualquer período" (sem datas, DEC-004). */
export function resolveFinancePeriod(
  search: Partial<FinancePeriodSearch>,
  now: Date,
  time_zone: string,
): PeriodRange | null {
  return resolvePeriod(toPeriodValue(search), todayInTimeZone(now, time_zone));
}

/** Parâmetros gravados na URL pelo `onChange` do `PeriodField`. */
export function fromPeriodValue(value: PeriodValue): FinancePeriodParams {
  if (value.preset !== 'custom') return { period: value.preset };
  return {
    period: 'custom',
    ...(value.from === undefined ? {} : { from: value.from }),
    ...(value.to === undefined ? {} : { to: value.to }),
  };
}

/** Só o período, para os links das abas levarem a escolha ao trocar de aba. */
export function periodSearch(search: Record<string, unknown>): FinancePeriodParams {
  const parsed = financePeriodSearchSchema.safeParse({
    period: search.period,
    from: search.from,
    to: search.to,
  });
  const value = parsed.success ? parsed.data : financePeriodSearchSchema.parse({});
  return fromPeriodValue(
    value.period === 'custom'
      ? {
          preset: 'custom',
          ...(value.from === undefined ? {} : { from: value.from }),
          ...(value.to === undefined ? {} : { to: value.to }),
        }
      : { preset: value.period },
  );
}

/**
 * Texto da URL: o roteador entrega números quando o valor parece um ("?q=123"); vazio ou
 * inválido vira `''`.
 */
export function searchText(max = 200) {
  return z
    .preprocess((value) => (typeof value === 'number' ? String(value) : value), z.string().max(max))
    .catch('');
}
