import type { Schemas } from '@atria/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../shared/api/client';
import {
  adjustBalance,
  cancel,
  financeKeys,
  problemCode,
  readAll,
  restore,
  snapshot,
  warnRefusal,
  type Account,
  type Page,
  type Snapshot,
} from './finance-cache';

export type { Account } from './finance-cache';
export type CreateAccountInput = Schemas['CreateAccountRequest'];
export type UpdateAccountInput = Schemas['UpdateAccountRequest'];

/** A conta padrão nunca é excluída (CB-01); o banco também garante. */
export function canDelete(account: Pick<Account, 'is_default'>): boolean {
  return !account.is_default;
}

export function useAccounts() {
  return useQuery({
    queryKey: financeKeys.accounts,
    queryFn: ({ signal }) =>
      readAll((cursor) =>
        api.get<Page<Account>>('/accounts', { query: { cursor, limit: 100 }, signal }),
      ),
  });
}

export function useAccount(id: string | undefined) {
  return useQuery({
    queryKey: financeKeys.account(id ?? ''),
    queryFn: ({ signal }) => api.get<Account>(`/accounts/${id ?? ''}`, { signal }),
    enabled: id !== undefined && id !== '',
  });
}

const OPTIMISTIC_PREFIX = 'optimistic-';

export function useCreateAccount() {
  const client = useQueryClient();
  return useMutation<Account, Error, CreateAccountInput, { saved: Snapshot }>({
    mutationFn: (input) => api.post<Account>('/accounts', input),
    onMutate: async (input) => {
      await cancel(client, [financeKeys.accounts]);
      const saved = snapshot(client, [financeKeys.accounts]);
      const now = new Date().toISOString();
      const draft: Account = {
        id: `${OPTIMISTIC_PREFIX}${crypto.randomUUID()}`,
        name: input.name,
        balance_amount: 0,
        currency: '',
        is_default: false,
        owner_id: '',
        visibility: input.visibility ?? 'personal',
        created_at: now,
        updated_at: now,
      };
      client.setQueryData<Account[]>(financeKeys.accounts, (list) =>
        list ? [...list, draft] : list,
      );
      return { saved };
    },
    onError: (error, _input, context) => {
      restore(client, context?.saved);
      warnRefusal(error);
    },
    onSuccess: (account) => {
      client.setQueryData(financeKeys.account(account.id), account);
    },
    onSettled: () => client.invalidateQueries({ queryKey: financeKeys.accounts }),
  });
}

export interface RenameAccountInput {
  id: string;
  patch: UpdateAccountInput;
}

export function useRenameAccount() {
  const client = useQueryClient();
  return useMutation<Account, Error, RenameAccountInput, { saved: Snapshot }>({
    mutationFn: ({ id, patch }) => api.patch<Account>(`/accounts/${id}`, patch),
    onMutate: async ({ id, patch }) => {
      const keys = [financeKeys.accounts, financeKeys.account(id)];
      await cancel(client, keys);
      const saved = snapshot(client, keys);
      const apply = (account: Account): Account => ({
        ...account,
        ...(patch.name ? { name: patch.name } : {}),
        ...(patch.visibility ? { visibility: patch.visibility } : {}),
      });
      client.setQueryData<Account[]>(financeKeys.accounts, (list) =>
        list?.map((account) => (account.id === id ? apply(account) : account)),
      );
      client.setQueryData<Account>(financeKeys.account(id), (account) =>
        account ? apply(account) : account,
      );
      return { saved };
    },
    onError: (error, _input, context) => {
      restore(client, context?.saved);
      warnRefusal(error);
    },
    onSuccess: (account) => {
      client.setQueryData(financeKeys.account(account.id), account);
    },
    onSettled: () => client.invalidateQueries({ queryKey: financeKeys.accounts }),
  });
}

/**
 * `has_transactions`: a conta tem movimentações e o servidor pede a conta de destino;
 * `currency_mismatch`: a conta de destino é de outra moeda (CB-03).
 */
export type DeleteAccountState = 'idle' | 'has_transactions' | 'currency_mismatch';

export interface DeleteAccountVariables {
  id: string;
  move_to?: string;
}

const DIALOG_ERRORS = new Set(['account_has_transactions', 'currency_mismatch']);

export function useDeleteAccount() {
  const client = useQueryClient();
  const mutation = useMutation<undefined, Error, DeleteAccountVariables, { saved: Snapshot }>({
    mutationFn: ({ id, move_to }) =>
      api.delete<undefined>(
        `/accounts/${id}${move_to ? `?move_to=${encodeURIComponent(move_to)}` : ''}`,
      ),
    onMutate: async ({ id, move_to }) => {
      const keys = [financeKeys.accounts, financeKeys.account(id)];
      if (move_to) keys.push(financeKeys.account(move_to));
      await cancel(client, keys);
      const saved = snapshot(client, keys);
      const removed =
        client
          .getQueryData<Account[]>(financeKeys.accounts)
          ?.find((account) => account.id === id) ??
        client.getQueryData<Account>(financeKeys.account(id));
      client.setQueryData<Account[]>(financeKeys.accounts, (list) =>
        list?.filter((account) => account.id !== id),
      );
      if (move_to && removed) {
        // A destino fica com o saldo da excluída: a transferência entre as duas sai (RN-05) e o
        // resto passa para ela (RF-06).
        adjustBalance(client, move_to, removed.balance_amount);
      }
      return { saved };
    },
    onError: (error, _variables, context) => {
      restore(client, context?.saved);
      // A conta com movimentações e a moeda diferente aparecem no próprio diálogo, sem aviso solto.
      if (!DIALOG_ERRORS.has(problemCode(error) ?? '')) warnRefusal(error);
    },
    onSuccess: (_data, { id, move_to }) => {
      client.removeQueries({ queryKey: financeKeys.account(id) });
      // Movimentações, transferências, recorrências e saldos mudaram de conta.
      if (move_to) void client.invalidateQueries({ queryKey: financeKeys.all });
    },
    onSettled: () => client.invalidateQueries({ queryKey: financeKeys.accounts }),
  });
  const code = problemCode(mutation.error);
  const state: DeleteAccountState =
    code === 'account_has_transactions'
      ? 'has_transactions'
      : code === 'currency_mismatch'
        ? 'currency_mismatch'
        : 'idle';
  return { ...mutation, state };
}
