import { describe, expect, it } from 'vitest';
import {
  FINANCE_PERIOD_PRESETS,
  financePeriodSearchSchema,
  fromPeriodValue,
  periodSearch,
  resolveFinancePeriod,
  todayInTimeZone,
  toPeriodValue,
} from './finance-period';

// 2026-03-01 02:30 UTC: ainda é 28/02 em São Paulo (UTC-3).
const NOW = new Date('2026-03-01T02:30:00Z');

describe('finance period', () => {
  it('lists the six presets of the period field in its order', () => {
    expect(FINANCE_PERIOD_PRESETS).toEqual([
      'this_month',
      'last_month',
      'next_30_days',
      'last_30_days',
      'this_year',
      'all',
    ]);
  });

  it('defaults to this month in the user timezone', () => {
    const search = financePeriodSearchSchema.parse({});
    expect(search.period).toBe('this_month');
    expect(resolveFinancePeriod(search, NOW, 'America/Sao_Paulo')).toEqual({
      from: '2026-02-01',
      to: '2026-02-28',
    });
  });

  it('uses the user timezone for today', () => {
    expect(todayInTimeZone(NOW, 'America/Sao_Paulo')).toBe('2026-02-28');
    expect(todayInTimeZone(NOW, 'UTC')).toBe('2026-03-01');
    expect(todayInTimeZone(NOW, 'Asia/Tokyo')).toBe('2026-03-01');
  });

  it('any period has no from and to', () => {
    const search = financePeriodSearchSchema.parse({ period: 'all' });
    expect(resolveFinancePeriod(search, NOW, 'UTC')).toBeNull();
    expect(fromPeriodValue({ preset: 'all' })).toEqual({ period: 'all' });
  });

  it('falls back to this month when the custom range is incomplete', () => {
    const only_from = financePeriodSearchSchema.parse({ period: 'custom', from: '2026-01-10' });
    expect(toPeriodValue(only_from)).toEqual({ preset: 'this_month' });
    const reversed = financePeriodSearchSchema.parse({
      period: 'custom',
      from: '2026-02-10',
      to: '2026-01-10',
    });
    expect(toPeriodValue(reversed)).toEqual({ preset: 'this_month' });
    const complete = financePeriodSearchSchema.parse({
      period: 'custom',
      from: '2026-01-10',
      to: '2026-02-10',
    });
    expect(toPeriodValue(complete)).toEqual({
      preset: 'custom',
      from: '2026-01-10',
      to: '2026-02-10',
    });
    expect(resolveFinancePeriod(complete, NOW, 'UTC')).toEqual({
      from: '2026-01-10',
      to: '2026-02-10',
    });
  });

  it('refuses dates outside the AAAA-MM-DD format', () => {
    expect(
      financePeriodSearchSchema.safeParse({ period: 'custom', from: '10/01/2026' }).success,
    ).toBe(false);
  });

  it('writes the period field value to the url params', () => {
    expect(fromPeriodValue({ preset: 'last_month' })).toEqual({ period: 'last_month' });
    expect(fromPeriodValue({ preset: 'custom', from: '2026-01-01', to: '2026-01-31' })).toEqual({
      period: 'custom',
      from: '2026-01-01',
      to: '2026-01-31',
    });
    // Sem `custom`, as datas antigas saem da URL.
    expect(fromPeriodValue({ preset: 'this_year', from: '2026-01-01', to: '2026-01-31' })).toEqual({
      period: 'this_year',
    });
  });

  it('keeps only the period params for the tab links', () => {
    expect(
      periodSearch({
        period: 'custom',
        from: '2026-01-01',
        to: '2026-01-31',
        q: 'aluguel',
        view: 'grid',
      }),
    ).toEqual({ period: 'custom', from: '2026-01-01', to: '2026-01-31' });
    expect(periodSearch({ period: 'this_month', category_id: 'x' })).toEqual({
      period: 'this_month',
    });
  });
});
