import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { clearToasts } from '../../../shared/toast/toast-store';
import type { TransactionItem } from '../hooks/finance-cache';
import {
  account,
  breakdownRows,
  category,
  expectNoNativeControls,
  financeServer,
  item,
  pageHeading,
  problem,
  renderFinance,
  SALARY_ADJUSTMENTS,
  salary,
  settledSalary,
  tabsThrough,
  transaction,
  world,
  type ApiCall,
  type FinanceWorld,
} from '../test-utils';
import finance_css from '../components/finance.module.css?raw';

const plain = (text: string | null | undefined) => (text ?? '').replace(/[  ]/g, ' ');

const RULE = {
  frequency: 'monthly',
  interval: 1,
  weekdays: [],
  month_day: 31,
  time: '12:00',
  timezone: 'America/Sao_Paulo',
  starts_on: '2026-01-31',
  ends_on: null,
};

function rent(overrides: Record<string, unknown> = {}) {
  return {
    id: 'r1',
    account_id: 'a1',
    category_id: 'c2',
    currency: 'BRL',
    description: 'Aluguel',
    expected_amount: 200000,
    gross_amount: 200000,
    adjustments: [],
    kind: 'expense',
    owner_id: 'u1',
    visibility: 'personal',
    rule: RULE,
    open_occurrence: { occurrence_date: '2026-10-31', status: 'overdue' },
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

const VIRTUAL_OPEN: TransactionItem = item({
  id: null,
  recurrence_id: 'r1',
  occurrence_date: '2026-10-31',
  expected_date: '2026-10-31',
  effective_date: '2026-11-01',
  status: 'overdue',
  description: 'Aluguel',
  category_id: 'c2',
  expected_amount: 200000,
});

const VIRTUAL_FORECAST: TransactionItem = item({
  id: null,
  recurrence_id: 'r1',
  occurrence_date: '2026-11-30',
  expected_date: '2026-11-30',
  effective_date: '2026-11-30',
  status: 'forecast',
  description: 'Aluguel',
  category_id: 'c2',
  expected_amount: 200000,
});

const COPY = transaction({
  id: 't9',
  description: 'Aluguel',
  category_id: 'c2',
  status: 'settled',
  expected_amount: 200000,
  settled_amount: 200000,
  settled_at: '2026-09-30',
  effective_date: '2026-09-30',
  occurrence_date: '2026-09-30',
  generated_from: 'r1',
  recurrence_id: 'r1',
});

function seed(): FinanceWorld {
  return world({
    accounts: [
      account({ id: 'a1', name: 'Conta', is_default: true, balance_amount: 500000 }),
      account({ id: 'a2', name: 'Carteira', balance_amount: 10000 }),
      account({ id: 'a3', name: 'Cartão Nu' }),
    ],
    categories: [
      category({ id: 'c1', name: 'Mercado', kind: 'expense', color: 'warning' }),
      category({ id: 'c2', name: 'Casa', kind: 'expense', color: 'info' }),
      category({ id: 'c3', name: 'Salário', kind: 'income', color: 'success' }),
    ],
    transactions: [
      transaction({ id: 't1', description: 'Feira', category_id: 'c1', expected_amount: 10000 }),
      transaction({
        id: 't2',
        description: 'Luz',
        category_id: 'c2',
        status: 'settled',
        expected_amount: 20000,
        settled_amount: 18000,
        settled_at: '2026-11-03',
        effective_date: '2026-11-03',
        difference_amount: -2000,
        difference_kind: 'saving',
      }),
      transaction({
        id: 't3',
        kind: 'income',
        description: 'Salário de novembro',
        category_id: 'c3',
        expected_amount: 600000,
      }),
      transaction({
        id: 't4',
        description: 'Antigo',
        category_id: 'c1',
        expected_date: '2026-10-05',
        effective_date: '2026-10-05',
      }),
      VIRTUAL_OPEN,
      VIRTUAL_FORECAST,
      COPY,
      salary(),
      settledSalary(),
    ],
    recurring: [rent()],
    copies: { r1: [COPY] },
    transfers: [
      {
        id: 'tr1',
        from_account_id: 'a1',
        to_account_id: 'a2',
        amount: 5000,
        currency: 'BRL',
        transferred_on: '2026-11-04',
        description: 'Troco',
        owner_id: 'u1',
        visibility: 'personal',
        created_at: '2026-11-04T10:00:00Z',
        updated_at: '2026-11-04T10:00:00Z',
      },
    ],
  });
}

function lastCall(calls: ApiCall[], method: string, path: string) {
  return [...calls].reverse().find((call) => call.method === method && call.path === path);
}

async function chooseOption(label: string, option: string) {
  const user = userEvent.setup();
  await user.click(screen.getByLabelText(label));
  await user.click(await screen.findByRole('option', { name: option }));
}

/** Abre um item novo no editor e preenche o nome e o percentual. */
async function addPercent(
  user: ReturnType<typeof userEvent.setup>,
  number: number,
  name: string,
  rate: string,
) {
  await user.click(screen.getByRole('button', { name: 'Adicionar desconto ou acréscimo' }));
  const group = screen.getByRole('group', { name: `Item ${String(number)}` });
  await user.type(within(group).getByRole('textbox', { name: 'Nome do item' }), name);
  await user.type(within(group).getByRole('textbox', { name: 'Percentual (%)' }), rate);
  return group;
}

const INSS = { name: 'INSS', direction: 'deduction', mode: 'percent', rate_bp: 1100 };
const IRPF = {
  name: 'IRPF',
  direction: 'deduction',
  mode: 'percent',
  rate_bp: 1500,
  base_amount: 712000,
};

/** Linhas da prévia da liquidação, depois de a resposta do servidor chegar. */
async function previewRows(text: string) {
  const preview = screen.getByRole('region', { name: 'Prévia da liquidação' });
  await waitFor(() => {
    expect(breakdownRows(preview.querySelector('dl') as Element)).toContain(text);
  });
  return breakdownRows(preview.querySelector('dl') as Element);
}

async function typeSettled(user: ReturnType<typeof userEvent.setup>, text: string) {
  const amount = screen.getByRole('textbox', { name: 'Valor efetivo (R$)' });
  await user.clear(amount);
  await user.type(amount, text);
}

/** Abre a edição dos itens na liquidação e troca o percentual do IRPF (Item 2). */
async function editIrpf(user: ReturnType<typeof userEvent.setup>, rate: string) {
  await user.click(screen.getByRole('button', { name: 'Editar descontos e acréscimos' }));
  const field = within(screen.getByRole('group', { name: 'Item 2' })).getByRole('textbox', {
    name: 'Percentual (%)',
  });
  await user.clear(field);
  await user.type(field, rate);
}

function liveNet() {
  const editor = screen.getByRole('group', { name: 'Descontos e acréscimos' });
  return plain(within(editor).getByRole('status').textContent);
}

async function rowOf(name: string) {
  const link = await screen.findByRole('link', { name });
  const row = link.closest('li');
  if (!row) throw new Error(`sem linha para ${name}`);
  return row;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-11-05T12:00:00Z') });
});

afterEach(() => {
  vi.useRealTimers();
  clearToasts();
  vi.unstubAllGlobals();
});

describe('incomes and expenses', () => {
  it('lists incomes and expenses in their own tabs', async () => {
    const { calls } = financeServer(seed());
    const user = userEvent.setup();
    const { container } = renderFinance('/finance/expenses');
    await pageHeading('Financeiro');
    expect(await screen.findByRole('link', { name: 'Feira' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Salário de novembro' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Saídas' })).toHaveAttribute('aria-current', 'page');
    expect(lastCall(calls, 'GET', '/transactions')?.url.searchParams.get('kind')).toBe('expense');
    await tabsThrough(user);
    expect(await axe(container)).toHaveNoViolations();
    await user.click(screen.getByRole('link', { name: 'Entradas' }));
    expect(await screen.findByRole('link', { name: 'Salário de novembro' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Feira' })).toBeNull();
  });

  it('ct08 shows incomes with plus in green and expenses with minus in the lists', async () => {
    financeServer(seed());
    const first = renderFinance('/finance/income');
    await screen.findByRole('link', { name: 'Salário de novembro' });
    const incomes = [...document.querySelectorAll<HTMLElement>('li [data-kind]')];
    expect(incomes.length).toBeGreaterThan(0);
    for (const amount of incomes) {
      expect(amount.textContent.replace(/[\u00a0\u202f]/g, ' ')).toMatch(/^\+R\$/);
      expect(amount.className).toContain('positive');
    }
    first.unmount();
    renderFinance('/finance/expenses');
    await screen.findByRole('link', { name: 'Feira' });
    const expenses = [...document.querySelectorAll<HTMLElement>('li [data-kind]')];
    expect(expenses.length).toBeGreaterThan(0);
    for (const amount of expenses) {
      expect(amount.textContent.replace(/[\u00a0\u202f]/g, ' ')).toMatch(/^\u2212R\$/);
      expect(amount.className).not.toContain('positive');
      expect(amount.className).not.toContain('negative');
    }
  });

  it('keeps the view switcher only as wide as its options', async () => {
    financeServer(seed());
    renderFinance('/finance/expenses');
    await screen.findByRole('link', { name: 'Feira' });
    const view = screen.getByRole('group', { name: 'Visualização' });
    expect(view.closest('[role="group"][aria-label="Filtros"]')).toBeNull();
    expect(screen.getByRole('group', { name: 'Filtros' }).className).toContain('filterFields');
    expect(finance_css).not.toMatch(/\.filters\s*>\s*\*/);
  });

  it('shows the period without a visible label in the header', async () => {
    financeServer(seed());
    renderFinance('/finance/expenses');
    await screen.findByRole('link', { name: 'Feira' });
    const button = screen.getByRole('button', { name: /Período/ });
    const hidden = Array.from(document.querySelectorAll('span')).filter(
      (node) => node.textContent === 'Período',
    );
    expect(hidden.length).toBeGreaterThan(0);
    for (const node of hidden) {
      expect(node.className).toContain('srOnly');
    }
    expect(button.textContent).not.toContain('Período');
  });

  it('filters by repetition chips, account and category through the url', async () => {
    const { calls } = financeServer(seed());
    const user = userEvent.setup();
    const { router } = renderFinance('/finance/expenses');
    await screen.findByRole('link', { name: 'Feira' });
    const filters = screen.getByRole('group', { name: 'Filtros' });
    await user.click(within(filters).getByRole('button', { name: 'Recorrentes' }));
    await waitFor(() => {
      expect(router.state.location.search).toMatchObject({ repetition: 'recurring' });
    });
    await waitFor(() => {
      expect(lastCall(calls, 'GET', '/transactions')?.url.searchParams.get('repetition')).toBe(
        'recurring',
      );
    });
    await chooseOption('Conta', 'Carteira');
    await waitFor(() => {
      expect(router.state.location.search).toMatchObject({ account_id: 'a2' });
    });
    await chooseOption('Categoria', 'Mercado');
    await waitFor(() => {
      expect(router.state.location.search).toMatchObject({ category_id: 'c1' });
    });
    // O seletor de categoria só traz as do tipo da aba (PD-58).
    await user.click(screen.getByLabelText('Categoria'));
    expect(screen.queryByRole('option', { name: 'Salário' })).toBeNull();
    const params = lastCall(calls, 'GET', '/transactions')?.url.searchParams;
    expect(params?.get('account_id')).toBe('a2');
    expect(params?.get('category_id')).toBe('c1');
  });

  it('ct15 filters the category by typing and picks it with the keyboard', async () => {
    const { calls } = financeServer(seed());
    const user = userEvent.setup();
    const { router } = renderFinance('/finance/expenses');
    await screen.findByRole('link', { name: 'Feira' });
    const field = screen.getByRole('combobox', { name: 'Categoria' });
    expect(field).toHaveValue('Todas');
    await user.click(field);
    await user.keyboard('ca');
    // O autocomplete busca por trecho do nome: "ca" também acha "Mercado".
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
      'Casa',
      'Mercado',
    ]);
    await user.keyboard('{Control>}a{/Control}{Backspace}a');
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
      'Todas',
      'Casa',
      'Mercado',
    ]);
    // A primeira opção já nasce ativa.
    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowUp}');
    const casa = screen.getByRole('option', { name: 'Casa' });
    expect(field).toHaveAttribute('aria-activedescendant', casa.id);
    await user.keyboard('{Enter}');
    await waitFor(() => {
      expect(router.state.location.search).toMatchObject({ category_id: 'c2' });
    });
    await waitFor(() => {
      expect(lastCall(calls, 'GET', '/transactions')?.url.searchParams.get('category_id')).toBe(
        'c2',
      );
    });
    expect(field).toHaveValue('Casa');
    await router.navigate({ to: '/finance/income' });
    const income = await screen.findByRole('combobox', { name: 'Categoria' });
    await user.click(income);
    await user.keyboard('sal');
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual(['Salário']);
  });

  it('cb10 keeps the previous category when nothing matches', async () => {
    financeServer(seed());
    const user = userEvent.setup();
    const { router } = renderFinance('/finance/expenses?category_id=c1');
    const field = await screen.findByRole('combobox', { name: 'Categoria' });
    await waitFor(() => {
      expect(field).toHaveValue('Mercado');
    });
    await user.click(field);
    await user.keyboard('{Control>}a{/Control}{Backspace}xyz');
    expect(screen.getByRole('status')).toHaveTextContent('Nenhuma categoria encontrada');
    expect(screen.queryAllByRole('option')).toHaveLength(0);
    await user.keyboard('{Enter}{Escape}');
    expect(router.state.location.search).toMatchObject({ category_id: 'c1' });
    expect(field).toHaveValue('Mercado');
  });

  it('filters by the global period using the effective date', async () => {
    const { calls } = financeServer(seed());
    const { router } = renderFinance('/finance/expenses?period=last_month');
    expect(await screen.findByRole('link', { name: 'Antigo' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Feira' })).toBeNull();
    const params = lastCall(calls, 'GET', '/transactions')?.url.searchParams;
    expect(params?.get('from')).toBe('2026-10-01');
    expect(params?.get('to')).toBe('2026-10-31');
    // O período segue ao trocar de aba e some nas abas sem período.
    expect(screen.getByRole('link', { name: 'Entradas' })).toHaveAttribute(
      'href',
      '/finance/income?period=last_month',
    );
    expect(screen.getByRole('link', { name: 'Contas' })).toHaveAttribute(
      'href',
      '/finance/accounts',
    );
    await userEvent.click(screen.getByRole('link', { name: 'Contas' }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/finance/accounts');
    });
    expect(screen.queryByRole('button', { name: /Período/ })).toBeNull();
  });

  it('lists the open occurrence and the forecast of a recurrence', async () => {
    financeServer(seed());
    renderFinance('/finance/expenses?repetition=recurring');
    const links = await screen.findAllByRole('link', { name: 'Aluguel' });
    const hrefs = links.map((link) => link.getAttribute('href'));
    expect(hrefs).toContain('/finance/recurring-transactions/r1');
    const rows = links.map((link) => link.closest('li') as HTMLElement);
    const texts = rows.map((row) => row.textContent);
    expect(texts.some((text) => text.includes('Atrasada'))).toBe(true);
    expect(texts.some((text) => text.includes('Previsão'))).toBe(true);
    expect(texts.every((text) => text.includes('Recorrente'))).toBe(true);
    expect(document.querySelectorAll('li .danger')).toHaveLength(0);
  });

  it('searches incomes and expenses on the server', async () => {
    const { calls } = financeServer(seed());
    const user = userEvent.setup();
    const { router } = renderFinance('/finance/expenses');
    await screen.findByRole('link', { name: 'Feira' });
    await user.type(screen.getByRole('searchbox', { name: 'Busca' }), 'luz');
    await waitFor(() => {
      expect(router.state.location.search).toMatchObject({ q: 'luz' });
    });
    await waitFor(() => {
      expect(lastCall(calls, 'GET', '/transactions')?.url.searchParams.get('q')).toBe('luz');
    });
    expect(await screen.findByRole('link', { name: 'Luz' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Feira' })).toBeNull();
    await user.clear(screen.getByRole('searchbox', { name: 'Busca' }));
    await user.type(screen.getByRole('searchbox', { name: 'Busca' }), 'nada disso');
    expect(await screen.findByText('Nada encontrado para "nada disso".')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Limpar busca' }));
    expect(await screen.findByRole('link', { name: 'Feira' })).toBeInTheDocument();
  });

  it('shows expenses empty, loading and error', async () => {
    const state = world();
    let mode: 'hang' | 'error' | 'ok' = 'hang';
    state.override = (call) => {
      if (call.path !== '/transactions') return undefined;
      if (mode === 'hang') return { hang: true };
      if (mode === 'error') return problem(500, 'internal_error');
      return undefined;
    };
    financeServer(state);
    const first = renderFinance('/finance/expenses');
    expect(await screen.findByRole('status')).toHaveAttribute('aria-busy', 'true');
    first.unmount();
    mode = 'error';
    renderFinance('/finance/expenses');
    const alert = await screen.findByRole('alert');
    mode = 'ok';
    await userEvent.click(within(alert).getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByText('Nada registrado neste período.')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Novo registro' }).length).toBeGreaterThan(1);
  });
});

describe('transaction forms', () => {
  it('opens the form with the kind and a category of the same kind', async () => {
    financeServer(seed());
    renderFinance('/finance/transactions/new?kind=expense');
    await pageHeading('Nova saída');
    expect(screen.queryByRole('radiogroup', { name: 'Tipo' })).toBeNull();
    expect(screen.queryByLabelText('Tipo')).toBeNull();
    // A categoria começa vazia: nada é escolhido pelo usuário sem ele pedir.
    expect(screen.getByLabelText('Categoria')).toHaveTextContent('Sem categoria');
    await userEvent.click(screen.getByLabelText('Categoria'));
    const names = screen.getAllByRole('option').map((option) => option.textContent);
    expect(names).toEqual(['Sem categoria', 'Casa', 'Mercado']);
    expect(screen.queryByRole('option', { name: 'Salário' })).toBeNull();
  });

  it('starts without category and saves a null category', async () => {
    const { calls } = financeServer(seed());
    const user = userEvent.setup();
    renderFinance('/finance/transactions/new?kind=expense');
    await pageHeading('Nova saída');
    await user.type(screen.getByRole('textbox', { name: 'Descrição' }), 'Farmácia');
    await chooseOption('Conta', 'Conta');
    await user.type(screen.getByRole('textbox', { name: 'Valor previsto (R$)' }), '45,90');
    await user.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => {
      expect(lastCall(calls, 'POST', '/transactions')).toBeDefined();
    });
    expect(lastCall(calls, 'POST', '/transactions')?.body).toMatchObject({ category_id: null });
  });

  it('offers only Sem categoria and the create link without categories', async () => {
    financeServer({ ...seed(), categories: [] });
    renderFinance('/finance/transactions/new?kind=expense');
    await pageHeading('Nova saída');
    expect(screen.getByLabelText('Categoria')).toHaveTextContent('Sem categoria');
    expect(screen.getByText('Nenhuma categoria deste tipo ainda.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Criar categoria' })).toHaveAttribute(
      'href',
      '/finance/categories/new?kind=expense',
    );
    await userEvent.click(screen.getByLabelText('Categoria'));
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
      'Sem categoria',
    ]);
  });

  it('masks the amount while typing and pasting', async () => {
    const { calls } = financeServer(seed());
    const user = userEvent.setup();
    const first = renderFinance('/finance/transactions/new?kind=expense');
    await pageHeading('Nova saída');
    await user.type(screen.getByRole('textbox', { name: 'Descrição' }), 'Farmácia');
    await chooseOption('Conta', 'Conta');
    const typed = screen.getByRole('textbox', { name: 'Valor previsto (R$)' });
    await user.type(typed, '14500');
    expect((typed as HTMLInputElement).value).toMatch(/^R\$\s14\.500$/);
    await user.tab();
    expect((typed as HTMLInputElement).value).toMatch(/^R\$\s14\.500,00$/);
    await user.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => {
      expect(lastCall(calls, 'POST', '/transactions')).toBeDefined();
    });
    expect(lastCall(calls, 'POST', '/transactions')?.body).toMatchObject({
      expected_amount: 1450000,
    });
    first.unmount();

    calls.length = 0;
    renderFinance('/finance/transactions/new?kind=expense');
    await pageHeading('Nova saída');
    await user.type(screen.getByRole('textbox', { name: 'Descrição' }), 'Farmácia');
    await chooseOption('Conta', 'Conta');
    const pasted = screen.getByRole('textbox', { name: 'Valor previsto (R$)' });
    await user.clear(pasted);
    await user.click(pasted);
    await user.paste('14500,5');
    await user.tab();
    expect((pasted as HTMLInputElement).value).toMatch(/^R\$\s14\.500,50$/);
    await user.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => {
      expect(lastCall(calls, 'POST', '/transactions')).toBeDefined();
    });
    expect(lastCall(calls, 'POST', '/transactions')?.body).toMatchObject({
      expected_amount: 1450050,
    });
  });

  it('refuses an empty amount', async () => {
    const { calls } = financeServer(seed());
    const user = userEvent.setup();
    renderFinance('/finance/transactions/new?kind=expense');
    await pageHeading('Nova saída');
    await user.type(screen.getByRole('textbox', { name: 'Descrição' }), 'Farmácia');
    await chooseOption('Conta', 'Conta');
    const amount = screen.getByRole('textbox', { name: 'Valor previsto (R$)' });
    await user.type(amount, '5');
    await user.clear(amount);
    await user.click(screen.getByRole('button', { name: 'Salvar' }));
    expect((await screen.findAllByRole('alert')).length).toBeGreaterThan(0);
    expect(lastCall(calls, 'POST', '/transactions')).toBeUndefined();
  });

  it('creates an expense with expected amount and date', async () => {
    const { calls } = financeServer(seed());
    const user = userEvent.setup();
    const { router, container } = renderFinance('/finance/transactions/new?kind=expense');
    await pageHeading('Nova saída');
    await user.click(screen.getByRole('button', { name: 'Salvar' }));
    expect((await screen.findAllByRole('alert')).length).toBeGreaterThan(0);
    await user.type(screen.getByRole('textbox', { name: 'Descrição' }), 'Farmácia');
    await chooseOption('Conta', 'Conta');
    await user.type(screen.getByRole('textbox', { name: 'Valor previsto (R$)' }), '45,90');
    expect(screen.getByLabelText('Data prevista')).toHaveTextContent('05/11/2026');
    expect(await axe(container)).toHaveNoViolations();
    await user.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => {
      expect(lastCall(calls, 'POST', '/transactions')).toBeDefined();
    });
    const post = lastCall(calls, 'POST', '/transactions');
    expect(post?.body).toEqual({
      kind: 'expense',
      account_id: 'a1',
      category_id: null,
      description: 'Farmácia',
      expected_amount: 4590,
      expected_date: '2026-11-05',
      visibility: 'personal',
    });
    expect(post?.headers['Idempotency-Key']).toMatch(/[0-9a-f-]{36}/);
    await waitFor(() => {
      expect(router.state.location.pathname).toMatch(/^\/finance\/transactions\/t-new/);
    });
  });

  it('rf07 creates an expense without installments on any account', async () => {
    const { calls } = financeServer(seed());
    const user = userEvent.setup();
    const { router } = renderFinance('/finance/transactions/new?kind=expense');
    await pageHeading('Nova saída');
    await chooseOption('Conta', 'Cartão Nu');
    await user.type(screen.getByRole('textbox', { name: 'Valor previsto (R$)' }), '300');
    expect(screen.queryByRole('textbox', { name: 'Parcelas' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => {
      expect(router.state.location.pathname).toMatch(/^\/finance\/transactions\/t-new-/);
    });
    expect(lastCall(calls, 'POST', '/transactions')?.body).not.toHaveProperty('installments');
    expect(screen.queryByRole('textbox', { name: 'Parcelas' })).toBeNull();
  });

  it('creates a monthly recurrence on day 31', async () => {
    const { calls } = financeServer(seed());
    const user = userEvent.setup();
    const { router, container } = renderFinance('/finance/transactions/new?kind=expense');
    await pageHeading('Nova saída');
    await user.type(screen.getByRole('textbox', { name: 'Descrição' }), 'Aluguel');
    await chooseOption('Conta', 'Conta');
    await user.type(screen.getByRole('textbox', { name: 'Valor previsto (R$)' }), '2.000');
    await user.click(screen.getByRole('checkbox', { name: 'Repetir' }));
    await chooseOption('Dia do mês', '31');
    expect(screen.queryByLabelText(/Horário/)).toBeNull();
    expect(screen.queryByLabelText('Data prevista')).toBeNull();
    expectNoNativeControls(container);
    await user.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => {
      expect(lastCall(calls, 'POST', '/recurring-transactions')).toBeDefined();
    });
    const body = lastCall(calls, 'POST', '/recurring-transactions')?.body as {
      rule: Record<string, unknown>;
      expected_amount: number;
    };
    expect(body.expected_amount).toBe(200000);
    expect(body.rule).toMatchObject({
      frequency: 'monthly',
      month_day: 31,
      timezone: 'America/Sao_Paulo',
      starts_on: '2026-11-05',
      time: '12:00',
    });
    expect(lastCall(calls, 'POST', '/transactions')).toBeUndefined();
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/finance/expenses');
    });
    expect(
      await screen.findByText(/Recorrência salva\. A primeira ocorrência fica para .*2026/),
    ).toBeInTheDocument();
  });

  it('saves a recurrence only once on a double click', async () => {
    const state = seed();
    state.override = (call) =>
      call.method === 'POST' && call.path === '/recurring-transactions'
        ? { hang: true }
        : undefined;
    const { calls } = financeServer(state);
    const user = userEvent.setup();
    renderFinance('/finance/transactions/new?kind=expense');
    await pageHeading('Nova saída');
    await user.type(screen.getByRole('textbox', { name: 'Descrição' }), 'Aluguel');
    await chooseOption('Conta', 'Conta');
    await user.type(screen.getByRole('textbox', { name: 'Valor previsto (R$)' }), '2000');
    await user.click(screen.getByRole('checkbox', { name: 'Repetir' }));
    await user.dblClick(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => {
      expect(calls.filter((call) => call.path === '/recurring-transactions')).toHaveLength(1);
    });
    expect(screen.getByRole('button', { name: /Salvar/ })).toHaveAttribute('aria-busy', 'true');
  });

  it('changes a recurrence for the open occurrence and the next ones', async () => {
    const { calls } = financeServer(seed());
    const user = userEvent.setup();
    const { router } = renderFinance('/finance/recurring-transactions/r1/edit');
    await pageHeading('Editar recorrência');
    expect(
      screen.getAllByText(
        'Vale para a ocorrência aberta e as próximas. As já liquidadas não mudam.',
      ).length,
    ).toBeGreaterThan(0);
    const amount = screen.getByRole('textbox', { name: 'Valor (R$)' });
    await user.clear(amount);
    await user.type(amount, '2.100');
    await user.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/finance/recurring-transactions/r1');
    });
    const body = lastCall(calls, 'PATCH', '/recurring-transactions/r1')?.body as Record<
      string,
      unknown
    >;
    expect(body.expected_amount).toBe(210000);
    expect(Object.keys(body).sort()).toEqual([
      'account_id',
      'category_id',
      'description',
      'expected_amount',
      'rule',
    ]);
    expect(body.rule).toMatchObject({ month_day: 31 });
  });

  it('edits a transaction from the detail', async () => {
    const { calls } = financeServer(seed());
    const user = userEvent.setup();
    const { router } = renderFinance('/finance/transactions/t1');
    await pageHeading('Feira');
    await user.click(screen.getByRole('button', { name: 'Editar' }));
    await pageHeading('Editar saída');
    expect(screen.queryByRole('checkbox', { name: 'Repetir' })).toBeNull();
    const description = screen.getByRole('textbox', { name: 'Descrição' });
    await user.clear(description);
    await user.type(description, 'Feira da semana');
    await user.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/finance/transactions/t1');
    });
    expect(lastCall(calls, 'PATCH', '/transactions/t1')?.body).toEqual({
      description: 'Feira da semana',
    });
  });

  it('disables amount, date and account when editing a settled transaction', async () => {
    const state = seed();
    state.override = (call) =>
      call.method === 'PATCH' ? problem(409, 'transaction_already_settled') : undefined;
    financeServer(state);
    const user = userEvent.setup();
    renderFinance('/finance/transactions/t2/edit');
    await pageHeading('Editar saída');
    expect(
      screen.getAllByText(
        'Já liquidada: valor, data e conta não mudam. Desfaça a liquidação para alterá-los.',
      ).length,
    ).toBeGreaterThan(0);
    expect(screen.getByRole('textbox', { name: 'Valor previsto' })).toBeDisabled();
    expect(screen.getByLabelText('Conta')).toBeDisabled();
    expect(screen.getByLabelText('Data prevista')).toBeDisabled();
    expect(screen.getByLabelText('Categoria')).not.toBeDisabled();
    const description = screen.getByRole('textbox', { name: 'Descrição' });
    await user.type(description, ' de casa');
    await user.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(
      await screen.findByText('Esta movimentação já foi liquidada. A tela foi atualizada.'),
    ).toHaveAttribute('role', 'alert');
  });

  it('uses the custom select, segmented groups and calendar date fields in the forms', async () => {
    financeServer(seed());
    const user = userEvent.setup();
    const { container } = renderFinance('/finance/transactions/new?kind=income');
    await pageHeading('Nova entrada');
    expectNoNativeControls(container);
    expect(screen.getByLabelText('Conta')).toHaveAttribute('aria-haspopup', 'listbox');
    expect(screen.getByRole('radiogroup', { name: 'Visibilidade' })).toBeInTheDocument();
    const date = screen.getByLabelText('Data prevista');
    expect(date).toHaveAttribute('aria-haspopup', 'dialog');
    await user.click(date);
    expect(await screen.findByRole('dialog', { name: 'Data prevista' })).toBeInTheDocument();
    const grid = container.querySelector('[data-span="full"] [role="radiogroup"]');
    expect(grid).not.toBeNull();
    const transfer = renderFinance('/finance/transfers/new');
    await waitFor(() => {
      expect(transfer.container.querySelector('[aria-haspopup="listbox"]')).not.toBeNull();
    });
    expectNoNativeControls(transfer.container);
  });

  it('ct11 updates the expected net while editing the gross and a percent', async () => {
    financeServer(seed());
    const user = userEvent.setup();
    renderFinance('/finance/transactions/new?kind=income');
    await pageHeading('Nova entrada');
    const gross = screen.getByRole('textbox', { name: 'Valor previsto (R$)' });
    await user.type(gross, '8.000,00');
    const group = await addPercent(user, 1, 'INSS', '11');
    expect(liveNet()).toBe('Líquido previsto: R$ 7.120,00');
    await user.clear(gross);
    await user.type(gross, '9.000,00');
    expect(liveNet()).toBe('Líquido previsto: R$ 8.010,00');
    const rate = within(group).getByRole('textbox', { name: 'Percentual (%)' });
    await user.clear(rate);
    await user.type(rate, '12');
    expect(liveNet()).toBe('Líquido previsto: R$ 7.920,00');
  });

  it('ct11 shows the same net as the shared table case ct02 and sends gross and items', async () => {
    const { calls } = financeServer(seed());
    const user = userEvent.setup();
    const { router } = renderFinance('/finance/transactions/new?kind=income');
    await pageHeading('Nova entrada');
    await user.type(screen.getByRole('textbox', { name: 'Descrição' }), 'Salário');
    await chooseOption('Conta', 'Conta');
    await user.type(screen.getByRole('textbox', { name: 'Valor previsto (R$)' }), '8.000,00');
    await addPercent(user, 1, 'INSS', '11');
    const irpf = await addPercent(user, 2, 'IRPF', '15');
    await user.click(within(irpf).getByLabelText('Base diferente do bruto'));
    await user.type(
      within(irpf).getByRole('textbox', { name: 'Base de cálculo (R$)' }),
      '7.120,00',
    );
    expect(liveNet()).toBe('Líquido previsto: R$ 6.052,00');
    await user.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => {
      expect(lastCall(calls, 'POST', '/transactions')).toBeDefined();
    });
    expect(lastCall(calls, 'POST', '/transactions')?.body).toEqual({
      kind: 'income',
      account_id: 'a1',
      category_id: null,
      description: 'Salário',
      gross_amount: 800000,
      adjustments: [
        { name: 'INSS', direction: 'deduction', mode: 'percent', rate_bp: 1100 },
        {
          name: 'IRPF',
          direction: 'deduction',
          mode: 'percent',
          rate_bp: 1500,
          base_amount: 712000,
        },
      ],
      expected_date: '2026-11-05',
      visibility: 'personal',
    });
    await waitFor(() => {
      expect(router.state.location.pathname).toMatch(/^\/finance\/transactions\/t-new/);
    });
  });

  it('cb03 refuses items that leave the expected net at zero or below', async () => {
    const { calls } = financeServer(seed());
    const user = userEvent.setup();
    renderFinance('/finance/transactions/new?kind=expense');
    await pageHeading('Nova saída');
    await chooseOption('Conta', 'Conta');
    await user.type(screen.getByRole('textbox', { name: 'Valor previsto (R$)' }), '100,00');
    await user.click(screen.getByRole('button', { name: 'Adicionar desconto ou acréscimo' }));
    const group = screen.getByRole('group', { name: 'Item 1' });
    await user.type(within(group).getByRole('textbox', { name: 'Nome do item' }), 'Cupom');
    await user.click(within(group).getByText('Valor fixo'));
    await user.type(within(group).getByRole('textbox', { name: 'Valor do item (R$)' }), '100,00');
    await user.click(screen.getByRole('button', { name: 'Salvar' }));
    const alerts = await screen.findAllByRole('alert');
    expect(alerts.map((alert) => alert.textContent)).toContain(
      'Os descontos deixam o líquido previsto zerado ou negativo. Revise os itens.',
    );
    expect(lastCall(calls, 'POST', '/transactions')).toBeUndefined();
  });

  it('cb09 refuses a different base without a value', async () => {
    const { calls } = financeServer(seed());
    const user = userEvent.setup();
    renderFinance('/finance/transactions/new?kind=income');
    await pageHeading('Nova entrada');
    await chooseOption('Conta', 'Conta');
    await user.type(screen.getByRole('textbox', { name: 'Valor previsto (R$)' }), '8.000,00');
    const group = await addPercent(user, 1, 'IRPF', '15');
    await user.click(within(group).getByLabelText('Base diferente do bruto'));
    await user.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(await within(group).findByText('Informe uma base maior que zero.')).toBeInTheDocument();
    expect(lastCall(calls, 'POST', '/transactions')).toBeUndefined();
  });

  it('rf13 edits the items of a transaction and sends only what changed', async () => {
    const { calls } = financeServer(seed());
    const user = userEvent.setup();
    const { router } = renderFinance('/finance/transactions/t20/edit');
    await pageHeading('Editar entrada');
    expect(
      plain(screen.getByRole<HTMLInputElement>('textbox', { name: 'Valor previsto (R$)' }).value),
    ).toBe('R$ 8.000,00');
    const first = screen.getByRole('group', { name: 'Item 1' });
    const second = screen.getByRole('group', { name: 'Item 2' });
    expect(within(first).getByRole('textbox', { name: 'Nome do item' })).toHaveValue('INSS');
    expect(within(first).getByRole('textbox', { name: 'Percentual (%)' })).toHaveValue('11,00');
    expect(within(second).getByRole('textbox', { name: 'Percentual (%)' })).toHaveValue('15,00');
    expect(
      plain(
        within(second).getByRole<HTMLInputElement>('textbox', { name: 'Base de cálculo (R$)' })
          .value,
      ),
    ).toBe('R$ 7.120,00');
    await user.click(screen.getByRole('button', { name: 'Remover IRPF' }));
    await user.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/finance/transactions/t20');
    });
    expect(lastCall(calls, 'PATCH', '/transactions/t20')?.body).toEqual({
      adjustments: [{ name: 'INSS', direction: 'deduction', mode: 'percent', rate_bp: 1100 }],
    });
  });

  it('rf02 creates a recurrence with items', async () => {
    const { calls } = financeServer(seed());
    const user = userEvent.setup();
    renderFinance('/finance/transactions/new?kind=expense');
    await pageHeading('Nova saída');
    await user.type(screen.getByRole('textbox', { name: 'Descrição' }), 'Plano');
    await chooseOption('Conta', 'Conta');
    await user.type(screen.getByRole('textbox', { name: 'Valor previsto (R$)' }), '200,00');
    await user.click(screen.getByRole('checkbox', { name: 'Repetir' }));
    await addPercent(user, 1, 'Desconto', '10');
    await user.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => {
      expect(lastCall(calls, 'POST', '/recurring-transactions')).toBeDefined();
    });
    const body = lastCall(calls, 'POST', '/recurring-transactions')?.body as Record<
      string,
      unknown
    >;
    expect(body.gross_amount).toBe(20000);
    expect(body.adjustments).toEqual([
      { name: 'Desconto', direction: 'deduction', mode: 'percent', rate_bp: 1000 },
    ]);
    expect(body).not.toHaveProperty('expected_amount');
  });
});

