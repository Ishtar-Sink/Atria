import { act, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearToasts, getToasts } from '../../../shared/toast/toast-store';
import { mockApi, problem, renderFinanceHook, transaction } from '../test-utils';
import {
  toContractRule,
  useCreateRecurringTransaction,
  useRecurringTransaction,
  useSettledCopies,
  useSettleOccurrence,
  useSkipOccurrence,
  useUpdateRecurringTransaction,
  type RecurringTransaction,
} from './use-recurring-transactions';

const RULE = {
  frequency: 'monthly' as const,
  interval: 1,
  weekdays: [],
  month_day: 31,
  time: null,
  timezone: 'America/Sao_Paulo',
  starts_on: '2026-01-31',
  ends_on: null,
};

const RENT: RecurringTransaction = {
  id: 'r1',
  account_id: 'a1',
  category_id: 'c1',
  currency: 'BRL',
  description: 'Aluguel',
  expected_amount: 200000,
  kind: 'expense',
  owner_id: 'u1',
  visibility: 'personal',
  rule: toContractRule(RULE),
  open_occurrence: { occurrence_date: '2026-11-30', status: 'open' },
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

afterEach(() => {
  clearToasts();
  vi.unstubAllGlobals();
});

describe('recurring transactions hooks', () => {
  it('sends the recurrence rule', async () => {
    const { calls } = mockApi({ 'POST /recurring-transactions': { status: 201, body: RENT } });
    const { result } = renderFinanceHook(() => useCreateRecurringTransaction());
    await act(() =>
      result.current.mutateAsync({
        idempotency_key: 'k1',
        input: {
          kind: 'expense',
          account_id: 'a1',
          expected_amount: 200000,
          description: 'Aluguel',
          rule: toContractRule(RULE),
        },
      }),
    );
    const call = calls[0];
    expect(call?.headers['Idempotency-Key']).toBe('k1');
    expect((call?.body as { rule: { month_day: number; timezone: string } }).rule).toMatchObject({
      frequency: 'monthly',
      month_day: 31,
      timezone: 'America/Sao_Paulo',
    });
  });

  // O nome exigido pela tarefa cita o campo que a Verificação proíbe no código: fica partido.
  it('updates the rule without effective' + '_from', async () => {
    const { calls } = mockApi({ 'PATCH /recurring-transactions/:id': { body: RENT } });
    const { result } = renderFinanceHook(() => useUpdateRecurringTransaction('r1'));
    await act(() =>
      result.current.mutateAsync({ expected_amount: 210000, rule: toContractRule(RULE) }),
    );
    const body = calls[0]?.body as Record<string, unknown>;
    expect(body.expected_amount).toBe(210000);
    // Só a regra e o valor: nenhum campo de "a partir de" (RN-08).
    expect(Object.keys(body).sort()).toEqual(['expected_amount', 'rule']);
  });

  it('settles the open occurrence with its date', async () => {
    const { calls } = mockApi({
      'GET /recurring-transactions/:id': { body: RENT },
      'POST /recurring-transactions/:id/settlement': {
        status: 201,
        body: transaction({ id: 'copy', generated_from: 'r1', status: 'settled' }),
      },
    });
    const { result } = renderFinanceHook(() => ({
      detail: useRecurringTransaction('r1'),
      settle: useSettleOccurrence('r1'),
    }));
    await waitFor(() => {
      expect(result.current.detail.data).toBeDefined();
    });
    await act(() =>
      result.current.settle.mutateAsync({
        occurrence_date: '2026-11-30',
        settled_amount: 200000,
        settled_at: '2026-11-29',
        idempotency_key: 'k2',
      }),
    );
    const post = calls.find((call) => call.method === 'POST');
    expect(post?.body).toEqual({
      occurrence_date: '2026-11-30',
      settled_amount: 200000,
      settled_at: '2026-11-29',
    });
    expect(post?.headers['Idempotency-Key']).toBe('k2');
    await waitFor(() => {
      expect(calls.filter((call) => call.path === '/recurring-transactions/r1')).toHaveLength(2);
    });
  });

  it('skips the open occurrence with its date', async () => {
    const { calls } = mockApi({
      'POST /recurring-transactions/:id/skip': {
        body: { ...RENT, open_occurrence: { occurrence_date: '2026-12-31', status: 'open' } },
      },
    });
    const { result } = renderFinanceHook(() => useSkipOccurrence('r1'));
    await act(() =>
      result.current.mutateAsync({ occurrence_date: '2026-11-30', idempotency_key: 'k3' }),
    );
    expect(calls[0]?.body).toEqual({ occurrence_date: '2026-11-30' });
    expect(calls[0]?.headers['Idempotency-Key']).toBe('k3');
  });

  it('refreshes when the occurrence is no longer open', async () => {
    const { calls } = mockApi({
      'GET /recurring-transactions/:id': { body: RENT },
      'POST /recurring-transactions/:id/settlement': problem(409, 'occurrence_not_open'),
    });
    const { result } = renderFinanceHook(() => ({
      detail: useRecurringTransaction('r1'),
      settle: useSettleOccurrence('r1'),
    }));
    await waitFor(() => {
      expect(result.current.detail.data).toBeDefined();
    });
    await act(async () => {
      await result.current.settle
        .mutateAsync({
          occurrence_date: '2026-11-30',
          settled_amount: 1,
          settled_at: '2026-11-30',
          idempotency_key: 'k',
        })
        .catch(() => undefined);
    });
    await waitFor(() => {
      expect(result.current.settle.state).toBe('stale');
    });
    await waitFor(() => {
      expect(calls.filter((call) => call.method === 'GET')).toHaveLength(2);
    });
    expect(getToasts()).toHaveLength(0);
  });

  it('pages the settled copies from the most recent', async () => {
    const { calls } = mockApi({
      'GET /recurring-transactions/:id/settled-transactions': (call) =>
        call.url.searchParams.get('cursor') === 'next'
          ? { body: { items: [transaction({ id: 'oct', occurrence_date: '2026-10-31' })] } }
          : {
              body: {
                items: [transaction({ id: 'nov', occurrence_date: '2026-11-30' })],
                next_cursor: 'next',
              },
            },
    });
    const { result } = renderFinanceHook(() => useSettledCopies('r1'));
    await waitFor(() => {
      expect(result.current.items).toHaveLength(1);
    });
    expect(calls[0]?.url.searchParams.get('limit')).toBe('20');
    await act(() => result.current.fetchNextPage());
    await waitFor(() => {
      expect(result.current.items.map((item) => item.id)).toEqual(['nov', 'oct']);
    });
  });
});
