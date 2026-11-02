import type { Schemas } from '@atria/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { api } from '../../../shared/api/client';
import { financeKeys, readAll, warnRefusal, type Page } from './finance-cache';

export type PayrollLoan = Schemas['PayrollLoanResponse'];
export type CreatePayrollLoanInput = Schemas['CreatePayrollLoanRequest'];
export type UpdatePayrollLoanInput = Schemas['UpdatePayrollLoanRequest'];
export type PayrollLoanSource = { income_id: string } | { income_recurrence_id: string };

/** O prefixo `finance` deixa a invalidação de `financeKeys.all` alcançar estas consultas. */
export const payrollLoanKeys = {
  all: ['finance', 'payroll-loans'] as const,
  list: (source: PayrollLoanSource) => ['finance', 'payroll-loans', source] as const,
  detail: (id: string) => ['finance', 'payroll-loan', id] as const,
};

/** Consignados de uma entrada avulsa (`income_id`) ou de uma recorrente (`income_recurrence_id`). */
export function usePayrollLoans(source: PayrollLoanSource | undefined) {
  return useQuery({
    queryKey: source ? payrollLoanKeys.list(source) : payrollLoanKeys.all,
    queryFn: ({ signal }) =>
      readAll((cursor) =>
        api.get<Page<PayrollLoan>>('/payroll-loans', {
          query: { ...source, cursor, limit: 100 },
          signal,
        }),
      ),
    enabled: source !== undefined,
  });
}

export function usePayrollLoan(id: string | undefined) {
  return useQuery({
    queryKey: payrollLoanKeys.detail(id ?? ''),
    queryFn: ({ signal }) => api.get<PayrollLoan>(`/payroll-loans/${id ?? ''}`, { signal }),
    enabled: id !== undefined && id !== '',
  });
}

/** Um consignado no editor: números como texto, para o campo aceitar o que a pessoa digita. */
export interface PayrollLoanFormItem {
  id: string | null;
  name: string;
  contract_number: string;
  installment_amount: number | null;
  term: 'installments' | 'end_date';
  current_installment: string;
  total_installments: string;
  ends_on: string;
}

export function emptyPayrollLoan(): PayrollLoanFormItem {
  return {
    id: null,
    name: '',
    contract_number: '',
    installment_amount: null,
    term: 'installments',
    current_installment: '',
    total_installments: '',
    ends_on: '',
  };
}

export function fromPayrollLoans(loans: readonly PayrollLoan[]): PayrollLoanFormItem[] {
  return loans.map((loan) => ({
    id: loan.id,
    name: loan.name,
    contract_number: loan.contract_number ?? '',
    installment_amount: loan.installment_amount,
    term: loan.ends_on != null ? 'end_date' : 'installments',
    current_installment: loan.current_installment != null ? String(loan.current_installment) : '',
    total_installments: loan.total_installments != null ? String(loan.total_installments) : '',
    ends_on: loan.ends_on ?? '',
  }));
}

const COUNT = /^\d{1,3}$/;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

export const payroll_loan_item_schema = z
  .object({
    id: z.string().nullable(),
    name: z.string(),
    contract_number: z.string(),
    installment_amount: z.number().nullable(),
    term: z.enum(['installments', 'end_date']),
    current_installment: z.string(),
    total_installments: z.string(),
    ends_on: z.string(),
  })
  .superRefine((item, context) => {
    const issue = (path: string, message: string) => {
      context.addIssue({ code: 'custom', path: [path], message });
    };
    const name = item.name.trim();
    if (name === '' || name.length > 60) issue('name', 'finance.payroll_loans.name_required');
    if (item.installment_amount === null || item.installment_amount <= 0) {
      issue('installment_amount', 'finance.transaction_form.amount_invalid');
    }
    if (item.term === 'end_date') {
      if (!ISO_DAY.test(item.ends_on)) issue('ends_on', 'finance.payroll_loans.ends_on_required');
      return;
    }
    const total = item.total_installments.trim();
    const current = item.current_installment.trim();
    const total_ok = COUNT.test(total) && Number(total) >= 1;
    const current_ok = COUNT.test(current) && Number(current) >= 1;
    if (!total_ok) issue('total_installments', 'finance.payroll_loans.total_invalid');
    if (!current_ok) issue('current_installment', 'finance.payroll_loans.current_invalid');
    if (total_ok && current_ok && Number(current) > Number(total)) {
      issue('current_installment', 'finance.payroll_loans.current_above_total');
    }
  });

