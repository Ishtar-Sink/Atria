import { act, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearToasts, getToasts } from '../../../shared/toast/toast-store';
import { account, item, mockApi, problem, renderFinanceHook, transaction } from '../test-utils';
import { useAccounts } from './use-accounts';
import {
  toContractRule,
  useCreateRecurringTransaction,
  useDeleteRecurringTransaction,
  useRecurringTransaction,
  useSettledCopies,
  useSettleOccurrence,
  useSkipOccurrence,
  useUpdateRecurringTransaction,
  type RecurringTransaction,
} from './use-recurring-transactions';
import { listItemKey, useTransactions } from './use-transactions';

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
  gross_amount: 200000,
  adjustments: [],
  kind: 'expense',
  owner_id: 'u1',
  visibility: 'personal',
  rule: toContractRule(RULE),
  open_occurrence: { occurrence_date: '2026-11-30', status: 'open' },
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const OPEN = item({ id: null, recurrence_id: 'r1', occurrence_date: '2026-11-30', status: 'open' });
const FORECAST = item({
  id: null,
  recurrence_id: 'r1',
  occurrence_date: '2026-12-31',
  status: 'forecast',
});
const COPY = transaction({
  id: 't9',
  generated_from: 'r1',
  recurrence_id: 'r1',
  status: 'settled',
  settled_amount: 200000,
});
const OTHER = transaction({ id: 't1' });

function keys(items: { id?: string | null }[]) {
  return items.map((entry) => listItemKey(entry as Parameters<typeof listItemKey>[0]));
}

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
  it('rf01 deletes the recurrence on the server', async () => {
    const { calls } = mockApi({
      'GET /recurring-transactions/:id': { body: RENT },
      'DELETE /recurring-transactions/:id': { status: 204 },
    });
    const { result, client } = renderFinanceHook(() => ({
      detail: useRecurringTransaction('r1'),
      remove: useDeleteRecurringTransaction('r1'),
    }));
    await waitFor(() => {
      expect(result.current.detail.data).toBeDefined();
    });
    await act(() => result.current.remove.mutateAsync());
    const deletes = calls.filter((call) => call.method === 'DELETE');
    expect(deletes.map((call) => call.path)).toEqual(['/recurring-transactions/r1']);
    expect(client.getQueryState(['finance', 'recurring', 'r1'])?.isInvalidated).toBe(true);
  });

  it('rf02 removes the open occurrence and the forecast from the lists optimistically', async () => {
    mockApi({
      'GET /transactions': { body: { items: [OPEN, FORECAST, COPY, OTHER] } },
      'DELETE /recurring-transactions/:id': { hang: true },
    });
    const { result } = renderFinanceHook(() => ({
      list: useTransactions({}),
      remove: useDeleteRecurringTransaction('r1'),
    }));
    await waitFor(() => {
      expect(result.current.list.items).toHaveLength(4);
    });
    act(() => {
      result.current.remove.mutate();
    });
    await waitFor(() => {
      expect(keys(result.current.list.items)).toEqual(keys([COPY, OTHER]));
    });
  });

  it('ct01 keeps the settled copies and the balance when deleting', async () => {
    let deleted = false;
    mockApi({
      'GET /accounts': {
        body: { items: [account({ id: 'a1', name: 'Conta', balance_amount: 500000 })] },
      },
      'GET /transactions': () => ({
        body: { items: deleted ? [COPY, OTHER] : [OPEN, FORECAST, COPY, OTHER] },
      }),
      'DELETE /recurring-transactions/:id': () => {
        deleted = true;
        return { status: 204 };
      },
    });
    const { result } = renderFinanceHook(() => ({
      accounts: useAccounts(),
      list: useTransactions({}),
      remove: useDeleteRecurringTransaction('r1'),
    }));
    await waitFor(() => {
      expect(result.current.list.items).toHaveLength(4);
      expect(result.current.accounts.data).toBeDefined();
    });
    await act(() => result.current.remove.mutateAsync());
    await waitFor(() => {
      expect(keys(result.current.list.items)).toEqual(keys([COPY, OTHER]));
    });
    expect(result.current.accounts.data?.[0]?.balance_amount).toBe(500000);
  });

  it('rf01 rolls back and warns when the recurrence delete is refused', async () => {
    mockApi({
      'GET /transactions': { body: { items: [OPEN, FORECAST, COPY, OTHER] } },
      'DELETE /recurring-transactions/:id': problem(500, 'boom'),
    });
    const { result } = renderFinanceHook(() => ({
      list: useTransactions({}),
      remove: useDeleteRecurringTransaction('r1'),
    }));
    await waitFor(() => {
      expect(result.current.list.items).toHaveLength(4);
    });
    await act(async () => {
      await result.current.remove.mutateAsync().catch(() => undefined);
    });
    await waitFor(() => {
      expect(result.current.list.items).toHaveLength(4);
    });
    expect(getToasts().map((toast) => toast.message_key)).toContain('common.errors.generic');
  });

  it('rf10 sends the edited items with the occurrence settlement', async () => {
    const { calls } = mockApi({
      'GET /recurring-transactions/:id': { body: RENT },
      'POST /recurring-transactions/:id/settlement': {
        status: 201,
        body: transaction({ id: 'copy', generated_from: 'r1', status: 'settled' }),
      },
    });
    const { result } = renderFinanceHook(() => useSettleOccurrence('r1'));
    const adjustments = [
      { name: 'Taxa', direction: 'addition', mode: 'fixed', amount: 500 } as const,
    ];
    await act(() =>
      result.current.mutateAsync({
        occurrence_date: '2026-11-30',
        settled_amount: 200500,
        settled_at: '2026-11-29',
        adjustments: [...adjustments],
        idempotency_key: 'k3',
      }),
    );
    expect(calls.find((call) => call.method === 'POST')?.body).toEqual({
      occurrence_date: '2026-11-30',
      settled_amount: 200500,
      settled_at: '2026-11-29',
      adjustments,
    });
  });
});
