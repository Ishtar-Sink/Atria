import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';
import { clearToasts, getToasts } from '../../../shared/toast/toast-store';
import {
  account,
  category,
  financeServer,
  holerite,
  item,
  pageHeading,
  PAYSLIP_FIXED,
  PAYSLIP_LOANS,
  problem,
  renderFinance,
  salary,
  transaction,
  world,
  type ApiCall,
  type FinanceWorld,
} from '../test-utils';

afterEach(() => {
  clearToasts();
});

const plain = (text: string | null | undefined) => (text ?? '').replace(/[\u00a0\u202f]/g, ' ');

function seed(overrides: Partial<FinanceWorld> = {}): FinanceWorld {
  return world({
    accounts: [account({ id: 'a1', name: 'Conta principal', is_default: true })],
    categories: [category({ id: 'c3', name: 'Salário', kind: 'income', color: 'success' })],
    transactions: [holerite()],
    payroll_loans: PAYSLIP_LOANS.map((entry) => ({ ...entry, income_id: 't60' })),
    ...overrides,
  });
}

function lastCall(calls: ApiCall[], method: string, path: string) {
  return [...calls].reverse().find((call) => call.method === method && call.path === path);
}

type User = ReturnType<typeof userEvent.setup>;

async function openTab(user: User, name: string) {
  await user.click(screen.getByRole('tab', { name }));
}

async function chooseOption(label: string, option: string) {
  const user = userEvent.setup();
  await user.click(screen.getByLabelText(label));
  await user.click(await screen.findByRole('option', { name: option }));
}

async function addLoan(
  user: User,
  number: number,
  fields: { name: string; amount: string; current: string; total: string },
) {
  await user.click(screen.getByRole('button', { name: 'Adicionar consignado' }));
  const group = screen.getByRole('group', { name: `Consignado ${String(number)}` });
  await user.type(within(group).getByRole('textbox', { name: 'Nome do consignado' }), fields.name);
  await user.type(
    within(group).getByRole('textbox', { name: 'Valor da parcela (R$)' }),
    fields.amount,
  );
  await user.type(within(group).getByRole('textbox', { name: 'Parcela atual' }), fields.current);
  await user.type(within(group).getByRole('textbox', { name: 'Total de parcelas' }), fields.total);
  return group;
}

const loanTotal = () => plain(screen.getByRole('status').textContent);

