import type { Schemas } from '@atria/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../shared/api/client';
import {
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
        kind: input.kind ?? 'standard',
        balance_amount: 0,
        credit_limit_amount: input.credit_limit_amount ?? null,
        closing_day: input.closing_day ?? null,
        due_day: input.due_day ?? null,
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
        ...(patch.credit_limit_amount === undefined
          ? {}
          : { credit_limit_amount: patch.credit_limit_amount }),
        ...(patch.closing_day === undefined ? {} : { closing_day: patch.closing_day }),
        ...(patch.due_day === undefined ? {} : { due_day: patch.due_day }),
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

/** `has_transactions`: o servidor recusou porque a conta ainda tem movimentações. */
export type DeleteAccountState = 'idle' | 'has_transactions';

export function useDeleteAccount() {
  const client = useQueryClient();
  const mutation = useMutation<undefined, Error, string, { saved: Snapshot }>({
    mutationFn: (id) => api.delete<undefined>(`/accounts/${id}`),
    onMutate: async (id) => {
      await cancel(client, [financeKeys.accounts]);
      const saved = snapshot(client, [financeKeys.accounts]);
      client.setQueryData<Account[]>(financeKeys.accounts, (list) =>
        list?.filter((account) => account.id !== id),
      );
      return { saved };
    },
    onError: (error, _id, context) => {
      restore(client, context?.saved);
      // A tela explica a conta com movimentações no próprio diálogo, sem aviso solto.
      if (problemCode(error) !== 'account_has_transactions') warnRefusal(error);
    },
    onSuccess: (_data, id) => {
      client.removeQueries({ queryKey: financeKeys.account(id) });
    },
    onSettled: () => client.invalidateQueries({ queryKey: financeKeys.accounts }),
  });
  const state: DeleteAccountState =
    problemCode(mutation.error) === 'account_has_transactions' ? 'has_transactions' : 'idle';
  return { ...mutation, state };
}