export const payroll_loans_schema = z.array(payroll_loan_item_schema);

/** Índices dos itens por data final anterior à próxima parcela; o servidor confere de novo (CB-03). */
export function endsBeforeNext(items: readonly PayrollLoanFormItem[], next_date: string): number[] {
  return items.flatMap((item, index) =>
    item.term === 'end_date' && ISO_DAY.test(item.ends_on) && item.ends_on < next_date
      ? [index]
      : [],
  );
}

function updateFields(item: PayrollLoanFormItem): UpdatePayrollLoanInput {
  const by_installments = item.term === 'installments';
  return {
    name: item.name.trim(),
    contract_number: item.contract_number.trim() || null,
    installment_amount: item.installment_amount ?? 0,
    total_installments: by_installments ? Number(item.total_installments) : null,
    current_installment: by_installments ? Number(item.current_installment) : null,
    ends_on: by_installments ? null : item.ends_on,
  };
}

export function toCreatePayrollLoan(
  item: PayrollLoanFormItem,
  source: PayrollLoanSource,
): CreatePayrollLoanInput {
  return { ...source, ...updateFields(item) } as CreatePayrollLoanInput;
}

export function toUpdatePayrollLoan(item: PayrollLoanFormItem): UpdatePayrollLoanInput {
  return updateFields(item);
}

/** Soma das parcelas dos consignados ativos. */
export function installmentsTotal(loans: readonly PayrollLoan[]): number {
  return loans
    .filter((loan) => loan.status === 'active')
    .reduce((sum, loan) => sum + loan.installment_amount, 0);
}

/** Soma dos valores já preenchidos no editor. */
export function formInstallmentsTotal(items: readonly PayrollLoanFormItem[]): number {
  return items.reduce((sum, item) => sum + (item.installment_amount ?? 0), 0);
}

/** Consignados ativos com parcela na data da entrada. */
export function periodInstallments(loans: readonly PayrollLoan[], date: string): PayrollLoan[] {
  return loans.filter((loan) => loan.status === 'active' && loan.next_installment_on === date);
}

export interface SavePayrollLoansVariables {
  source: PayrollLoanSource;
  before: readonly PayrollLoan[];
  after: readonly PayrollLoanFormItem[];
}

/** Grava o editor em sequência: exclui, altera só o que mudou e cria os novos. */
export function useSavePayrollLoans() {
  const client = useQueryClient();
  return useMutation<undefined, Error, SavePayrollLoansVariables>({
    mutationFn: async ({ source, before, after }) => {
      const kept = new Set(after.flatMap((item) => (item.id ? [item.id] : [])));
      for (const loan of before) {
        if (!kept.has(loan.id)) await api.delete<undefined>(`/payroll-loans/${loan.id}`);
      }
      for (const item of after) {
        if (!item.id) continue;
        const original = before.find((loan) => loan.id === item.id);
        if (!original) continue;
        const [saved] = fromPayrollLoans([original]);
        const body = toUpdatePayrollLoan(item);
        if (saved && JSON.stringify(toUpdatePayrollLoan(saved)) === JSON.stringify(body)) continue;
        await api.patch<PayrollLoan>(`/payroll-loans/${item.id}`, body);
      }
      for (const item of after) {
        if (!item.id)
          await api.post<PayrollLoan>('/payroll-loans', toCreatePayrollLoan(item, source));
      }
      return undefined;
    },
    onError: warnRefusal,
    onSettled: () => client.invalidateQueries({ queryKey: financeKeys.all }),
  });
}
