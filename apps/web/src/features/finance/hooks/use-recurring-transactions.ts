import type { Schemas } from '@atria/contracts';
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import type { RecurrenceRule as FormRule } from '../../../shared/forms/recurrence-fields';
import { api } from '../../../shared/api/client';
import {
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
} from './finance-cache';
import type { AdjustmentInput } from './use-transactions';

export type RecurringTransaction = Schemas['RecurringTransactionResponse'];
export type ContractRule = Schemas['RecurrenceRule'];
export type CreateRecurringInput = Schemas['CreateRecurringTransactionRequest'];
export type UpdateRecurringInput = Schemas['UpdateRecurringTransactionRequest'];

/**
 * O Financeiro só usa datas: o contrato exige um horário, e meio-dia no fuso da regra
 * mantém a ocorrência no mesmo dia em qualquer conversão.
 */
const DATE_ONLY_TIME = '12:00';

export function toContractRule(rule: FormRule): ContractRule {
  return {
    frequency: rule.frequency,
    interval: rule.interval,
    weekdays: rule.weekdays,
    month_day: rule.month_day,
    time: rule.time ?? DATE_ONLY_TIME,
    timezone: rule.timezone,
    starts_on: rule.starts_on,
    ends_on: rule.ends_on,
  };
}

export function toFormRule(rule: ContractRule): FormRule {
  return {
    frequency: rule.frequency,
    interval: rule.interval,
    weekdays: rule.weekdays ?? [],
    month_day: rule.month_day ?? null,
    time: null,
    timezone: rule.timezone,
    starts_on: rule.starts_on,
    ends_on: rule.ends_on ?? null,
  };
}

function refresh(client: QueryClient, id: string) {
  void client.invalidateQueries({ queryKey: financeKeys.recurring(id) });
  void client.invalidateQueries({ queryKey: financeKeys.transactions });
  void client.invalidateQueries({ queryKey: financeKeys.summary });
  void client.invalidateQueries({ queryKey: financeKeys.accounts });
}

export interface CreateRecurringVariables {
  input: CreateRecurringInput;
  idempotency_key: string;
}

export function useCreateRecurringTransaction() {
  const client = useQueryClient();
  return useMutation<RecurringTransaction, Error, CreateRecurringVariables>({
    mutationFn: ({ input, idempotency_key }) =>
      api.post<RecurringTransaction>('/recurring-transactions', input, { idempotency_key }),
    onSuccess: (created) => {
      client.setQueryData(financeKeys.recurring(created.id), created);
      // A ocorrência aberta e a previsão são do servidor.
      void client.invalidateQueries({ queryKey: financeKeys.transactions });
      void client.invalidateQueries({ queryKey: financeKeys.summary });
    },
  });
}

export function useRecurringTransaction(id: string | undefined) {
  return useQuery({
    queryKey: financeKeys.recurring(id ?? ''),
    queryFn: ({ signal }) =>
      api.get<RecurringTransaction>(`/recurring-transactions/${id ?? ''}`, { signal }),
    enabled: id !== undefined && id !== '',
  });
}

/** Sem data de vigência: vale para a aberta e as seguintes; as cópias liquidadas não mudam (RN-08). */
export function useUpdateRecurringTransaction(id: string) {
  const client = useQueryClient();
  return useMutation<RecurringTransaction, Error, UpdateRecurringInput>({
    mutationFn: (patch) => api.patch<RecurringTransaction>(`/recurring-transactions/${id}`, patch),
    onSuccess: (updated) => {
      client.setQueryData(financeKeys.recurring(id), updated);
      refresh(client, id);
    },
  });
}

