import { waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mockApi, renderFinanceHook } from '../test-utils';
import { useFinancialSummary } from './use-financial-summary';

const SUMMARY = {
  period: { from: '2026-11-01', to: '2026-11-30' },
  previous_period: { from: '2026-10-02', to: '2026-10-31' },
  totals: {
    income: { realized: 500000, forecast: 600000 },
    expense: { realized: 200000, forecast: 300000 },
    surplus: { realized: 300000, forecast: 300000 },
  },
  previous_totals: null,
  where_it_went: [],
  expected_vs_settled: {
    income: { expected_amount: 600000, settled_amount: 500000 },
    expense: { expected_amount: 300000, settled_amount: 200000 },
  },
  savings_and_losses: { savings_amount: 0, gains_amount: 0, losses_amount: 0 },
  balance: { current: 100000, forecast_at_period_end: null, accounts: [] },
  credit_cards: [],
  upcoming_bills: [],
  currency: 'BRL',
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useFinancialSummary', () => {
  it('reads the period summary from the server', async () => {
    const { calls } = mockApi({ 'GET /financial-summaries': { body: SUMMARY } });
    const { result } = renderFinanceHook(() =>
      useFinancialSummary({ from: '2026-11-01', to: '2026-11-30' }),
    );
    await waitFor(() => {
      expect(result.current.data?.totals.income.realized).toBe(500000);
    });
    const url = calls[0]?.url;
    expect(url?.searchParams.get('from')).toBe('2026-11-01');
    expect(url?.searchParams.get('to')).toBe('2026-11-30');
  });

  it('omits from and to for any period', async () => {
    const { calls } = mockApi({ 'GET /financial-summaries': { body: SUMMARY } });
    const { result } = renderFinanceHook(() => useFinancialSummary(null));
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(calls[0]?.url.search).toBe('');
  });
});
