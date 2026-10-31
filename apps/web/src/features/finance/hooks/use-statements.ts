import type { Schemas } from '@atria/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../shared/api/client';
import {
  cancel,
  financeKeys,
  restore,
  snapshot,
  warnRefusal,
  type Snapshot,
} from './finance-cache';

export type Statement = Schemas['StatementResponse'];
export type StatementPayment = Schemas['StatementPaymentResponse'];

export function statementsKey(card_id: string) {
  return [...financeKeys.statements, card_id] as const;
}

/** Faturas do cartão, com período, total e situação (RF-34). */
export function useStatements(card_id: string | undefined) {
  return useQuery({
    queryKey: statementsKey(card_id ?? ''),
    queryFn: async ({ signal }) =>
      (
        await api.get<Schemas['StatementList']>(`/credit-cards/${card_id ?? ''}/statements`, {
          signal,
        })
      ).items,
    enabled: card_id !== undefined && card_id !== '',
  });
}

export interface PayStatementVariables {
  from_account_id: string;
  paid_on: string;
  idempotency_key: string;
}

/** Otimista: a fatura aparece paga na hora e volta se o servidor recusar. */
export function usePayStatement(card_id: string, period: string) {
  const client = useQueryClient();
  const key = statementsKey(card_id);
  return useMutation<StatementPayment, Error, PayStatementVariables, { saved: Snapshot }>({
    mutationFn: ({ idempotency_key, ...body }) =>
      api.post<StatementPayment>(
        `/credit-cards/${card_id}/statements/${encodeURIComponent(period)}/payment`,
        body,
        { idempotency_key },
      ),
    onMutate: async () => {
      await cancel(client, [key]);
      const saved = snapshot(client, [key]);
      client.setQueryData<Statement[]>(key, (list) =>
        list?.map((item) =>
          item.period === period ? { ...item, paid: true, outstanding_amount: 0 } : item,
        ),
      );
      return { saved };
    },
    onError: (error, _variables, context) => {
      restore(client, context?.saved);
      warnRefusal(error);
    },
    onSettled: () => {
      void client.invalidateQueries({ queryKey: key });
      void client.invalidateQueries({ queryKey: financeKeys.transactions });
      void client.invalidateQueries({ queryKey: financeKeys.accounts });
      void client.invalidateQueries({ queryKey: financeKeys.summary });
    },
  });
}
