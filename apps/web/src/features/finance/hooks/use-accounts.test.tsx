import { act, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearToasts, getToasts } from '../../../shared/toast/toast-store';
import { account, mockApi, problem, renderFinanceHook } from '../test-utils';
import {
  canDelete,
  useAccounts,
  useCreateAccount,
  useDeleteAccount,
  useRenameAccount,
} from './use-accounts';

const MAIN = account({ id: 'a1', name: 'Conta principal', is_default: true, balance_amount: 1000 });
const WALLET = account({ id: 'a2', name: 'Carteira' });

afterEach(() => {
  clearToasts();
  vi.unstubAllGlobals();
});

function useBoth<T>(hook: () => T) {
  return function useCombined() {
    return { list: useAccounts(), action: hook() };
  };
}

describe('accounts hooks', () => {
  it('creates a credit card with limit and days', async () => {
    const { calls } = mockApi({
      'GET /accounts': { body: { items: [MAIN] } },
      'POST /accounts': (call) => ({
        status: 201,
        body: account({ id: 'a3', name: 'Cartão', ...(call.body as object) }),
      }),
    });
    const { result } = renderFinanceHook(useBoth(useCreateAccount));
    await waitFor(() => {
      expect(result.current.list.data).toHaveLength(1);
    });
    await act(() =>
      result.current.action.mutateAsync({
        name: 'Cartão',
        kind: 'credit_card',
        credit_limit_amount: 500000,
        closing_day: 3,
        due_day: 10,
        visibility: 'personal',
      }),
    );
    expect(calls.find((call) => call.method === 'POST')?.body).toEqual({
      name: 'Cartão',
      kind: 'credit_card',
      credit_limit_amount: 500000,
      closing_day: 3,
      due_day: 10,
      visibility: 'personal',
    });
  });

  it('renames optimistically', async () => {
    mockApi({
      'GET /accounts': { body: { items: [MAIN, WALLET] } },
      'PATCH /accounts/:id': { hang: true },
    });
    const { result } = renderFinanceHook(useBoth(useRenameAccount));
    await waitFor(() => {
      expect(result.current.list.data).toHaveLength(2);
    });
    act(() => {
      result.current.action.mutate({ id: 'a2', patch: { name: 'Dinheiro' } });
    });
    await waitFor(() => {
      expect(result.current.list.data?.[1]?.name).toBe('Dinheiro');
    });
  });

  it('deletes a common account optimistically', async () => {
    mockApi({
      'GET /accounts': { body: { items: [MAIN, WALLET] } },
      'DELETE /accounts/:id': { hang: true },
    });
    const { result } = renderFinanceHook(useBoth(useDeleteAccount));
    await waitFor(() => {
      expect(result.current.list.data).toHaveLength(2);
    });
    expect(canDelete(WALLET)).toBe(true);
    act(() => {
      result.current.action.mutate('a2');
    });
    await waitFor(() => {
      expect(result.current.list.data?.map((item) => item.id)).toEqual(['a1']);
    });
  });

  it('rolls back and warns when the default account delete is refused', async () => {
    let served = 0;
    mockApi({
      'GET /accounts': () => {
        served += 1;
        return { body: { items: [MAIN, WALLET] } };
      },
      'DELETE /accounts/:id': problem(409, 'default_account_not_deletable'),
    });
    expect(canDelete(MAIN)).toBe(false);
    const { result } = renderFinanceHook(useBoth(useDeleteAccount));
    await waitFor(() => {
      expect(result.current.list.data).toHaveLength(2);
    });
    await act(async () => {
      await result.current.action.mutateAsync('a1').catch(() => undefined);
    });
    expect(result.current.list.data?.map((item) => item.id)).toEqual(['a1', 'a2']);
    expect(getToasts().map((toast) => toast.message_key)).toContain(
      'finance.errors.default_account_not_deletable',
    );
    expect(served).toBeGreaterThanOrEqual(1);
  });

  it('reports an account that still has transactions', async () => {
    mockApi({
      'GET /accounts': { body: { items: [MAIN, WALLET] } },
      'DELETE /accounts/:id': problem(409, 'account_has_transactions'),
    });
    const { result } = renderFinanceHook(useBoth(useDeleteAccount));
    await waitFor(() => {
      expect(result.current.list.data).toHaveLength(2);
    });
    await act(async () => {
      await result.current.action.mutateAsync('a2').catch(() => undefined);
    });
    await waitFor(() => {
      expect(result.current.action.state).toBe('has_transactions');
    });
    expect(result.current.list.data).toHaveLength(2);
    expect(getToasts()).toHaveLength(0);
  });
});
