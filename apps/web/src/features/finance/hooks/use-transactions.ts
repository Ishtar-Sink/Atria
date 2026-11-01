import type { Schemas } from '@atria/contracts';
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import { api } from '../../../shared/api/client';
import { todayInTimeZone } from '../lib/finance-period';
import {
  adjustBalance,
  balanceDelta,
  cancel,
  financeKeys,
  mapPages,
  problemCode,
  restore,
  snapshot,
  warnRefusal,
  type Snapshot,
  type Transaction,
  type TransactionItem,
  type TransactionKind,
} from './finance-cache';

export type { Transaction, TransactionItem } from './finance-cache';
export type CreateTransactionInput = Schemas['CreateTransactionRequest'];
export type UpdateTransactionInput = Schemas['UpdateTransactionRequest'];
export type Repetition = Schemas['RepetitionDto'];

export const PAGE_SIZE = 50;
export const SEARCH_MAX = 100;

export interface TransactionFilters {
  kind?: TransactionKind;
  account_id?: string;
  category_id?: string;
  settled?: boolean;
  repetition?: Repetition;
  q?: string;
  /** Sem `from` e `to`, "Qualquer período" (DEC-004). */
  from?: string;
  to?: string;
  limit?: number;
}

/** A busca vai ao servidor aparada, de 1 a 100 caracteres, e some quando vazia (DEC-005). */
export function searchParam(text: string | undefined): string | undefined {
  const trimmed = text?.trim().slice(0, SEARCH_MAX) ?? '';
  return trimmed === '' ? undefined : trimmed;
}

function normalize(filters: TransactionFilters) {
  return {
    kind: filters.kind,
    account_id: filters.account_id || undefined,
    category_id: filters.category_id || undefined,
    settled: filters.settled,
    repetition: filters.repetition === 'all' ? undefined : filters.repetition,
    q: searchParam(filters.q),
    from: filters.from,
    to: filters.to,
    limit: filters.limit ?? PAGE_SIZE,
  };
}

/** Itens virtuais (ocorrência aberta e previsão) não têm `id` (PD-51). */
export function listItemKey(item: TransactionItem): string {
  return item.id ?? `${item.recurrence_id ?? ''}:${item.occurrence_date ?? item.effective_date}`;
}

export function listItemHref(item: TransactionItem): string {
  if (item.id) return `/finance/transactions/${item.id}`;
  return `/finance/recurring-transactions/${item.recurrence_id ?? ''}`;
}

interface TransactionPage {
  items: TransactionItem[];
  next_cursor?: string | null;
}