/** Tira a ocorrência aberta e a previsão das listas na hora; o saldo não muda (RN-01). */
export function useDeleteRecurringTransaction(id: string) {
  const client = useQueryClient();
  // Sem variáveis: os tipos vêm da inferência (`void` explícito não passa no lint).
  return useMutation({
    mutationFn: () => api.delete<undefined>(`/recurring-transactions/${id}`),
    onMutate: async (): Promise<{ saved: Snapshot }> => {
      const prefixes = [financeKeys.transactions, financeKeys.recurring(id)];
      await cancel(client, prefixes);
      const saved = snapshot(client, prefixes);
      // Somem a ocorrência aberta e a previsão; as cópias liquidadas têm id e ficam no histórico (RF-03).
      mapPages<TransactionItem>(client, financeKeys.transactions, (items) =>
        items.filter((item) => item.id != null || item.recurrence_id !== id),
      );
      return { saved };
    },
    onError: (error: Error, _variables, context) => {
      restore(client, context?.saved);
      warnRefusal(error);
    },
    onSuccess: () => {
      // A tela sai da página logo depois; reler a recorrência daria 404.
      void client.invalidateQueries({ queryKey: financeKeys.recurring(id), refetchType: 'none' });
    },
    onSettled: () => {
      void client.invalidateQueries({ queryKey: financeKeys.transactions });
      void client.invalidateQueries({ queryKey: financeKeys.summary });
    },
  });
}

/** `stale`: a ocorrência já foi liquidada ou pulada; `ended`: a recorrência terminou. */
export type OccurrenceState = 'idle' | 'stale' | 'ended';

function occurrenceState(error: unknown): OccurrenceState {
  const code = problemCode(error);
  if (code === 'occurrence_not_open') return 'stale';
  if (code === 'recurrence_ended') return 'ended';
  return 'idle';
}

function onOccurrenceError(client: QueryClient, id: string, error: unknown) {
  if (occurrenceState(error) === 'idle') {
    warnRefusal(error);
    return;
  }
  void client.invalidateQueries({ queryKey: financeKeys.recurring(id) });
}

export interface SettleOccurrenceVariables {
  occurrence_date: string;
  settled_amount: number;
  settled_at: string;
  /** Itens editados na liquidação; sem eles, o servidor reaplica os da recorrente (RF-10). */
  adjustments?: AdjustmentInput[];
  idempotency_key: string;
}

/** Não é otimista: a ocorrência seguinte é calculada pelo servidor. */
export function useSettleOccurrence(id: string) {
  const client = useQueryClient();
  const mutation = useMutation<Transaction, Error, SettleOccurrenceVariables>({
    mutationFn: ({ idempotency_key, ...body }) =>
      api.post<Transaction>(`/recurring-transactions/${id}/settlement`, body, { idempotency_key }),
    onError: (error) => {
      onOccurrenceError(client, id, error);
    },
    onSuccess: (copy) => {
      client.setQueryData(financeKeys.transaction(copy.id), copy);
      void client.invalidateQueries({ queryKey: financeKeys.copies(id) });
      refresh(client, id);
    },
  });
  return { ...mutation, state: occurrenceState(mutation.error) };
}

export interface SkipOccurrenceVariables {
  occurrence_date: string;
  idempotency_key: string;
}

export function useSkipOccurrence(id: string) {
  const client = useQueryClient();
  const mutation = useMutation<RecurringTransaction, Error, SkipOccurrenceVariables>({
    mutationFn: ({ idempotency_key, occurrence_date }) =>
      api.post<RecurringTransaction>(
        `/recurring-transactions/${id}/skip`,
        { occurrence_date },
        { idempotency_key },
      ),
    onError: (error) => {
      onOccurrenceError(client, id, error);
    },
    onSuccess: (updated) => {
      client.setQueryData(financeKeys.recurring(id), updated);
      void client.invalidateQueries({ queryKey: financeKeys.copies(id) });
      refresh(client, id);
    },
  });
  return { ...mutation, state: occurrenceState(mutation.error) };
}

export const COPIES_PAGE_SIZE = 20;

/** Cópias liquidadas, da ocorrência mais recente para a mais antiga (DEC-005). */
export function useSettledCopies(id: string | undefined, enabled = true) {
  const result = useInfiniteQuery({
    queryKey: financeKeys.copies(id ?? ''),
    queryFn: ({ pageParam, signal }) =>
      api.get<Schemas['SettledTransactionPage']>(
        `/recurring-transactions/${id ?? ''}/settled-transactions`,
        { query: { cursor: pageParam, limit: COPIES_PAGE_SIZE }, signal },
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.next_cursor ?? undefined,
    enabled: enabled && id !== undefined && id !== '',
  });
  const items = result.data?.pages.flatMap((page) => page.items) ?? [];
  return { ...result, items };
}
