import { act, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearToasts } from '../../../shared/toast/toast-store';
import { financeServer, payrollLoan, PAYSLIP_LOANS, renderFinanceHook, world } from '../test-utils';
import {
  emptyPayrollLoan,
  endsBeforeNext,
  formInstallmentsTotal,
  fromPayrollLoans,
  installmentsTotal,
  payroll_loan_item_schema,
  periodInstallments,
  toCreatePayrollLoan,
  usePayrollLoans,
  useSavePayrollLoans,
  type PayrollLoanFormItem,
} from './use-payroll-loans';

afterEach(() => {
  clearToasts();
  vi.unstubAllGlobals();
});

function filled(overrides: Partial<PayrollLoanFormItem> = {}): PayrollLoanFormItem {
  return {
    ...emptyPayrollLoan(),
    name: 'Novo',
    installment_amount: 10000,
    current_installment: '12',
    total_installments: '48',
    ...overrides,
  };
}

function issues(item: PayrollLoanFormItem) {
  const result = payroll_loan_item_schema.safeParse(item);
  return result.success ? [] : result.error.issues.map((issue) => [issue.path, issue.message]);
}

const [PL1, PL2] = PAYSLIP_LOANS;

describe('payroll loans', () => {
  it('rf02 lists the loans of an income by its id', async () => {
    const { calls } = financeServer(
      world({
        payroll_loans: [
          payrollLoan({ id: 'pl1', name: 'A', income_id: 't60' }),
          payrollLoan({ id: 'pl9', name: 'B', income_id: 't61' }),
        ],
      }),
    );
    const { result } = renderFinanceHook(() => usePayrollLoans({ income_id: 't60' }));
    await waitFor(() => {
      expect(result.current.data?.map((entry) => entry.id)).toEqual(['pl1']);
    });
    expect(calls[0]?.url.searchParams.get('income_id')).toBe('t60');
  });

  it('rf02 lists the loans of a recurrence by its id', async () => {
    const { calls } = financeServer(
      world({
        payroll_loans: [
          payrollLoan({ id: 'pl1', name: 'A', income_recurrence_id: 'r6' }),
          payrollLoan({ id: 'pl9', name: 'B', income_recurrence_id: 'r7' }),
        ],
      }),
    );
    const { result } = renderFinanceHook(() => usePayrollLoans({ income_recurrence_id: 'r6' }));
    await waitFor(() => {
      expect(result.current.data?.map((entry) => entry.id)).toEqual(['pl1']);
    });
    expect(calls[0]?.url.searchParams.get('income_recurrence_id')).toBe('r6');
  });

  it('rf03 refuses a loan without name or with a name above 60 characters', () => {
    expect(issues(filled({ name: '' }))).toEqual([
      [['name'], 'finance.payroll_loans.name_required'],
    ]);
    expect(issues(filled({ name: 'a'.repeat(61) }))).toEqual([
      [['name'], 'finance.payroll_loans.name_required'],
    ]);
    expect(issues(filled({ name: 'a'.repeat(60) }))).toEqual([]);
  });

  it('cb02 refuses a current installment above the total', () => {
    expect(issues(filled({ current_installment: '49' }))).toEqual([
      [['current_installment'], 'finance.payroll_loans.current_above_total'],
    ]);
    expect(issues(filled({ current_installment: '0' }))).toEqual([
      [['current_installment'], 'finance.payroll_loans.current_invalid'],
    ]);
    expect(issues(filled({ total_installments: '' }))).toEqual([
      [['total_installments'], 'finance.payroll_loans.total_invalid'],
    ]);
  });

  it('rf04 accepts the term by installments or by end date', () => {
    const source = { income_id: 't60' };
    expect(toCreatePayrollLoan(filled(), source)).toMatchObject({
      total_installments: 48,
      current_installment: 12,
      ends_on: null,
    });
    const by_date = filled({ term: 'end_date', ends_on: '2027-03-20' });
    expect(toCreatePayrollLoan(by_date, source)).toMatchObject({
      total_installments: null,
      current_installment: null,
      ends_on: '2027-03-20',
    });
    expect(issues(filled({ term: 'end_date', ends_on: '' }))).toEqual([
      [['ends_on'], 'finance.payroll_loans.ends_on_required'],
    ]);
  });

  it('cb03 flags an end date before the next installment', () => {
    const items = [
      filled({ term: 'end_date', ends_on: '2026-11-04' }),
      filled({ term: 'end_date', ends_on: '2026-11-05' }),
      filled(),
    ];
    expect(endsBeforeNext(items, '2026-11-05')).toEqual([0]);
  });

  it('rf11 sums the installments of the list', () => {
    expect(installmentsTotal(PAYSLIP_LOANS)).toBe(374670);
    const ended = PAYSLIP_LOANS.map((entry) =>
      entry.id === 'pl6' ? { ...entry, status: 'ended' as const } : entry,
    );
    expect(installmentsTotal(ended)).toBe(357729);
    expect(
      formInstallmentsTotal([
        filled({ installment_amount: 293723 }),
        filled({ installment_amount: null }),
      ]),
    ).toBe(293723);
  });

  it('periodInstallments keeps the active loans due on the date', () => {
    const list = [
      payrollLoan({ id: 'pl1', name: 'A', next_installment_on: '2026-11-05' }),
      payrollLoan({ id: 'pl2', name: 'B', next_installment_on: '2026-12-05' }),
      payrollLoan({ id: 'pl3', name: 'C', next_installment_on: '2026-11-05', status: 'ended' }),
    ];
    expect(periodInstallments(list, '2026-11-05').map((entry) => entry.id)).toEqual(['pl1']);
  });

  it('rf02 saves the editor by removing, updating and creating in this order', async () => {
    if (!PL1 || !PL2) throw new Error('fixtures');
    const { calls } = financeServer(world({ payroll_loans: [PL1, PL2] }));
    const { result } = renderFinanceHook(() => useSavePayrollLoans());
    const [first] = fromPayrollLoans([PL1]);
    if (!first) throw new Error('item');
    const created = filled({
      installment_amount: 5000,
      current_installment: '1',
      total_installments: '10',
    });
    await act(() =>
      result.current.mutateAsync({
        source: { income_id: 't60' },
        before: [PL1, PL2],
        after: [{ ...first, installment_amount: 300000 }, created],
      }),
    );
    const writes = calls.filter((call) => call.method !== 'GET');
    expect(writes.map((call) => `${call.method} ${call.path}`)).toEqual([
      'DELETE /payroll-loans/pl2',
      'PATCH /payroll-loans/pl1',
      'POST /payroll-loans',
    ]);
    expect(writes[1]?.body).toMatchObject({ installment_amount: 300000 });
    expect(writes[2]?.body).toEqual({
      income_id: 't60',
      name: 'Novo',
      contract_number: null,
      installment_amount: 5000,
      total_installments: 10,
      current_installment: 1,
      ends_on: null,
    });
  });
});