describe('settlement and detail', () => {
  it('ct10 shows the gross, each item and the net expected and settled', async () => {
    financeServer(seed());
    const { container } = renderFinance('/finance/transactions/t21');
    await pageHeading('Salário');
    const region = screen.getByRole('region', { name: 'Descontos e acréscimos' });
    expect(within(region).getByRole('heading', { name: 'Previsto' })).toBeInTheDocument();
    expect(within(region).getByRole('heading', { name: 'Liquidado' })).toBeInTheDocument();
    const [expected, settled] = Array.from(region.querySelectorAll('dl'));
    expect(breakdownRows(expected as Element)).toEqual([
      'Valor bruto R$ 8.000,00',
      'INSS 11,00% do bruto −R$ 880,00',
      'IRPF 15,00% de R$ 7.120,00 −R$ 1.068,00',
      'Líquido previsto R$ 6.052,00',
    ]);
    expect(breakdownRows(settled as Element)).toEqual([
      'Valor bruto R$ 8.592,20',
      'INSS 11,00% do bruto −R$ 945,14',
      'IRPF 15,00% de R$ 7.647,06 −R$ 1.147,06',
      'Líquido liquidado R$ 6.500,00',
    ]);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('cb06 shows a transaction without items as before', async () => {
    financeServer(seed());
    renderFinance('/finance/transactions/t1');
    await pageHeading('Feira');
    expect(screen.queryByRole('region', { name: 'Descontos e acréscimos' })).toBeNull();
    const label = screen.getByText('Valor previsto', { selector: 'dt' });
    expect(plain(label.nextElementSibling?.textContent)).toBe('R$ 100,00');
  });

  it('rf09 settles by the net and shows the gross recalculated by the server', async () => {
    const { calls } = financeServer(seed());
    const user = userEvent.setup();
    const { container } = renderFinance('/finance/transactions/t20');
    await pageHeading('Salário');
    expect(
      screen.getByText(
        'Informe o líquido que entrou ou saiu da conta; o bruto e os percentuais são recalculados.',
      ),
    ).toBeInTheDocument();
    await previewRows('Valor bruto R$ 8.000,00');
    await typeSettled(user, '6.500,00');
    expect(await previewRows('Valor bruto R$ 8.592,20')).toEqual([
      'Valor bruto R$ 8.592,20',
      'INSS 11,00% do bruto −R$ 945,14',
      'IRPF 15,00% de R$ 7.647,06 −R$ 1.147,06',
      'Líquido informado R$ 6.500,00',
    ]);
    expect(lastCall(calls, 'POST', '/transactions/settlement-preview')?.body).toEqual({
      settled_amount: 650000,
      adjustments: [INSS, IRPF],
      expected_gross_amount: 800000,
    });
    await user.click(screen.getByRole('button', { name: 'Liquidar' }));
    await waitFor(() => {
      expect(lastCall(calls, 'POST', '/transactions/t20/settlement')).toBeDefined();
    });
    expect(lastCall(calls, 'POST', '/transactions/t20/settlement')?.body).toEqual({
      settled_amount: 650000,
      settled_at: '2026-11-05',
      adjustments: [INSS, IRPF],
    });
    const region = screen.getByRole('region', { name: 'Descontos e acréscimos' });
    expect(await within(region).findByRole('heading', { name: 'Liquidado' })).toBeInTheDocument();
    expect(plain(region.textContent)).toContain('R$ 8.592,20');
    expect(plain((await screen.findByText(/Recebeu/)).textContent)).toBe(
      'Recebeu R$ 448,00 a mais',
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('rf10 edits an item before settling', async () => {
    const { calls } = financeServer(seed());
    const user = userEvent.setup();
    renderFinance('/finance/transactions/t20');
    await pageHeading('Salário');
    const toggle = screen.getByRole('button', { name: 'Editar descontos e acréscimos' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const irpf = screen.getByRole('group', { name: 'Item 2' });
    const rate = within(irpf).getByRole('textbox', { name: 'Percentual (%)' });
    expect(rate).toHaveValue('15,00');
    expect(
      screen.getByText(
        'A base digitada acompanha o bruto na mesma proporção. Ajuste a base prevista se o holerite trouxer outra.',
      ),
    ).toBeInTheDocument();
    await user.clear(rate);
    await user.type(rate, '22,5');
    await typeSettled(user, '6.500,00');
    expect(await previewRows('Valor bruto R$ 9.423,70')).toEqual([
      'Valor bruto R$ 9.423,70',
      'INSS 11,00% do bruto −R$ 1.036,61',
      'IRPF 22,50% de R$ 8.387,09 −R$ 1.887,09',
      'Líquido informado R$ 6.500,00',
    ]);
    await user.click(screen.getByRole('button', { name: 'Liquidar' }));
    await waitFor(() => {
      expect(lastCall(calls, 'POST', '/transactions/t20/settlement')).toBeDefined();
    });
    expect(lastCall(calls, 'POST', '/transactions/t20/settlement')?.body).toEqual({
      settled_amount: 650000,
      settled_at: '2026-11-05',
      adjustments: [INSS, { ...IRPF, rate_bp: 2250 }],
    });
  });

  it('cb01 shows the error when there is no gross for the net', async () => {
    const state = seed();
    state.override = (call) =>
      call.method === 'POST' && call.path === '/transactions/settlement-preview'
        ? {
            status: 422,
            body: {
              code: 'validation_failed',
              title: 'validation_failed',
              errors: [{ field: 'adjustments', code: 'no_gross_for_net' }],
            },
          }
        : undefined;
    financeServer(state);
    renderFinance('/finance/transactions/t20');
    await pageHeading('Salário');
    const preview = screen.getByRole('region', { name: 'Prévia da liquidação' });
    expect(await within(preview).findByRole('alert')).toHaveTextContent(
      'Não há bruto possível para este líquido com estes descontos e acréscimos.',
    );
  });

  it('keeps the settlement of a transaction without items as before', async () => {
    const { calls } = financeServer(seed());
    const user = userEvent.setup();
    renderFinance('/finance/transactions/t1');
    await pageHeading('Feira');
    await user.click(screen.getByRole('button', { name: 'Liquidar' }));
    await waitFor(() => {
      expect(lastCall(calls, 'POST', '/transactions/t1/settlement')).toBeDefined();
    });
    expect(lastCall(calls, 'POST', '/transactions/t1/settlement')?.body).toEqual({
      settled_amount: 10000,
      settled_at: '2026-11-05',
    });
    expect(lastCall(calls, 'POST', '/transactions/settlement-preview')).toBeUndefined();
  });

  it('settles below expected and shows saving', async () => {
    const { calls } = financeServer(seed());
    const user = userEvent.setup();
    const { container } = renderFinance('/finance/transactions/t1');
    await pageHeading('Feira');
    const amount = screen.getByRole('textbox', { name: 'Valor efetivo (R$)' });
    expect((amount as HTMLInputElement).value).toMatch(/^R\$\s100,00$/);
    expect(screen.getByLabelText('Data efetiva')).toHaveTextContent('05/11/2026');
    await user.clear(amount);
    await user.type(amount, '80');
    await user.click(screen.getByRole('button', { name: 'Liquidar' }));
    expect(plain((await screen.findByText(/Economizou/)).textContent)).toBe('Economizou R$ 20,00');
    expect(lastCall(calls, 'POST', '/transactions/t1/settlement')?.body).toEqual({
      settled_amount: 8000,
      settled_at: '2026-11-05',
    });
    expect(await axe(container)).toHaveNoViolations();
  });

  it('settles above expected and shows loss', async () => {
    financeServer(seed());
    const user = userEvent.setup();
    renderFinance('/finance/transactions/t1');
    await pageHeading('Feira');
    const amount = screen.getByRole('textbox', { name: 'Valor efetivo (R$)' });
    await user.clear(amount);
    await user.type(amount, '120');
    await user.click(screen.getByRole('button', { name: 'Liquidar' }));
    const loss = await screen.findByText(/Pagou/);
    expect(plain(loss.textContent)).toBe('Pagou R$ 20,00 a mais');
    expect(loss.className).toContain('warning');
    expect(loss.className).not.toContain('danger');
  });

  it('undoes the settlement and warns when the server refuses', async () => {
    const state = seed();
    state.override = (call) =>
      call.method === 'POST' && call.path === '/transactions/t1/settlement'
        ? problem(409, 'transaction_already_settled')
        : undefined;
    financeServer(state);
    const user = userEvent.setup();
    renderFinance('/finance/transactions/t1');
    await pageHeading('Feira');
    await user.click(screen.getByRole('button', { name: 'Liquidar' }));
    expect(
      await screen.findByText('Esta movimentação já foi liquidada. A tela foi atualizada.'),
    ).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Liquidar' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Desfazer liquidação' })).toBeNull();
  });

  it('undoes the settlement of a transaction from the detail', async () => {
    const { calls } = financeServer(seed());
    const user = userEvent.setup();
    renderFinance('/finance/transactions/t2');
    await pageHeading('Luz');
    expect(screen.getByText(/Economizou/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Desfazer liquidação' }));
    expect(await screen.findByRole('button', { name: 'Liquidar' })).toBeInTheDocument();
    expect(await screen.findByText('Liquidação desfeita.')).toBeInTheDocument();
    expect(lastCall(calls, 'DELETE', '/transactions/t2/settlement')).toBeDefined();
  });

  it('confirms before undoing the settlement of a recurring copy', async () => {
    const { calls } = financeServer(seed());
    const user = userEvent.setup();
    const { router } = renderFinance('/finance/transactions/t9');
    await pageHeading('Aluguel');
    expect(
      await screen.findByRole('link', { name: 'Gerada pela recorrência Aluguel' }),
    ).toHaveAttribute('href', '/finance/recurring-transactions/r1');
    await user.click(screen.getByRole('button', { name: 'Desfazer liquidação' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Desfazer esta liquidação?' });
    expect(dialog).toHaveTextContent(
      'A liquidação de 30 de set. de 2026 será desfeita e esta cópia, apagada.',
    );
    expect(lastCall(calls, 'DELETE', '/transactions/t9/settlement')).toBeUndefined();
    await user.click(within(dialog).getByRole('button', { name: 'Desfazer liquidação' }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/finance/recurring-transactions/r1');
    });
  });

  it('deletes a transaction from more actions after confirmation', async () => {
    const { calls } = financeServer(seed());
    const user = userEvent.setup();
    const { router } = renderFinance('/finance/transactions/t1');
    await pageHeading('Feira');
    await user.click(screen.getByRole('button', { name: 'Mais ações' }));
    await user.click(screen.getByRole('menuitem', { name: 'Excluir' }));
    const dialog = await screen.findByRole('alertdialog', {
      name: 'Excluir esta movimentação?',
    });
    await user.click(within(dialog).getByRole('button', { name: 'Excluir' }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/finance/expenses');
    });
    expect(lastCall(calls, 'DELETE', '/transactions/t1')).toBeDefined();
  });
});

describe('recurrence detail', () => {
  function settleNext(state: FinanceWorld) {
    state.override = (call) => {
      if (call.method === 'POST' && call.path === '/recurring-transactions/r1/settlement') {
        const recurrence = state.recurring[0] as Record<string, unknown>;
        recurrence.open_occurrence = { occurrence_date: '2026-11-30', status: 'open' };
        return {
          status: 201,
          body: transaction({
            id: 't10',
            generated_from: 'r1',
            status: 'settled',
            expected_amount: 200000,
            settled_amount: 190000,
            difference_amount: -10000,
            difference_kind: 'saving',
          }),
        };
      }
      return undefined;
    };
  }

  it('settles the open occurrence and shows the next forecast', async () => {
    const state = seed();
    settleNext(state);
    const { calls } = financeServer(state);
    const user = userEvent.setup();
    const { container } = renderFinance('/finance/recurring-transactions/r1');
    await pageHeading('Aluguel');
    expect(screen.getByText('Ocorrência de 31 de out. de 2026')).toBeInTheDocument();
    const amount = screen.getByRole('textbox', { name: 'Valor efetivo (R$)' });
    expect((amount as HTMLInputElement).value).toMatch(/^R\$\s2\.000,00$/);
    await user.clear(amount);
    await user.type(amount, '1900');
    await user.click(screen.getByRole('button', { name: 'Liquidar' }));
    expect(plain((await screen.findByText(/A próxima ficou prevista para/)).textContent)).toBe(
      'Liquidada. Economizou R$ 100,00. A próxima ficou prevista para 30 de nov. de 2026.',
    );
    const post = lastCall(calls, 'POST', '/recurring-transactions/r1/settlement');
    expect(post?.body).toEqual({
      occurrence_date: '2026-10-31',
      settled_amount: 190000,
      settled_at: '2026-11-05',
    });
    expect(post?.headers['Idempotency-Key']).toBeDefined();
    expect(await screen.findByText('Ocorrência de 30 de nov. de 2026')).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('ct06 settles the occurrence with an edited item and keeps the rule', async () => {
    const state = seed();
    state.recurring = [
      rent({
        kind: 'income',
        description: 'Salário',
        gross_amount: 800000,
        expected_amount: 605200,
        adjustments: SALARY_ADJUSTMENTS,
      }),
    ];
    settleNext(state);
    const { calls } = financeServer(state);
    const user = userEvent.setup();
    renderFinance('/finance/recurring-transactions/r1');
    await pageHeading('Salário');
    await editIrpf(user, '22,5');
    await typeSettled(user, '6.500,00');
    await previewRows('Valor bruto R$ 9.423,70');
    await user.click(screen.getByRole('button', { name: 'Liquidar' }));
    await waitFor(() => {
      expect(lastCall(calls, 'POST', '/recurring-transactions/r1/settlement')).toBeDefined();
    });
    expect(lastCall(calls, 'POST', '/recurring-transactions/r1/settlement')?.body).toEqual({
      occurrence_date: '2026-10-31',
      settled_amount: 650000,
      settled_at: '2026-11-05',
      adjustments: [INSS, { ...IRPF, rate_bp: 2250 }],
    });
    expect(lastCall(calls, 'PATCH', '/recurring-transactions/r1')).toBeUndefined();
    const region = screen.getByRole('region', { name: 'Descontos e acréscimos' });
    expect(plain(region.textContent)).toContain('15,00% de R$ 7.120,00');
  });

  it('keeps an overdue occurrence open until settled or skipped', async () => {
    financeServer(seed());
    const first = renderFinance('/finance/recurring-transactions/r1');
    await pageHeading('Aluguel');
    expect(screen.getByText('Atrasada')).toBeInTheDocument();
    expect(screen.getByText('Era para 31 de out. de 2026')).toBeInTheDocument();
    expect(screen.getByText('Atrasada').className).toContain('warning');
    first.unmount();
    // Um mês depois, a mesma ocorrência continua aberta: a tela não avança sozinha.
    vi.setSystemTime(new Date('2026-12-10T12:00:00Z'));
    renderFinance('/finance/recurring-transactions/r1');
    await pageHeading('Aluguel');
    expect(screen.getByText('Ocorrência de 31 de out. de 2026')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pular esta ocorrência' })).toBeInTheDocument();
  });

  it('skips the open occurrence after confirmation', async () => {
    const state = seed();
    state.override = (call) => {
      if (call.method === 'POST' && call.path === '/recurring-transactions/r1/skip') {
        const recurrence = state.recurring[0] as Record<string, unknown>;
        recurrence.open_occurrence = { occurrence_date: '2026-11-30', status: 'open' };
        return { body: recurrence };
      }
      return undefined;
    };
    const { calls } = financeServer(state);
    const user = userEvent.setup();
    renderFinance('/finance/recurring-transactions/r1');
    await pageHeading('Aluguel');
    await user.click(screen.getByRole('button', { name: 'Pular esta ocorrência' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Pular esta ocorrência?' });
    expect(dialog).toHaveTextContent(
      'A ocorrência de 31 de out. de 2026 não será registrada e a recorrência passa para a seguinte.',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Pular esta ocorrência' }));
    await waitFor(() => {
      expect(lastCall(calls, 'POST', '/recurring-transactions/r1/skip')?.body).toEqual({
        occurrence_date: '2026-10-31',
      });
    });
    expect(await screen.findByText('Ocorrência de 30 de nov. de 2026')).toBeInTheDocument();
  });

  it('refreshes when the occurrence was already closed', async () => {
    const state = seed();
    state.override = (call) =>
      call.method === 'POST' && call.path === '/recurring-transactions/r1/settlement'
        ? problem(409, 'occurrence_not_open')
        : undefined;
    const { calls } = financeServer(state);
    const user = userEvent.setup();
    renderFinance('/finance/recurring-transactions/r1');
    await pageHeading('Aluguel');
    const reads = calls.filter((call) => call.path === '/recurring-transactions/r1').length;
    await user.click(screen.getByRole('button', { name: 'Liquidar' }));
    expect(
      await screen.findByText('Esta ocorrência já foi liquidada ou pulada. A tela foi atualizada.'),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(calls.filter((call) => call.path === '/recurring-transactions/r1').length).toBe(
        reads + 1,
      );
    });
  });

  it('lists the settled copies on the recurrence page', async () => {
    financeServer(seed());
    const user = userEvent.setup();
    const { router } = renderFinance('/finance/recurring-transactions/r1');
    await pageHeading('Aluguel');
    await user.click(screen.getByRole('tab', { name: 'Liquidações' }));
    await waitFor(() => {
      expect(router.state.location.search).toMatchObject({ tab: 'settlements' });
    });
    const row = await rowOf('Aluguel');
    expect(within(row).getByRole('link', { name: 'Aluguel' })).toHaveAttribute(
      'href',
      '/finance/transactions/t9',
    );
    expect(within(row).getByText('Liquidada')).toBeInTheDocument();
  });

  it('shows that a recurrence ended', async () => {
    const state = seed();
    state.recurring = [rent({ open_occurrence: null })];
    state.copies = {};
    financeServer(state);
    renderFinance('/finance/recurring-transactions/r1?tab=settlements');
    expect(await screen.findByText('Nenhuma ocorrência liquidada ainda.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'Visão geral' }));
    expect(
      await screen.findByText('Esta recorrência terminou. Nada mais previsto.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Liquidar' })).toBeNull();
  });
});

describe('transfers', () => {
  it('lists transfers in the period', async () => {
    const { calls } = financeServer(seed());
    const { container } = renderFinance('/finance/transfers');
    const link = await screen.findByRole('link', { name: 'Conta → Carteira' });
    expect(link).toHaveAttribute('href', '/finance/transfers/tr1');
    const row = link.closest('li') as HTMLElement;
    expect(plain(row.textContent)).toContain('R$ 50,00');
    expect(row.textContent).toContain('Troco');
    const params = lastCall(calls, 'GET', '/transfers')?.url.searchParams;
    expect(params?.get('from')).toBe('2026-11-01');
    expect(params?.get('to')).toBe('2026-11-30');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('searches transfers on the server', async () => {
    const { calls } = financeServer(seed());
    const user = userEvent.setup();
    renderFinance('/finance/transfers');
    await screen.findByRole('link', { name: 'Conta → Carteira' });
    await user.type(screen.getByRole('searchbox', { name: 'Busca' }), 'troco');
    await waitFor(() => {
      expect(lastCall(calls, 'GET', '/transfers')?.url.searchParams.get('q')).toBe('troco');
    });
  });

  it('transfers between two different accounts', async () => {
    const { calls } = financeServer(seed());
    const user = userEvent.setup();
    const { router } = renderFinance('/finance/transfers/new');
    await pageHeading('Nova transferência');
    await chooseOption('Conta de origem', 'Conta');
    await chooseOption('Conta de destino', 'Conta');
    await user.type(screen.getByRole('textbox', { name: 'Valor (R$)' }), '100');
    await user.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(
      await screen.findByText('Escolha uma conta de destino diferente da origem.'),
    ).toHaveAttribute('role', 'alert');
    expect(lastCall(calls, 'POST', '/transfers')).toBeUndefined();
    await chooseOption('Conta de destino', 'Carteira');
    await user.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/finance/transfers/tr2');
    });
    const post = lastCall(calls, 'POST', '/transfers');
    expect(post?.body).toEqual({
      from_account_id: 'a1',
      to_account_id: 'a2',
      amount: 10000,
      transferred_on: '2026-11-05',
      description: null,
      visibility: 'personal',
    });
    expect(post?.headers['Idempotency-Key']).toBeDefined();
  });
});