export function useTransactions(filters: TransactionFilters, enabled = true) {
  const query = normalize(filters);
  const result = useInfiniteQuery({
    queryKey: [...financeKeys.transactions, query],
    queryFn: ({ pageParam, signal }) =>
      api.get<TransactionPage>('/transactions', {
        query: { ...query, cursor: pageParam },
        signal,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.next_cursor ?? undefined,
    enabled,
  });
  const items = result.data?.pages.flatMap((page) => page.items) ?? [];
  return { ...result, items };
}

export function useTransaction(id: string | undefined) {
  return useQuery({
    queryKey: financeKeys.transaction(id ?? ''),
    queryFn: ({ signal }) => api.get<Transaction>(`/transactions/${id ?? ''}`, { signal }),
    enabled: id !== undefined && id !== '',
  });
}

const TRANSACTION_CACHES = [financeKeys.transactions, financeKeys.accounts] as const;

function patchEverywhere(
  client: QueryClient,
  id: string,
  apply: (item: Transaction) => Transaction,
) {
  client.setQueryData<Transaction>(financeKeys.transaction(id), (current) =>
    current ? apply(current) : current,
  );
  mapPages<TransactionItem>(client, financeKeys.transactions, (items) =>
    items.map((item) => (item.id === id ? apply(item as Transaction) : item)),
  );
}

function removeEverywhere(client: QueryClient, id: string) {
  client.removeQueries({ queryKey: financeKeys.transaction(id) });
  mapPages<TransactionItem>(client, financeKeys.transactions, (items) =>
    items.filter((item) => item.id !== id),
  );
}

function cachedTransaction(client: QueryClient, id: string): TransactionItem | undefined {
  const detail = client.getQueryData<Transaction>(financeKeys.transaction(id));
  if (detail) return detail;
  for (const [, data] of client.getQueriesData<{ pages: TransactionPage[] }>({
    queryKey: financeKeys.transactions,
  })) {
    const found = data?.pages.flatMap((page) => page.items).find((item) => item.id === id);
    if (found) return found;
  }
  return undefined;
}

function refreshAfterRecurringChange(
  client: QueryClient,
  recurrence_id: string | null | undefined,
) {
  if (recurrence_id)
    void client.invalidateQueries({ queryKey: financeKeys.recurring(recurrence_id) });
  void client.invalidateQueries({ queryKey: financeKeys.transactions });
  void client.invalidateQueries({ queryKey: financeKeys.summary });
  void client.invalidateQueries({ queryKey: financeKeys.accounts });
}

export interface CreateTransactionVariables {
  input: CreateTransactionInput;
  idempotency_key: string;
}

/**
 * Não é otimista na lista: a movimentação criada vem do servidor. A mesma chave vai em todas as
 * tentativas do mesmo envio (CB-09).
 */
export function useCreateTransaction() {
  const client = useQueryClient();
  return useMutation<Transaction[], Error, CreateTransactionVariables>({
    mutationFn: async ({ input, idempotency_key }) =>
      (
        await api.post<Schemas['CreatedTransactions']>('/transactions', input, {
          idempotency_key,
        })
      ).items,
    onSuccess: (items) => {
      items.forEach((item) => {
        client.setQueryData(financeKeys.transaction(item.id), item);
      });
      void client.invalidateQueries({ queryKey: financeKeys.transactions });
      void client.invalidateQueries({ queryKey: financeKeys.summary });
    },
  });
}

export interface DeleteTransactionVariables {
  id: string;
}

export function useDeleteTransaction() {
  const client = useQueryClient();
  return useMutation<
    undefined,
    Error,
    DeleteTransactionVariables,
    { saved: Snapshot; target: TransactionItem | undefined }
  >({
    mutationFn: ({ id }) => api.delete<undefined>(`/transactions/${id}`),
    onMutate: async ({ id }) => {
      const keys = [...TRANSACTION_CACHES, financeKeys.transaction(id)];
      await cancel(client, keys);
      const saved = snapshot(client, keys);
      const target = cachedTransaction(client, id);
      removeEverywhere(client, id);
      if (target?.status === 'settled' && target.settled_amount != null) {
        // O servidor reverte o saldo; o cache acompanha na hora.
        adjustBalance(client, target.account_id, -balanceDelta(target.kind, target.settled_amount));
      }
      return { saved, target };
    },
    onError: (error, _variables, context) => {
      restore(client, context?.saved);
      warnRefusal(error);
    },
    onSuccess: (_data, _variables, context) => {
      // A cópia de uma recorrente pode reabrir a ocorrência (DEC-004).
      if (context.target?.generated_from) {
        refreshAfterRecurringChange(client, context.target.generated_from);
      }
    },
    onSettled: () => {
      void client.invalidateQueries({ queryKey: financeKeys.transactions });
      void client.invalidateQueries({ queryKey: financeKeys.summary });
      void client.invalidateQueries({ queryKey: financeKeys.accounts });
    },
  });
}

const FORM_ERRORS = new Set([
  'transaction_already_settled',
  'category_kind_mismatch',
  'validation_failed',
]);

export type EditableField = keyof UpdateTransactionInput;

/**
 * Campos que o contrato aceita mudar (DEC-005): a liquidada só muda descrição, categoria e
 * visibilidade.
 */
export function editableFields(transaction: Pick<Transaction, 'status'>): EditableField[] {
  if (transaction.status === 'settled') return ['description', 'category_id', 'visibility'];
  return [
    'description',
    'expected_amount',
    'expected_date',
    'account_id',
    'category_id',
    'visibility',
  ];
}

/** Só os campos alterados e permitidos vão no PATCH. */
export function changedFields(
  original: Transaction,
  next: UpdateTransactionInput,
): UpdateTransactionInput {
  const allowed = new Set(editableFields(original));
  const patch: Record<string, unknown> = {};
  for (const [field, value] of Object.entries(next)) {
    if (!allowed.has(field as EditableField)) continue;
    const before = (original as unknown as Record<string, unknown>)[field] ?? null;
    if ((value ?? null) !== before) patch[field] = value;
  }
  return patch;
}

export function useUpdateTransaction(id: string) {
  const client = useQueryClient();
  return useMutation<Transaction, Error, UpdateTransactionInput, { saved: Snapshot }>({
    mutationFn: (patch) => api.patch<Transaction>(`/transactions/${id}`, patch),
    onMutate: async (patch) => {
      const keys = [financeKeys.transactions, financeKeys.transaction(id)];
      await cancel(client, keys);
      const saved = snapshot(client, keys);
      patchEverywhere(client, id, (item) => ({ ...item, ...(patch as Partial<Transaction>) }));
      return { saved };
    },
    onError: (error, _patch, context) => {
      restore(client, context?.saved);
      const code = problemCode(error);
      if (code === 'transaction_already_settled') {
        void client.invalidateQueries({ queryKey: financeKeys.transaction(id) });
      }
      // Estes aparecem no próprio formulário; os demais, no aviso de recusa.
      if (!code || !FORM_ERRORS.has(code)) warnRefusal(error);
    },
    onSuccess: (updated) => {
      patchEverywhere(client, id, () => updated);
    },
    onSettled: () => {
      void client.invalidateQueries({ queryKey: financeKeys.transactions });
      void client.invalidateQueries({ queryKey: financeKeys.summary });
    },
  });
}

export interface UndoSettlementOptions {
  time_zone: string;
}

/** Desfazer liquidação (DEC-005): otimista na comum; na cópia de recorrente, espera o servidor. */
export function useUndoSettlement(id: string, options: UndoSettlementOptions) {
  const client = useQueryClient();
  return useMutation<Transaction | undefined, Error, Transaction, { saved: Snapshot }>({
    mutationFn: () => api.delete<Transaction | undefined>(`/transactions/${id}/settlement`),
    onMutate: async (current) => {
      const keys = [...TRANSACTION_CACHES, financeKeys.transaction(id)];
      await cancel(client, keys);
      const saved = snapshot(client, keys);
      if (current.generated_from) return { saved };
      const today = todayInTimeZone(new Date(), options.time_zone);
      patchEverywhere(client, id, (item) => ({
        ...item,
        settled_amount: null,
        settled_at: null,
        difference_amount: null,
        difference_kind: null,
        effective_date: item.expected_date,
        status: item.expected_date < today ? 'overdue' : 'open',
      }));
      if (current.settled_amount != null) {
        adjustBalance(
          client,
          current.account_id,
          -balanceDelta(current.kind, current.settled_amount),
        );
      }
      return { saved };
    },
    onError: (error, _current, context) => {
      restore(client, context?.saved);
      const code = problemCode(error);
      if (code === 'transaction_not_settled') {
        void client.invalidateQueries({ queryKey: financeKeys.transaction(id) });
        return;
      }
      warnRefusal(error);
    },
    onSuccess: (response, current) => {
      if (response) {
        patchEverywhere(client, id, () => response);
        return;
      }
      // 204: a cópia foi apagada e a ocorrência pode ter reaberto.
      removeEverywhere(client, id);
      if (current.generated_from) {
        void client.invalidateQueries({ queryKey: financeKeys.copies(current.generated_from) });
      }
      refreshAfterRecurringChange(client, current.generated_from);
    },
    onSettled: () => {
      void client.invalidateQueries({ queryKey: financeKeys.accounts });
      void client.invalidateQueries({ queryKey: financeKeys.summary });
    },
  });
}

/** Diferença calculada na hora, igual à do servidor (RN-02, RN-03). */
export function optimisticDifference(
  kind: TransactionKind,
  expected_amount: number,
  settled_amount: number,
): Pick<Transaction, 'difference_amount' | 'difference_kind'> {
  const difference_amount = settled_amount - expected_amount;
  if (difference_amount === 0) return { difference_amount, difference_kind: null };
  if (kind === 'expense') {
    return { difference_amount, difference_kind: difference_amount < 0 ? 'saving' : 'loss' };
  }
  return { difference_amount, difference_kind: difference_amount > 0 ? 'gain' : 'loss' };
}

export interface SettleVariables {
  transaction: Transaction;
  settled_amount: number;
  settled_at: string;
  idempotency_key: string;
}

export function useSettleTransaction() {
  const client = useQueryClient();
  return useMutation<Transaction, Error, SettleVariables, { saved: Snapshot }>({
    mutationFn: ({ transaction, settled_amount, settled_at, idempotency_key }) =>
      api.post<Transaction>(
        `/transactions/${transaction.id}/settlement`,
        { settled_amount, settled_at },
        { idempotency_key },
      ),
    onMutate: async ({ transaction, settled_amount, settled_at }) => {
      const keys = [...TRANSACTION_CACHES, financeKeys.transaction(transaction.id)];
      await cancel(client, keys);
      const saved = snapshot(client, keys);
      patchEverywhere(client, transaction.id, (item) => ({
        ...item,
        status: 'settled',
        settled_amount,
        settled_at,
        effective_date: settled_at,
        ...optimisticDifference(item.kind, item.expected_amount, settled_amount),
      }));
      adjustBalance(client, transaction.account_id, balanceDelta(transaction.kind, settled_amount));
      return { saved };
    },
    onError: (error, _variables, context) => {
      restore(client, context?.saved);
      warnRefusal(error);
    },
    onSuccess: (settled) => {
      patchEverywhere(client, settled.id, () => settled);
    },
    onSettled: () => {
      void client.invalidateQueries({ queryKey: financeKeys.transactions });
      void client.invalidateQueries({ queryKey: financeKeys.summary });
      void client.invalidateQueries({ queryKey: financeKeys.accounts });
    },
  });
}
