import { act, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearToasts, getToasts } from '../../../shared/toast/toast-store';
import {
  account,
  item,
  mockApi,
  problem,
  renderFinanceHook,
  salary,
  transaction,
} from '../test-utils';
import type { Account } from './finance-cache';
import { useAccounts } from './use-accounts';
import {
  amountFields,
  editableFields,
  listItemHref,
  listItemKey,
  useCreateTransaction,
  useDeleteTransaction,
  useSettlementPreview,
  useSettleTransaction,
  useTransaction,
  useTransactions,
  useUndoSettlement,
  useUpdateTransaction,
} from './use-transactions';

const INSS_INPUT = {
  name: 'INSS',
  direction: 'deduction',
  mode: 'percent',
  rate_bp: 1100,
} as const;
const IRPF_INPUT = {
  name: 'IRPF',
  direction: 'deduction',
  mode: 'percent',
  rate_bp: 1500,
  base_amount: 712000,
} as const;

const ACCOUNT = account({ id: 'a1', name: 'Conta', balance_amount: 50000 });
const OPEN = transaction({ id: 't1', expected_amount: 10000, expected_date: '2026-11-10' });
const SETTLED = transaction({
  id: 't2',
  status: 'settled',
  settled_amount: 9000,
  settled_at: '2026-11-08',
  effective_date: '2026-11-08',
  difference_amount: -1000,
  difference_kind: 'saving',
});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-11-05T12:00:00Z') });
});

afterEach(() => {
  vi.useRealTimers();
  clearToasts();
  vi.unstubAllGlobals();
});

function balanceOf(list: Account[] | undefined) {
  return list?.find((entry) => entry.id === 'a1')?.balance_amount;
}

describe('useTransactions', () => {
  it('sends the search to the server as q', async () => {
    const { calls } = mockApi({ 'GET /transactions': { body: { items: [] } } });
    const { result } = renderFinanceHook(() =>
      useTransactions({ kind: 'expense', q: '  Aluguel  ', from: '2026-11-01', to: '2026-11-30' }),
    );
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    const params = calls[0]?.url.searchParams;
    expect(params?.get('q')).toBe('Aluguel');
    expect(params?.get('kind')).toBe('expense');
    expect(params?.get('from')).toBe('2026-11-01');
  });

  it('omits q when the search is empty', async () => {
    const { calls } = mockApi({ 'GET /transactions': { body: { items: [] } } });
    const { result } = renderFinanceHook(() => useTransactions({ q: '   ', repetition: 'all' }));
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    const params = calls[0]?.url.searchParams;
    expect(params?.has('q')).toBe(false);
    expect(params?.has('repetition')).toBe(false);
    expect(params?.has('from')).toBe(false);
  });

  it('lists virtual occurrences without id and links them to the recurrence', async () => {
    const virtual = item({
      id: null,
      recurrence_id: 'r1',
      occurrence_date: '2026-11-30',
      status: 'forecast',
    });
    mockApi({ 'GET /transactions': { body: { items: [virtual, OPEN] } } });
    const { result } = renderFinanceHook(() => useTransactions({ repetition: 'recurring' }));
    await waitFor(() => {
      expect(result.current.items).toHaveLength(2);
    });
    expect(listItemKey(virtual)).toBe('r1:2026-11-30');
    expect(listItemHref(virtual)).toBe('/finance/recurring-transactions/r1');
    expect(listItemHref(OPEN)).toBe('/finance/transactions/t1');
  });
});

