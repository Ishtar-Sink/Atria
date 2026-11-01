import { act, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearToasts, getToasts } from '../../../shared/toast/toast-store';
import { account, mockApi, newClient, problem, renderFinanceHook } from '../test-utils';
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
  it('rf07 creates an account without card fields', async () => {
    const { calls } = mockApi({
      'GET /accounts': { body: { items: [MAIN] } },
      'POST /accounts': { hang: true },
    });
    const { result } = renderFinanceHook(useBoth(useCreateAccount));
    await waitFor(() => {
      expect(result.current.list.data).toHaveLength(1);
    });
    act(() => {
      result.current.action.mutate({ name: 'Reserva', visibility: 'personal' });
    });
    await waitFor(() => {
      expect(result.current.list.data).toHaveLength(2);
    });
    const optimistic = result.current.list.data?.[1];
    expect(optimistic?.name).toBe('Reserva');
    for (const key of ['kind', 'credit_limit_amount', 'closing_day', 'due_day']) {
      expect(optimistic).not.toHaveProperty(key);
    }
    expect(calls.find((call) => call.method === 'POST')?.body).toEqual({
      name: 'Reserva',
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
    const { calls } = mockApi({
      'GET /accounts': { body: { items: [MAIN, WALLET] } },
      'DELETE /accounts/:id': { hang: true },
    });
    const { result } = renderFinanceHook(useBoth(useDeleteAccount));
    await waitFor(() => {
      expect(result.current.list.data).toHaveLength(2);
    });
    expect(canDelete(WALLET)).toBe(true);
    act(() => {
      result.current.action.mutate({ id: 'a2' });
    });
    await waitFor(() => {
      expect(result.current.list.data?.map((item) => item.id)).toEqual(['a1']);
    });
    const remove = calls.find((call) => call.method === 'DELETE');
    expect(remove?.url.search).toBe('');
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
      await result.current.action.mutateAsync({ id: 'a1' }).catch(() => undefined);
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
      await result.current.action.mutateAsync({ id: 'a2' }).catch(() => undefined);
    });
    await waitFor(() => {
      expect(result.current.action.state).toBe('has_transactions');
    });
    expect(result.current.list.data).toHaveLength(2);
    expect(getToasts()).toHaveLength(0);
  });
  it('rf05 sends the destination account in move_to', async () => {
    const { calls } = mockApi({
      'GET /accounts': { body: { items: [MAIN, WALLET] } },
      'DELETE /accounts/:id': { status: 204 },
    });
    const { result } = renderFinanceHook(useBoth(useDeleteAccount));
    await waitFor(() => {
      expect(result.current.list.data).toHaveLength(2);
    });
    await act(() => result.current.action.mutateAsync({ id: 'a2', move_to: 'a1' }));
    const remove = calls.find((call) => call.method === 'DELETE');
    expect(remove?.path).toBe('/accounts/a2');
    expect(remove?.url.searchParams.get('move_to')).toBe('a1');
  });

  it('rf06 adds the balance of the deleted account to the destination right away', async () => {
    mockApi({
      'GET /accounts': {
        body: { items: [MAIN, account({ id: 'a2', name: 'Carteira', balance_amount: 5000 })] },
      },
      'DELETE /accounts/:id': { hang: true },
    });
    const { result } = renderFinanceHook(useBoth(useDeleteAccount));
    await waitFor(() => {
      expect(result.current.list.data).toHaveLength(2);
    });
    act(() => {
      result.current.action.mutate({ id: 'a2', move_to: 'a1' });
    });
    await waitFor(() => {
      expect(result.current.list.data?.map((item) => [item.id, item.balance_amount])).toEqual([
        ['a1', 6000],
      ]);
    });
  });

  it('rf06 refreshes transactions, transfers and balances after moving', async () => {
    mockApi({
      'GET /accounts': { body: { items: [MAIN, WALLET] } },
      'DELETE /accounts/:id': { status: 204 },
    });
    const client = newClient();
    const spy = vi.spyOn(client, 'invalidateQueries');
    const { result } = renderFinanceHook(useBoth(useDeleteAccount), client);
    await waitFor(() => {
      expect(result.current.list.data).toHaveLength(2);
    });
    await act(() => result.current.action.mutateAsync({ id: 'a2', move_to: 'a1' }));
    expect(spy).toHaveBeenCalledWith({ queryKey: ['finance'] });
  });

  it('rf05 keeps a destination in another currency inside the dialog', async () => {
    mockApi({
      'GET /accounts': {
        body: { items: [MAIN, account({ id: 'a2', name: 'Carteira', balance_amount: 5000 })] },
      },
      'DELETE /accounts/:id': problem(422, 'currency_mismatch'),
    });
    const { result } = renderFinanceHook(useBoth(useDeleteAccount));
    await waitFor(() => {
      expect(result.current.list.data).toHaveLength(2);
    });
    await act(async () => {
      await result.current.action.mutateAsync({ id: 'a2', move_to: 'a1' }).catch(() => undefined);
    });
    await waitFor(() => {
      expect(result.current.action.state).toBe('currency_mismatch');
    });
    expect(result.current.list.data?.map((item) => [item.id, item.balance_amount])).toEqual([
      ['a1', 1000],
      ['a2', 5000],
    ]);
    expect(getToasts()).toHaveLength(0);
  });
});
