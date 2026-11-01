import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { clearToasts } from '../../../shared/toast/toast-store';
import type { FinancialSummary } from '../hooks/use-financial-summary';
import {
  financeServer,
  item,
  pageHeading,
  problem,
  renderFinance,
  tabsThrough,
  world,
} from '../test-utils';
import panel_css from './finance-panel-screen.module.css?raw';

const plain = (text: string | null | undefined) => (text ?? '').replace(/[  ]/g, ' ');

function summary(overrides: Partial<FinancialSummary> = {}): FinancialSummary {
  return {
    period: { from: '2026-11-01', to: '2026-11-30' },
    previous_period: { from: '2026-10-02', to: '2026-10-31' },
    totals: {
      income: { realized: 500000, forecast: 600000 },
      expense: { realized: 200000, forecast: 280000 },
      surplus: { realized: 300000, forecast: 320000 },
    },
    previous_totals: {
      income: { realized: 600000, forecast: 600000 },
      expense: { realized: 312000, forecast: 312000 },
      surplus: { realized: 288000, forecast: 288000 },
    },
    where_it_went: [
      { group: 'category', category_id: 'c2', name: 'Casa', color: 'info', amount: 150000 },
      { group: 'category', category_id: 'c1', name: 'Mercado', color: 'warning', amount: 80000 },
      { group: 'uncategorized', amount: 20000 },
      { group: 'others', amount: 30000 },
    ],
    expected_vs_settled: {
      income: { expected_amount: 600000, settled_amount: 500000 },
      expense: { expected_amount: 280000, settled_amount: 200000 },
    },
    savings_and_losses: { savings_amount: 3000, gains_amount: 2000, losses_amount: 1500 },
    balance: {
      current: 750000,
      forecast_at_period_end: 820000,
      accounts: [
        { id: 'a1', name: 'Conta', kind: 'standard', balance_amount: 700000 },
        { id: 'a2', name: 'Carteira', kind: 'standard', balance_amount: 50000 },
      ],
    },
    credit_cards: [
      {
        account_id: 'a3',
        name: 'Cartão Nu',
        credit_limit_amount: 500000,
        used_limit_amount: 186400,
        open_statement_amount: 120000,
        statement_period: '2026-11',
        due_date: '2026-11-10',
      },
    ],
    upcoming_bills: [
      item({ id: 'b1', description: 'Internet', expected_date: '2026-10-28', status: 'overdue' }),
      item({
        id: null,
        recurrence_id: 'r1',
        description: 'Aluguel',
        expected_date: '2026-11-30',
        occurrence_date: '2026-11-30',
        status: 'forecast',
      }),
      ...[2, 3, 4, 5].map((n) =>
        item({
          id: `b${String(n)}`,
          description: `Conta ${String(n)}`,
          expected_date: '2026-11-20',
        }),
      ),
    ],
    currency: 'BRL',
    ...overrides,
  };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-11-05T12:00:00Z') });
});

afterEach(() => {
  vi.useRealTimers();
  clearToasts();
  vi.unstubAllGlobals();
});