describe('payroll loans form', () => {
  it('ct08 shows the payroll loans tab with the list and the total', async () => {
    financeServer(seed());
    const user = userEvent.setup();
    const { container } = renderFinance('/finance/transactions/new?kind=income');
    await pageHeading('Nova entrada');
    const tabs = screen.getByRole('tablist', { name: 'Seções da movimentação' });
    expect(
      within(tabs)
        .getAllByRole('tab')
        .map((tab) => tab.textContent),
    ).toEqual(['Movimentação', 'Descontos e acréscimos', 'Consignados']);
    expect(screen.getByRole('tab', { name: 'Movimentação' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await openTab(user, 'Consignados');
    expect(
      screen.getByText(
        'Nenhum consignado. Adicione os empréstimos descontados em folha desta entrada.',
      ),
    ).toBeInTheDocument();
    await addLoan(user, 1, {
      name: 'Empréstimo 178176138',
      amount: '2937,23',
      current: '12',
      total: '48',
    });
    await user.type(
      within(screen.getByRole('group', { name: 'Consignado 1' })).getByRole('textbox', {
        name: 'Número do contrato (opcional)',
      }),
      '178176138',
    );
    await addLoan(user, 2, {
      name: 'Empréstimo 180044512',
      amount: '264,91',
      current: '5',
      total: '60',
    });
    const first = screen.getByRole('group', { name: 'Consignado 1' });
    expect(within(first).getByRole('textbox', { name: 'Nome do consignado' })).toHaveValue(
      'Empréstimo 178176138',
    );
    expect(
      plain(
        within(first).getByRole<HTMLInputElement>('textbox', { name: 'Valor da parcela (R$)' })
          .value,
      ),
    ).toBe('R$ 2.937,23');
    expect(within(first).getByRole('textbox', { name: 'Parcela atual' })).toHaveValue('12');
    expect(within(first).getByRole('textbox', { name: 'Total de parcelas' })).toHaveValue('48');
    expect(loanTotal()).toBe('Total das parcelas: R$ 3.202,14');
    await openTab(user, 'Movimentação');
    await openTab(user, 'Consignados');
    expect(
      within(screen.getByRole('group', { name: 'Consignado 1' })).getByRole('textbox', {
        name: 'Nome do consignado',
      }),
    ).toHaveValue('Empréstimo 178176138');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('ct08 has no payroll loans tab in an expense', async () => {
    financeServer(seed());
    renderFinance('/finance/transactions/new?kind=expense');
    await pageHeading('Nova saída');
    expect(screen.queryByRole('tab', { name: 'Consignados' })).toBeNull();
  });

  it('rf02 creates the income and then each loan', async () => {
    const { calls } = financeServer(seed({ transactions: [] }));
    const user = userEvent.setup();
    renderFinance('/finance/transactions/new?kind=income');
    await pageHeading('Nova entrada');
    await user.type(screen.getByRole('textbox', { name: 'Descrição' }), 'Holerite');
    await chooseOption('Conta', 'Conta principal');
    await user.type(screen.getByRole('textbox', { name: 'Valor previsto (R$)' }), '10669,88');
    await openTab(user, 'Consignados');
    const group = await addLoan(user, 1, {
      name: 'Empréstimo 178176138',
      amount: '2937,23',
      current: '12',
      total: '48',
    });
    await user.type(
      within(group).getByRole('textbox', { name: 'Número do contrato (opcional)' }),
      '178176138',
    );
    await user.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => {
      expect(lastCall(calls, 'POST', '/payroll-loans')).toBeDefined();
    });
    const order = calls.filter((call) => call.method === 'POST').map((call) => call.path);
    expect(order.indexOf('/transactions')).toBeLessThan(order.indexOf('/payroll-loans'));
    const created = lastCall(calls, 'POST', '/transactions');
    expect(created).toBeDefined();
    expect(lastCall(calls, 'POST', '/payroll-loans')?.body).toEqual({
      income_id: 't-new-1',
      name: 'Empréstimo 178176138',
      contract_number: '178176138',
      installment_amount: 293723,
      total_installments: 48,
      current_installment: 12,
      ends_on: null,
    });
  });

  it('rf02 creates a recurrence with loans linked to it', async () => {
    const { calls } = financeServer(seed({ transactions: [] }));
    const user = userEvent.setup();
    renderFinance('/finance/transactions/new?kind=income');
    await pageHeading('Nova entrada');
    await user.type(screen.getByRole('textbox', { name: 'Descrição' }), 'Salário');
    await chooseOption('Conta', 'Conta principal');
    await user.type(screen.getByRole('textbox', { name: 'Valor previsto (R$)' }), '10669,88');
    await user.click(screen.getByRole('checkbox', { name: 'Repetir' }));
    await openTab(user, 'Consignados');
    await addLoan(user, 1, {
      name: 'Empréstimo 178176138',
      amount: '2937,23',
      current: '12',
      total: '48',
    });
    await user.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => {
      expect(lastCall(calls, 'POST', '/payroll-loans')).toBeDefined();
    });
    const recurrence = lastCall(calls, 'POST', '/recurring-transactions');
    expect(recurrence).toBeDefined();
    expect(lastCall(calls, 'POST', '/payroll-loans')?.body).toMatchObject({
      income_recurrence_id: 'r1',
    });
    expect(lastCall(calls, 'POST', '/payroll-loans')?.body).not.toHaveProperty('income_id');
  });

  it('rf02 edits the loans of an income and sends only what changed', async () => {
    const { calls } = financeServer(seed());
    const user = userEvent.setup();
    renderFinance('/finance/transactions/t60/edit');
    await pageHeading('Editar entrada');
    await openTab(user, 'Consignados');
    expect(await screen.findAllByRole('group', { name: /^Consignado \d$/ })).toHaveLength(6);
    expect(loanTotal()).toBe('Total das parcelas: R$ 3.746,70');
    const sixth = screen.getByRole('group', { name: 'Consignado 6' });
    expect(within(sixth).getByRole('radio', { name: 'Por data final' })).toBeChecked();
    expect(within(sixth).getByLabelText('Data da última parcela')).toHaveTextContent('20/03/2027');
    const second = within(screen.getByRole('group', { name: 'Consignado 2' })).getByRole(
      'textbox',
      { name: 'Valor da parcela (R$)' },
    );
    await user.clear(second);
    await user.type(second, '300,00');
    await user.click(screen.getByRole('button', { name: 'Remover Empréstimo 181230977' }));
    await user.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => {
      expect(lastCall(calls, 'DELETE', '/payroll-loans/pl3')).toBeDefined();
    });
    await waitFor(() => {
      expect(lastCall(calls, 'PATCH', '/payroll-loans/pl2')).toBeDefined();
    });
    expect(
      calls.filter((call) => call.method === 'PATCH' && call.path.startsWith('/payroll-loans')),
    ).toHaveLength(1);
    expect(
      calls.filter((call) => call.method === 'POST' && call.path === '/payroll-loans'),
    ).toHaveLength(0);
  });

  it('cb02 opens the payroll loans tab and focuses the current installment', async () => {
    const { calls } = financeServer(seed({ transactions: [] }));
    const user = userEvent.setup();
    renderFinance('/finance/transactions/new?kind=income');
    await pageHeading('Nova entrada');
    await user.type(screen.getByRole('textbox', { name: 'Descrição' }), 'Holerite');
    await chooseOption('Conta', 'Conta principal');
    await user.type(screen.getByRole('textbox', { name: 'Valor previsto (R$)' }), '10669,88');
    await openTab(user, 'Consignados');
    await addLoan(user, 1, {
      name: 'Empréstimo 178176138',
      amount: '2937,23',
      current: '49',
      total: '48',
    });
    await openTab(user, 'Movimentação');
    await user.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'Consignados' })).toHaveAttribute(
        'aria-selected',
        'true',
      );
    });
    const group = screen.getByRole('group', { name: 'Consignado 1' });
    const field = within(group).getByRole('textbox', { name: 'Parcela atual' });
    await waitFor(() => {
      expect(field).toHaveFocus();
    });
    expect(
      within(group).getByText('A parcela atual não pode passar do total de parcelas.'),
    ).toBeInTheDocument();
    expect(lastCall(calls, 'POST', '/transactions')).toBeUndefined();
  });

  it('cb03 refuses an end date before the date of the income', async () => {
    const { calls } = financeServer(
      seed({
        transactions: [holerite({ expected_date: '2027-04-05', effective_date: '2027-04-05' })],
      }),
    );
    const user = userEvent.setup();
    renderFinance('/finance/transactions/t60/edit');
    await pageHeading('Editar entrada');
    await user.click(screen.getByRole('button', { name: 'Salvar' }));
    const group = await screen.findByRole('group', { name: 'Consignado 6' });
    expect(
      within(group).getByText(
        'A data da última parcela é anterior à próxima parcela desta entrada.',
      ),
    ).toBeInTheDocument();
    expect(calls.filter((call) => call.method === 'PATCH')).toHaveLength(0);
  });

  it('warns when a loan has the name of an adjustment', async () => {
    financeServer(
      seed({
        transactions: [
          holerite({
            adjustments: [
              ...PAYSLIP_FIXED,
              {
                name: 'Empréstimo 178176138',
                direction: 'deduction',
                mode: 'fixed',
                amount: 293723,
                computed_amount: 293723,
              },
            ],
          }),
        ],
      }),
    );
    const user = userEvent.setup();
    renderFinance('/finance/transactions/t60/edit');
    await pageHeading('Editar entrada');
    await openTab(user, 'Consignados');
    expect(
      await screen.findByText(
        '“Empréstimo 178176138” também está nos descontos e acréscimos. Remova um dos dois para não descontar duas vezes.',
      ),
    ).toBeInTheDocument();
  });

  it('keeps the income when a loan is refused and warns', async () => {
    const state = seed({ transactions: [] });
    state.override = (call) =>
      call.method === 'POST' && call.path === '/payroll-loans'
        ? problem(422, 'validation_failed')
        : undefined;
    const { calls } = financeServer(state);
    const user = userEvent.setup();
    const { router } = renderFinance('/finance/transactions/new?kind=income');
    await pageHeading('Nova entrada');
    await user.type(screen.getByRole('textbox', { name: 'Descrição' }), 'Holerite');
    await chooseOption('Conta', 'Conta principal');
    await user.type(screen.getByRole('textbox', { name: 'Valor previsto (R$)' }), '10669,88');
    await openTab(user, 'Consignados');
    await addLoan(user, 1, {
      name: 'Empréstimo 178176138',
      amount: '2937,23',
      current: '12',
      total: '48',
    });
    await user.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/finance/transactions/t-new-1');
    });
    expect(lastCall(calls, 'POST', '/transactions')).toBeDefined();
    expect(getToasts().map((toast) => toast.message_key)).toContain(
      'finance.payroll_loans.partial_saved',
    );
  });
});