describe('transaction mutations', () => {
  it('sends the same idempotency key when retrying', async () => {
    let attempts = 0;
    const { calls } = mockApi({
      'POST /transactions': () => {
        attempts += 1;
        return attempts === 1
          ? problem(0, 'network_error')
          : { status: 201, body: { items: [OPEN] } };
      },
    });
    const { result } = renderFinanceHook(() => useCreateTransaction());
    const variables = {
      idempotency_key: 'key-1',
      input: {
        kind: 'expense' as const,
        account_id: 'a1',
        expected_amount: 10000,
        expected_date: '2026-11-10',
      },
    };
    await act(async () => {
      await result.current.mutateAsync(variables).catch(() => undefined);
    });
    await act(() => result.current.mutateAsync(variables));
    const keys = calls.map((call) => call.headers['Idempotency-Key']);
    expect(keys).toEqual(['key-1', 'key-1']);
  });

  it('updates only the changed fields', async () => {
    const { calls } = mockApi({
      'GET /transactions/:id': { body: OPEN },
      'PATCH /transactions/:id': (call) => ({
        body: { ...OPEN, ...(call.body as object) },
      }),
    });
    const { result } = renderFinanceHook(() => ({
      detail: useTransaction('t1'),
      update: useUpdateTransaction('t1'),
    }));
    await waitFor(() => {
      expect(result.current.detail.data).toBeDefined();
    });
    await act(() => result.current.update.mutateAsync({ description: 'Feira' }));
    expect(calls.find((call) => call.method === 'PATCH')?.body).toEqual({ description: 'Feira' });
    await waitFor(() => {
      expect(result.current.detail.data?.description).toBe('Feira');
    });
  });

  it('rf07 limits the editable fields of a settled transaction', () => {
    expect(editableFields(SETTLED)).toEqual(['description', 'category_id', 'visibility']);
    expect(editableFields(OPEN)).toEqual([
      'description',
      'expected_amount',
      'expected_date',
      'account_id',
      'category_id',
      'visibility',
      'gross_amount',
      'adjustments',
    ]);
  });

  it('rolls back the edit and shows the error when refused', async () => {
    mockApi({
      'GET /transactions/:id': { body: SETTLED },
      'PATCH /transactions/:id': problem(409, 'transaction_already_settled'),
    });
    const { result } = renderFinanceHook(() => ({
      detail: useTransaction('t2'),
      update: useUpdateTransaction('t2'),
    }));
    await waitFor(() => {
      expect(result.current.detail.data).toBeDefined();
    });
    await act(async () => {
      await result.current.update.mutateAsync({ expected_amount: 1 }).catch(() => undefined);
    });
    expect(result.current.detail.data?.expected_amount).toBe(10000);
    await waitFor(() => {
      expect(result.current.update.error).toBeTruthy();
    });
  });

  it('settles optimistically and keeps the server difference', async () => {
    let release: () => void = () => undefined;
    const answered = new Promise<void>((resolve) => {
      release = resolve;
    });
    const settled = { ...OPEN, status: 'settled', settled_amount: 8000, settled_at: '2026-11-05' };
    let account_reads = 0;
    mockApi({
      'GET /accounts': () => {
        account_reads += 1;
        const balance = account_reads === 1 ? 50000 : 42000;
        return { body: { items: [{ ...ACCOUNT, balance_amount: balance }] } };
      },
      'GET /transactions/:id': { body: OPEN },
      'POST /transactions/:id/settlement': async () => {
        await answered;
        return { body: { ...settled, difference_amount: -2000, difference_kind: 'saving' } };
      },
    });
    const { result, client } = renderFinanceHook(() => ({
      accounts: useAccounts(),
      detail: useTransaction('t1'),
      settle: useSettleTransaction(),
    }));
    await waitFor(() => {
      expect(result.current.detail.data && result.current.accounts.data).toBeTruthy();
    });
    act(() => {
      result.current.settle.mutate({
        transaction: OPEN,
        settled_amount: 8000,
        settled_at: '2026-11-05',
        idempotency_key: 'k',
      });
    });
    await waitFor(() => {
      expect(result.current.detail.data?.status).toBe('settled');
    });
    expect(result.current.detail.data?.difference_kind).toBe('saving');
    expect(balanceOf(result.current.accounts.data)).toBe(50000 - 8000);
    release();
    await waitFor(() => {
      expect(result.current.settle.isSuccess).toBe(true);
    });
    expect(
      client.getQueryData<{ difference_amount: number }>(['finance', 'transaction', 't1'])
        ?.difference_amount,
    ).toBe(-2000);
  });

  it('rolls back the settlement and warns when refused', async () => {
    mockApi({
      'GET /accounts': { body: { items: [ACCOUNT] } },
      'GET /transactions/:id': { body: OPEN },
      'POST /transactions/:id/settlement': problem(409, 'transaction_already_settled'),
    });
    const { result } = renderFinanceHook(() => ({
      accounts: useAccounts(),
      detail: useTransaction('t1'),
      settle: useSettleTransaction(),
    }));
    await waitFor(() => {
      expect(result.current.detail.data && result.current.accounts.data).toBeTruthy();
    });
    await act(async () => {
      await result.current.settle
        .mutateAsync({
          transaction: OPEN,
          settled_amount: 8000,
          settled_at: '2026-11-05',
          idempotency_key: 'k',
        })
        .catch(() => undefined);
    });
    expect(result.current.detail.data?.status).toBe('open');
    expect(balanceOf(result.current.accounts.data)).toBe(50000);
    expect(getToasts().map((toast) => toast.message_key)).toContain(
      'finance.errors.transaction_already_settled',
    );
  });

  it('undoes a settlement optimistically and reverts the cached balance', async () => {
    mockApi({
      'GET /accounts': { body: { items: [ACCOUNT] } },
      'GET /transactions/:id': { body: SETTLED },
      'DELETE /transactions/:id/settlement': { hang: true },
    });
    const { result } = renderFinanceHook(() => ({
      accounts: useAccounts(),
      detail: useTransaction('t2'),
      undo: useUndoSettlement('t2', { time_zone: 'America/Sao_Paulo' }),
    }));
    await waitFor(() => {
      expect(result.current.detail.data && result.current.accounts.data).toBeTruthy();
    });
    act(() => {
      result.current.undo.mutate(SETTLED);
    });
    await waitFor(() => {
      expect(result.current.detail.data?.status).toBe('open');
    });
    expect(result.current.detail.data?.settled_amount).toBeNull();
    expect(result.current.detail.data?.difference_kind).toBeNull();
    expect(balanceOf(result.current.accounts.data)).toBe(50000 + 9000);
  });

  it('undoing the settlement of a recurring copy removes it and refreshes the recurrence', async () => {
    const copy = { ...SETTLED, id: 't9', generated_from: 'r1', recurrence_id: 'r1' };
    let recurrence_reads = 0;
    let list_reads = 0;
    mockApi({
      'GET /transactions': () => {
        list_reads += 1;
        return { body: { items: list_reads === 1 ? [copy] : [] } };
      },
      'GET /transactions/:id': { body: copy },
      'GET /recurring-transactions/:id': () => {
        recurrence_reads += 1;
        return { body: { id: 'r1' } };
      },
      'DELETE /transactions/:id/settlement': { status: 204 },
    });
    const { result, client } = renderFinanceHook(() => ({
      list: useTransactions({}),
      detail: useTransaction('t9'),
      undo: useUndoSettlement('t9', { time_zone: 'UTC' }),
    }));
    await waitFor(() => {
      expect(result.current.detail.data).toBeDefined();
    });
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    act(() => {
      result.current.undo.mutate(copy);
    });
    // Não otimista: a cópia continua liquidada até o servidor responder.
    expect(result.current.detail.data?.status).toBe('settled');
    await waitFor(() => {
      expect(result.current.undo.isSuccess).toBe(true);
    });
    await waitFor(() => {
      expect(result.current.list.items).toHaveLength(0);
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['finance', 'recurring', 'r1'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['finance', 'recurring', 'r1', 'copies'] });
    expect(recurrence_reads).toBe(0);
  });

  it('deletes a settled transaction and reverts the cached balance', async () => {
    mockApi({
      'GET /accounts': { body: { items: [ACCOUNT] } },
      'GET /transactions': { body: { items: [SETTLED, OPEN] } },
      'GET /transactions/:id': { body: SETTLED },
      'DELETE /transactions/:id': { hang: true },
    });
    const { result } = renderFinanceHook(() => ({
      list: useTransactions({}),
      accounts: useAccounts(),
      detail: useTransaction('t2'),
      remove: useDeleteTransaction(),
    }));
    await waitFor(() => {
      expect(result.current.list.items.length && result.current.accounts.data).toBeTruthy();
    });
    act(() => {
      result.current.remove.mutate({ id: 't2' });
    });
    await waitFor(() => {
      expect(balanceOf(result.current.accounts.data)).toBe(50000 + 9000);
    });
    expect(result.current.list.items.map((entry) => entry.id)).toEqual(['t1']);
  });

  it('refreshes the recurrence after deleting a settled copy', async () => {
    const copy = { ...SETTLED, id: 't9', generated_from: 'r1' };
    mockApi({
      'GET /transactions/:id': { body: copy },
      'DELETE /transactions/:id': { status: 204 },
    });
    const { result, client } = renderFinanceHook(() => ({
      detail: useTransaction('t9'),
      remove: useDeleteTransaction(),
    }));
    await waitFor(() => {
      expect(result.current.detail.data).toBeDefined();
    });
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    await act(() => result.current.remove.mutateAsync({ id: 't9' }));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['finance', 'recurring', 'r1'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['finance', 'summary'] });
  });

  it('rf09 asks the server for the settlement preview', async () => {
    const preview = {
      gross_amount: 859220,
      net_amount: 650000,
      adjustments: [{ ...INSS_INPUT, computed_amount: 94514 }],
    };
    const { calls } = mockApi({
      'POST /transactions/settlement-preview': { body: preview },
    });
    const input = {
      settled_amount: 650000,
      adjustments: [INSS_INPUT, IRPF_INPUT],
      expected_gross_amount: 800000,
    };
    const { result } = renderFinanceHook(() => useSettlementPreview(input));
    await waitFor(() => {
      expect(result.current.data).toEqual(preview);
    });
    const post = calls.find((call) => call.path === '/transactions/settlement-preview');
    expect(post?.method).toBe('POST');
    expect(post?.body).toEqual(input);
  });

  it('does not ask for a settlement preview without input', async () => {
    const { calls } = mockApi({});
    const { result } = renderFinanceHook(() => useSettlementPreview(null));
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.fetchStatus).toBe('idle');
    expect(calls).toHaveLength(0);
  });

  it('rf10 sends the edited items with the settlement', async () => {
    const { calls } = mockApi({
      'POST /transactions/:id/settlement': { body: { ...OPEN, status: 'settled' } },
    });
    const { result } = renderFinanceHook(() => useSettleTransaction());
    await act(() =>
      result.current.mutateAsync({
        transaction: OPEN,
        settled_amount: 8000,
        settled_at: '2026-11-05',
        adjustments: [INSS_INPUT],
        idempotency_key: 'k',
      }),
    );
    expect(calls.find((call) => call.method === 'POST')?.body).toEqual({
      settled_amount: 8000,
      settled_at: '2026-11-05',
      adjustments: [INSS_INPUT],
    });
  });

  it('rf13 sends gross and items only when the transaction has items', () => {
    expect(amountFields(5000, [], false)).toEqual({ expected_amount: 5000 });
    expect(amountFields(5000, [INSS_INPUT], false)).toEqual({
      gross_amount: 5000,
      adjustments: [INSS_INPUT],
    });
    expect(amountFields(5000, [], true)).toEqual({ gross_amount: 5000, adjustments: [] });
  });

  it('updates the cached net right away when the items change', async () => {
    mockApi({
      'GET /transactions/:id': { body: salary() },
      'PATCH /transactions/:id': { hang: true },
    });
    const { result } = renderFinanceHook(() => ({
      detail: useTransaction('t20'),
      update: useUpdateTransaction('t20'),
    }));
    await waitFor(() => {
      expect(result.current.detail.data).toBeDefined();
    });
    act(() => {
      result.current.update.mutate({ adjustments: [INSS_INPUT] });
    });
    await waitFor(() => {
      expect(result.current.detail.data?.expected_amount).toBe(712000);
    });
    expect(result.current.detail.data?.gross_amount).toBe(800000);
  });
});