describe('finance panel', () => {
  it('shows closing with realized and forecast and the comparison with the previous period', async () => {
    const { calls } = financeServer(world({ summary: summary() }));
    const user = userEvent.setup();
    const { container } = renderFinance('/finance');
    await pageHeading('Financeiro');
    expect(screen.getByRole('link', { name: 'Painel' })).toHaveAttribute('aria-current', 'page');
    const closing = await screen.findByRole('region', { name: 'Fechamento · este mês' });
    const text = plain(closing.textContent);
    expect(text).toContain('EntradasR$ 5.000,00de R$ 6.000,00 previstos');
    expect(text).toContain('SaídasR$ 2.000,00de R$ 2.800,00 previstos');
    expect(text).toContain('Sobra previstaR$ 3.200,00entradas menos saídas');
    expect(text).toContain('Você gastou R$ 320,00 a menos que no período anterior.');
    const params = calls.find((call) => call.path === '/financial-summaries')?.url.searchParams;
    expect(params?.get('from')).toBe('2026-11-01');
    expect(params?.get('to')).toBe('2026-11-30');
    await tabsThrough(user);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('shows a negative surplus in warning tone, never danger', async () => {
    financeServer(
      world({
        summary: summary({
          totals: {
            income: { realized: 0, forecast: 100000 },
            expense: { realized: 0, forecast: 150000 },
            surplus: { realized: 0, forecast: -50000 },
          },
        }),
      }),
    );
    renderFinance('/finance');
    const closing = await screen.findByRole('region', { name: /Fechamento/ });
    const surplus = within(closing).getByText(/-R\$|−R\$|R\$\s?-/);
    expect(surplus.className).toContain('negative');
    expect(document.querySelectorAll('.danger')).toHaveLength(0);
  });

  it('hides the comparison for any period', async () => {
    const { calls } = financeServer(world({ summary: summary({ previous_totals: null }) }));
    renderFinance('/finance?period=all');
    const closing = await screen.findByRole('region', { name: 'Fechamento · qualquer período' });
    expect(closing.textContent).not.toContain('período anterior');
    expect(calls.find((call) => call.path === '/financial-summaries')?.url.search).toBe('');
  });

  it('shows where it went by category with links to filtered expenses', async () => {
    financeServer(world({ summary: summary() }));
    renderFinance('/finance?period=last_month');
    const chart = await screen.findByRole('table', { name: 'Saídas por categoria' });
    const casa = within(chart).getByRole('link', { name: 'Casa' });
    expect(casa).toHaveAttribute('href', '/finance/expenses?period=last_month&category_id=c2');
    expect(within(chart).getByRole('row', { name: /Outras/ })).toBeInTheDocument();
    expect(within(chart).getByRole('row', { name: /Sem categoria/ })).toBeInTheDocument();
    expect(plain(within(chart).getByRole('row', { name: /Mercado/ }).textContent)).toContain(
      'R$ 800,00',
    );
    const columns = screen.getByRole('table', { name: 'Previsto e realizado no período' });
    expect(plain(within(columns).getByRole('row', { name: /Saídas/ }).textContent)).toContain(
      'R$ 2.800,00',
    );
  });

  it('shows balance, cards, upcoming bills and savings and losses', async () => {
    financeServer(world({ summary: summary() }));
    renderFinance('/finance');
    const balance = await screen.findByRole('region', { name: 'Saldo' });
    expect(plain(balance.textContent)).toContain('R$ 7.500,00');
    expect(plain(balance.textContent)).toContain('Previsto em 30 de nov. de 2026: R$ 8.200,00');
    expect(within(balance).getByRole('link', { name: 'Carteira' })).toHaveAttribute(
      'href',
      '/finance/accounts/a2',
    );
    const cards = screen.getByRole('region', { name: 'Cartões' });
    expect(within(cards).getByRole('link', { name: 'Cartão Nu' })).toHaveAttribute(
      'href',
      '/finance/statements?card_id=a3',
    );
    expect(plain(cards.textContent)).toContain('Fatura aberta · vence em 10 de nov. de 2026');
    expect(
      within(cards).getByRole('progressbar', { name: 'Limite usado de Cartão Nu' }),
    ).toHaveAttribute('aria-valuenow', '186400');
    expect(plain(cards.textContent)).toContain('R$ 1.864,00 de R$ 5.000,00 do limite');
    const upcoming = screen.getByRole('region', { name: 'Próximas movimentações' });
    const links = within(upcoming).getAllByRole('link');
    expect(links).toHaveLength(7);
    expect(within(upcoming).getByText('Era para 28 de out. de 2026')).toBeInTheDocument();
    expect(within(upcoming).getByRole('link', { name: 'Aluguel' })).toHaveAttribute(
      'href',
      '/finance/recurring-transactions/r1',
    );
    expect(within(upcoming).getByRole('link', { name: 'Ver entradas' })).toHaveAttribute(
      'href',
      '/finance/income?period=next_30_days',
    );
    expect(within(upcoming).getByRole('link', { name: 'Ver saídas' })).toHaveAttribute(
      'href',
      '/finance/expenses?period=next_30_days',
    );
    const savings = screen.getByRole('region', { name: 'Economias e perdas' });
    expect(plain(savings.textContent)).toContain('Economizou ou recebeu a maisR$ 50,00');
    expect(plain(savings.textContent)).toContain('Pagou a mais ou recebeu a menosR$ 15,00');
  });

  it('shows the panel empty, loading and error states', async () => {
    const empty = financeServer(
      world({
        summary: summary({
          totals: {
            income: { realized: 0, forecast: 0 },
            expense: { realized: 0, forecast: 0 },
            surplus: { realized: 0, forecast: 0 },
          },
          balance: { current: 0, forecast_at_period_end: null, accounts: [] },
          upcoming_bills: [],
          where_it_went: [],
          credit_cards: [],
        }),
      }),
    );
    const first = renderFinance('/finance');
    expect(await screen.findByText('Nada registrado neste período.')).toBeInTheDocument();
    first.unmount();
    expect(empty.calls.length).toBeGreaterThan(0);

    const state = world({ summary: summary() });
    let mode: 'hang' | 'error' | 'ok' = 'hang';
    state.override = (call) => {
      if (call.path !== '/financial-summaries') return undefined;
      if (mode === 'hang') return { hang: true };
      if (mode === 'error') return problem(500, 'internal_error');
      return undefined;
    };
    financeServer(state);
    const second = renderFinance('/finance');
    expect(await screen.findByRole('status')).toHaveAttribute('aria-busy', 'true');
    second.unmount();
    mode = 'error';
    renderFinance('/finance');
    const failures = await screen.findAllByRole('alert');
    expect(failures.length).toBe(6);
    expect(screen.getByRole('region', { name: 'Saldo' })).toHaveTextContent('Tentar de novo');
    mode = 'ok';
    await userEvent.click(
      within(failures[0] as HTMLElement).getByRole('button', { name: 'Tentar de novo' }),
    );
    await waitFor(() => {
      expect(screen.getByRole('region', { name: 'Fechamento · este mês' })).toBeInTheDocument();
    });
  });

  it('lists upcoming incomes and expenses for the next 30 days', async () => {
    financeServer(
      world({
        summary: summary({
          upcoming_bills: [
            item({
              id: null,
              recurrence_id: 'r2',
              kind: 'income',
              description: 'Salário',
              expected_date: '2026-11-12',
              occurrence_date: '2026-11-12',
              status: 'forecast',
              expected_amount: 500000,
            }),
            item({
              id: 'b9',
              kind: 'expense',
              description: 'Internet',
              expected_date: '2026-11-15',
              expected_amount: 9900,
            }),
          ],
        }),
      }),
    );
    renderFinance('/finance');
    const upcoming = await screen.findByRole('region', { name: 'Próximas movimentações' });
    const income = within(upcoming).getByRole('link', { name: 'Salário' }).closest('li');
    const expense = within(upcoming).getByRole('link', { name: 'Internet' }).closest('li');
    expect(plain(income?.textContent)).toContain('Entrada · 12 de nov. de 2026');
    expect(plain(expense?.textContent)).toContain('Saída · 15 de nov. de 2026');
    expect(plain(income?.querySelector('[class*="positive"]')?.textContent)).toContain(
      'R$ 5.000,00',
    );
    expect(expense?.querySelector('[class*="positive"]')).toBeNull();
    expect(within(upcoming).getByRole('link', { name: 'Ver entradas' })).toHaveAttribute(
      'href',
      '/finance/income?period=next_30_days',
    );
    expect(within(upcoming).getByRole('link', { name: 'Ver saídas' })).toHaveAttribute(
      'href',
      '/finance/expenses?period=next_30_days',
    );
  });

  it('shows the empty upcoming block', async () => {
    financeServer(world({ summary: summary({ upcoming_bills: [] }) }));
    renderFinance('/finance');
    expect(
      await screen.findByText('Nenhuma movimentação prevista nos próximos 30 dias.'),
    ).toBeInTheDocument();
  });

  function cellsOf(zones: HTMLElement) {
    return Array.from(zones.children).map((cell) => ({
      zone: (cell as HTMLElement).dataset.zone,
      row: (cell as HTMLElement).dataset.row,
      alone: (cell as HTMLElement).hasAttribute('data-alone'),
      text: plain(cell.textContent),
    }));
  }

  it('pairs the panel cards in rows', async () => {
    financeServer(world({ summary: summary({ credit_cards: [] }) }));
    renderFinance('/finance');
    const zones = await screen.findByRole('region', { name: 'Painel' });
    const cells = cellsOf(zones);
    expect(cells).toHaveLength(6);
    const at = (zone: string, row: string) =>
      cells.find((cell) => cell.zone === zone && cell.row === row);
    expect(at('main', '1')?.text).toContain('Fechamento');
    expect(at('side', '1')?.text).toContain('Saldo');
    expect(at('main', '2')?.text).toContain('Para onde foi');
    expect(at('side', '2')?.text).toContain('Próximas movimentações');
    expect(at('main', '3')?.text).toContain('Previsto x realizado');
    expect(at('side', '3')?.text).toContain('Economias e perdas');
    expect(cells.some((cell) => cell.alone)).toBe(false);
  });

  it('pairs the panel cards in rows with the cards block', async () => {
    financeServer(world({ summary: summary() }));
    renderFinance('/finance');
    const zones = await screen.findByRole('region', { name: 'Painel' });
    const cells = cellsOf(zones);
    expect(cells).toHaveLength(7);
    const at = (zone: string, row: string) =>
      cells.find((cell) => cell.zone === zone && cell.row === row);
    expect(at('main', '2')?.text).toContain('Para onde foi');
    expect(at('side', '2')?.text).toContain('Cartões');
    expect(at('main', '3')?.text).toContain('Previsto x realizado');
    expect(at('side', '3')?.text).toContain('Próximas movimentações');
    expect(at('side', '4')?.text).toContain('Economias e perdas');
    expect(at('side', '4')?.alone).toBe(true);
    expect(cells.filter((cell) => cell.alone)).toHaveLength(1);
  });

  it('keeps one column below 960 px with the main zone first', async () => {
    financeServer(world({ summary: summary() }));
    renderFinance('/finance');
    const zones = await screen.findByRole('region', { name: 'Painel' });
    expect(zones.className).toContain('zones');
    const order = cellsOf(zones).map((cell) => cell.zone);
    expect(order).toEqual(['main', 'main', 'main', 'side', 'side', 'side', 'side']);
    const css = panel_css.replace(/\s+/g, ' ');
    expect(css).toContain(
      '.zones { display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 1fr)',
    );
    expect(css).toMatch(/\.cell > \* \{[^}]*flex: 1 1 auto/);
    expect(css).toMatch(
      /@media \(max-width: 960px\) \{ \.zones \{ grid-template-columns: minmax\(0, 1fr\); \}/,
    );
  });
});