/** A parcela de 293.723 já liquidada junto com o holerite (RF-13). */
const settled_installment = () =>
  transaction({
    id: 't70',
    kind: 'expense',
    description: 'Empréstimo 178176138',
    category_id: 'c6',
    expected_amount: 293723,
    status: 'settled',
    settled_amount: 293723,
    settled_at: '2026-11-05',
    expected_date: '2026-11-05',
    effective_date: '2026-11-05',
    payroll_loan_id: 'pl1',
    income_transaction_id: 't60',
    installment_number: 12,
  });

function detailSeed(overrides: Partial<FinanceWorld> = {}): FinanceWorld {
  return seed({
    categories: [
      category({ id: 'c3', name: 'Salário', kind: 'income', color: 'success' }),
      category({ id: 'c6', name: 'Empréstimo' }),
    ],
    transactions: [holerite(), settled_installment(), transaction({ id: 't1' })],
    ...overrides,
  });
}

describe('payroll loans detail', () => {
  it('ct09 shows the payroll loans tab of an income with each installment and term', async () => {
    financeServer(detailSeed());
    const user = userEvent.setup();
    const { container } = renderFinance('/finance/transactions/t60');
    await pageHeading('Holerite');
    const tabs = screen.getByRole('tablist', { name: 'Seções da movimentação' });
    await waitFor(() => {
      expect(
        within(tabs)
          .getAllByRole('tab')
          .map((tab) => tab.textContent),
      ).toEqual(['Visão geral', 'Descontos e acréscimos', 'Consignados']);
    });
    expect(within(tabs).getByRole('tab', { name: 'Visão geral' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await openTab(user, 'Consignados');
    const region = await screen.findByRole('region', { name: 'Consignados' });
    const list = within(region).getByRole('list', { name: 'Consignados desta entrada' });
    const entries = within(list).getAllByRole('listitem');
    expect(entries).toHaveLength(6);
    const first = plain(entries[0]?.textContent);
    expect(first).toContain('Empréstimo 178176138');
    expect(first).toContain('Contrato 178176138');
    expect(first).toContain('Próxima parcela 12/48');
    expect(first).toContain('Última parcela em 5 de nov. de 2029');
    expect(first).toContain('Parcelas restantes: 37');
    expect(first).toContain('−R$ 2.937,23');
    const by_date = plain(entries[5]?.textContent);
    expect(by_date).toContain('Empréstimo 184001209');
    expect(by_date).toContain('Última parcela em 5 de mar. de 2027');
    expect(by_date).not.toContain('Próxima parcela');
    expect(plain(region.textContent)).toContain('Total das parcelas');
    expect(plain(region.textContent)).toContain('R$ 3.746,70');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('ct09 opens the payroll loans tab from the address', async () => {
    financeServer(detailSeed());
    const first = renderFinance('/finance/transactions/t60?tab=payroll_loans');
    await pageHeading('Holerite');
    expect(await screen.findByRole('region', { name: 'Consignados' })).toBeInTheDocument();
    first.unmount();

    renderFinance('/finance/transactions/t1?tab=payroll_loans');
    await pageHeading('Mercado');
    // Sem abas extras, o detalhe mostra só a visão geral, sem a barra de abas.
    expect(screen.queryByRole('tab', { name: 'Consignados' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Consignados' })).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Movimentação' })).toBeInTheDocument();
  });

  it('cb01 shows an ended loan as ended', async () => {
    const loans = PAYSLIP_LOANS.map((entry) => ({
      ...entry,
      income_id: 't60',
      ...(entry.id === 'pl2'
        ? {
            status: 'ended' as const,
            remaining_installments: 0,
            current_installment: null,
            next_installment_on: null,
          }
        : {}),
    }));
    financeServer(detailSeed({ payroll_loans: loans }));
    renderFinance('/finance/transactions/t60?tab=payroll_loans');
    const region = await screen.findByRole('region', { name: 'Consignados' });
    const ended = within(region)
      .getAllByRole('listitem')
      .find((entry) => plain(entry.textContent).includes('Empréstimo 180044512'));
    expect(plain(ended?.textContent)).toContain('Encerrado');
    expect(plain(region.textContent)).toContain('R$ 3.481,79');
  });

  it('rf12 tells that the installments were settled with the income', async () => {
    financeServer(
      detailSeed({
        transactions: [
          holerite({
            status: 'settled',
            settled_amount: 1066988,
            settled_at: '2026-11-05',
            settled_gross_amount: 1450000,
            settled_adjustments: PAYSLIP_FIXED,
          }),
        ],
      }),
    );
    renderFinance('/finance/transactions/t60?tab=payroll_loans');
    const region = await screen.findByRole('region', { name: 'Consignados' });
    expect(region).toHaveTextContent(
      'As parcelas deste período foram liquidadas junto com a entrada.',
    );
  });

  it('ct10 shows the loan and the link to the income on a settled installment', async () => {
    financeServer(detailSeed());
    const { container } = renderFinance('/finance/transactions/t70');
    await pageHeading('Empréstimo 178176138');
    const data = screen.getByRole('region', { name: 'Movimentação' });
    await waitFor(() => {
      expect(plain(data.textContent)).toContain('Empréstimo 178176138 · parcela 12');
    });
    expect(data).toHaveTextContent('Consignado');
    expect(data).toHaveTextContent('Entrada de origem');
    expect(await within(data).findByRole('link', { name: 'Holerite' })).toHaveAttribute(
      'href',
      '/finance/transactions/t60',
    );
    expect(screen.queryByRole('region', { name: 'Liquidação' })).not.toBeInTheDocument();
    expect(
      screen.getByText('Esta parcela é liquidada junto com a entrada de origem.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Desfazer liquidação' })).not.toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('ct10 opens an open installment at its income', async () => {
    const open_installment = {
      id: null,
      kind: 'expense' as const,
      description: 'Empréstimo 178176138',
      category_id: 'c6',
      payroll_loan_id: 'pl1',
      expected_amount: 293723,
    };
    const state = detailSeed({
      transactions: [
        item({ ...open_installment, income_transaction_id: 't60', recurrence_id: null }),
      ],
    });
    financeServer(state);
    const first = renderFinance('/finance/expenses');
    expect(await screen.findByRole('link', { name: 'Empréstimo 178176138' })).toHaveAttribute(
      'href',
      '/finance/transactions/t60?tab=payroll_loans',
    );
    first.unmount();
    state.transactions = [
      item({ ...open_installment, income_transaction_id: null, recurrence_id: 'r6' }),
    ];
    renderFinance('/finance/expenses');
    expect(await screen.findByRole('link', { name: 'Empréstimo 178176138' })).toHaveAttribute(
      'href',
      '/finance/recurring-transactions/r6?tab=payroll_loans',
    );
  });
});

describe('payroll loans settlement', () => {
  const account_field = () => screen.getByRole('textbox', { name: 'Valor que caiu na conta (R$)' });

  async function typeAccount(user: User, text: string) {
    await user.clear(account_field());
    await user.type(account_field(), text);
  }

  const settlementBody = (calls: ApiCall[], path: string) =>
    lastCall(calls, 'POST', path)?.body as Record<string, unknown> | undefined;

  it('ct04 settles the income by the amount that reached the account', async () => {
    const { calls } = financeServer(seed());
    const user = userEvent.setup();
    renderFinance('/finance/transactions/t60');
    await pageHeading('Holerite');
    await waitFor(() => {
      expect(plain((account_field() as HTMLInputElement).value)).toBe('R$ 6.923,18');
    });
    expect(
      screen.getByText(
        'Informe o valor que caiu na conta; as parcelas dos consignados são somadas para chegar ao líquido da entrada.',
      ),
    ).toBeInTheDocument();
    const preview = screen.getByRole('region', { name: 'Prévia da liquidação' });
    const list = within(preview).getByRole('list', { name: 'Parcelas dos consignados' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(6);
    expect(plain(preview.textContent)).toContain('Líquido da entrada');
    expect(plain(preview.textContent)).toContain('R$ 10.669,88');
    await user.click(screen.getByRole('button', { name: 'Liquidar' }));
    await waitFor(() => {
      expect(settlementBody(calls, '/transactions/t60/settlement')).toBeDefined();
    });
    const body = settlementBody(calls, '/transactions/t60/settlement');
    expect(body?.account_amount).toBe(692318);
    expect(body).not.toHaveProperty('settled_amount');
  });

  it('ct05 keeps the installments fixed with a different amount', async () => {
    const { calls } = financeServer(seed());
    const user = userEvent.setup();
    renderFinance('/finance/transactions/t60');
    await pageHeading('Holerite');
    await waitFor(() => {
      expect(plain((account_field() as HTMLInputElement).value)).toBe('R$ 6.923,18');
    });
    await typeAccount(user, '7000,00');
    await user.tab();
    const preview = screen.getByRole('region', { name: 'Prévia da liquidação' });
    await waitFor(() => {
      expect(plain(preview.textContent)).toContain('R$ 10.746,70');
    });
    await user.click(screen.getByRole('button', { name: 'Liquidar' }));
    await waitFor(() => {
      expect(settlementBody(calls, '/transactions/t60/settlement')?.account_amount).toBe(700000);
    });
  });

  it('cb04 warns about an amount below the installments and lets it be confirmed', async () => {
    const { calls } = financeServer(seed());
    const user = userEvent.setup();
    renderFinance('/finance/transactions/t60');
    await pageHeading('Holerite');
    await waitFor(() => {
      expect(plain((account_field() as HTMLInputElement).value)).toBe('R$ 6.923,18');
    });
    await typeAccount(user, '3746,69');
    await user.click(screen.getByRole('button', { name: 'Liquidar' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Valor abaixo das parcelas' });
    expect(plain(dialog.textContent)).toContain(
      'O valor que caiu na conta (R$ 3.746,69) é menor que a soma das parcelas dos consignados (R$ 3.746,70). Confira se não houve erro de digitação: a entrada será liquidada com R$ 7.493,39.',
    );
    expect(settlementBody(calls, '/transactions/t60/settlement')).toBeUndefined();
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });
    expect(settlementBody(calls, '/transactions/t60/settlement')).toBeUndefined();
    await user.click(screen.getByRole('button', { name: 'Liquidar' }));
    const again = await screen.findByRole('alertdialog', { name: 'Valor abaixo das parcelas' });
    await user.click(within(again).getByRole('button', { name: 'Liquidar mesmo assim' }));
    await waitFor(() => {
      expect(settlementBody(calls, '/transactions/t60/settlement')).toBeDefined();
    });
    const body = settlementBody(calls, '/transactions/t60/settlement');
    expect(body?.account_amount).toBe(374669);
    expect(body).not.toHaveProperty('settled_amount');
  });

  it('cb04 settles directly with an amount above the installments', async () => {
    const { calls } = financeServer(seed());
    const user = userEvent.setup();
    renderFinance('/finance/transactions/t60');
    await pageHeading('Holerite');
    await waitFor(() => {
      expect(plain((account_field() as HTMLInputElement).value)).toBe('R$ 6.923,18');
    });
    await typeAccount(user, '6923,18');
    await user.click(screen.getByRole('button', { name: 'Liquidar' }));
    await waitFor(() => {
      expect(settlementBody(calls, '/transactions/t60/settlement')?.account_amount).toBe(692318);
    });
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('rf08 settles the occurrence of a recurrence by the amount that reached the account', async () => {
    const state = seed({
      recurring: [
        {
          id: 'r6',
          account_id: 'a1',
          category_id: 'c3',
          currency: 'BRL',
          description: 'Salário',
          expected_amount: 1066988,
          gross_amount: 1066988,
          adjustments: [],
          kind: 'income',
          owner_id: 'u1',
          visibility: 'personal',
          rule: {
            frequency: 'monthly',
            interval: 1,
            weekdays: [],
            month_day: 5,
            time: '12:00',
            timezone: 'America/Sao_Paulo',
            starts_on: '2026-01-05',
            ends_on: null,
          },
          open_occurrence: { occurrence_date: '2026-11-05', status: 'open' },
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
        },
      ],
      payroll_loans: PAYSLIP_LOANS.map((entry) => ({ ...entry, income_recurrence_id: 'r6' })),
    });
    state.override = (call) =>
      call.method === 'POST' && call.path === '/recurring-transactions/r6/settlement'
        ? {
            status: 201,
            body: holerite({
              id: 't80',
              status: 'settled',
              settled_amount: 1066988,
              settled_at: '2026-11-05',
              generated_from: 'r6',
            }),
          }
        : undefined;
    const { calls } = financeServer(state);
    const user = userEvent.setup();
    renderFinance('/finance/recurring-transactions/r6');
    await pageHeading('Salário');
    await waitFor(() => {
      expect(plain((account_field() as HTMLInputElement).value)).toBe('R$ 6.923,18');
    });
    await user.click(screen.getByRole('button', { name: 'Liquidar' }));
    await waitFor(() => {
      expect(settlementBody(calls, '/recurring-transactions/r6/settlement')).toBeDefined();
    });
    const body = settlementBody(calls, '/recurring-transactions/r6/settlement');
    expect(body?.account_amount).toBe(692318);
    expect(body?.occurrence_date).toBe('2026-11-05');
    expect(body).not.toHaveProperty('settled_amount');
  });

  it('rf08 settles an income without loans by the settled amount as before', async () => {
    const { calls } = financeServer(seed({ transactions: [holerite(), salary()] }));
    const user = userEvent.setup();
    renderFinance('/finance/transactions/t20');
    await pageHeading('Salário');
    expect(screen.getByRole('textbox', { name: 'Valor efetivo (R$)' })).toBeInTheDocument();
    expect(
      screen.queryByRole('list', { name: 'Parcelas dos consignados' }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Liquidar' }));
    await waitFor(() => {
      expect(settlementBody(calls, '/transactions/t20/settlement')).toBeDefined();
    });
    const body = settlementBody(calls, '/transactions/t20/settlement');
    expect(body).toHaveProperty('settled_amount');
    expect(body).not.toHaveProperty('account_amount');
  });
});
