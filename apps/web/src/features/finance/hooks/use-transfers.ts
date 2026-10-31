import type { Schemas } from '@atria/contracts';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../shared/api/client';
import {
  cancel,
  financeKeys,
  mapPages,
  restore,
  snapshot,
  warnRefusal,
  type Snapshot,
} from './finance-cache';
import { PAGE_SIZE, searchParam } from './use-transactions';

export type Transfer = Schemas['TransferResponse'];
export type CreateTransferInput = Schemas['CreateTransferRequest'];

export interface TransferFilters {
  from?: string;
  to?: string;
  account_id?: string;
  q?: string;
}

export function useTransfers(filters: TransferFilters) {
  const query = { from: filters.from, to: filters.to, q: searchParam(filters.q), limit: PAGE_SIZE };
  const result = useInfiniteQuery({
    queryKey: [...financeKeys.transfers, query],
    queryFn: ({ pageParam, signal }) =>
      api.get<Schemas['TransferPage']>('/transfers', {
        query: { ...query, cursor: pageParam },
        signal,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.next_cursor ?? undefined,
  });
  const all = result.data?.pages.flatMap((page) => page.items) ?? [];
  // O contrato não filtra transferências por conta: o filtro é sobre a página já lida.
  const account = filters.account_id;
  const items = account
    ? all.filter((item) => item.from_account_id === account || item.to_account_id === account)
    : all;
  return { ...result, items };
}

export function useTransfer(id: string | undefined) {
  return useQuery({
    queryKey: financeKeys.transfer(id ?? ''),
    queryFn: ({ signal }) => api.get<Transfer>(`/transfers/${id ?? ''}`, { signal }),
    enabled: id !== undefined && id !== '',
  });
}

export interface CreateTransferVariables {
  input: CreateTransferInput;
  idempotency_key: string;
}

export function useCreateTransfer() {
  const client = useQueryClient();
  return useMutation<Transfer, Error, CreateTransferVariables>({
    mutationFn: ({ input, idempotency_key }) =>
      api.post<Transfer>('/transfers', input, { idempotency_key }),
    onSuccess: (created) => {
      client.setQueryData(financeKeys.transfer(created.id), created);
      void client.invalidateQueries({ queryKey: financeKeys.transfers });
      void client.invalidateQueries({ queryKey: financeKeys.accounts });
    },
  });
}

export function useDeleteTransfer() {
  const client = useQueryClient();
  return useMutation<undefined, Error, string, { saved: Snapshot }>({
    mutationFn: (id) => api.delete<undefined>(`/transfers/${id}`),
    onMutate: async (id) => {
      await cancel(client, [financeKeys.transfers]);
      const saved = snapshot(client, [financeKeys.transfers]);
      mapPages<Transfer>(client, financeKeys.transfers, (items) =>
        items.filter((item) => item.id !== id),
      );
      return { saved };
    },
    onError: (error, _id, context) => {
      restore(client, context?.saved);
      warnRefusal(error);
    },
    onSuccess: (_data, id) => {
      client.removeQueries({ queryKey: financeKeys.transfer(id) });
    },
    onSettled: () => {
      void client.invalidateQueries({ queryKey: financeKeys.transfers });
      void client.invalidateQueries({ queryKey: financeKeys.accounts });
    },
  });
}
