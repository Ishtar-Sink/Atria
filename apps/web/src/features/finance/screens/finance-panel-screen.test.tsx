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
    monthly: [
      '2026-06',
      '2026-07',
      '2026-08',
      '2026-09',
      '2026-10',
      '2026-11',
      '2026-12',
      '2027-01',
      '2027-02',
      '2027-03',
      '2027-04',
      '2027-05',
    ].map((month, index) => {
      if (month === '2026-08')
        return { month, income: 0, expense: 0, balance: 0, projected: false };
      const expense = month === '2027-01' ? 900000 : 300000;
      return { month, income: 500000, expense, balance: 500000 - expense, projected: index >= 6 };
    }),
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
      { group: 'category', category_id: 'c2', name: 'Casa', color: '#0369a1', amount: 150000 },
      { group: 'category', category_id: 'c1', name: 'Mercado', color: '#92400e', amount: 80000 },
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
        { id: 'a1', name: 'Conta', balance_amount: 700000 },
        { id: 'a2', name: 'Carteira', balance_amount: 50000 },
      ],
    },
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
  // O jsdom não mede nada: o observador informa uma largura para o gráfico se desenhar.
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(private readonly callback: (entries: unknown[]) => void) {}
      observe() {
        this.callback([{ contentRect: { width: 640, height: 240 } }]);
      }
      unobserve() {}
      disconnect() {}
    },
  );
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

  it('rf18 shows where it went in the category colors', async () => {
    financeServer(world({ summary: summary() }));
    renderFinance('/finance?period=last_month');
    const figure = await screen.findByRole('figure', { name: 'Saídas por categoria' });
    const fill = (label: string) => {
      const row = [...figure.querySelectorAll('li')].find((li) => li.textContent.startsWith(label));
      return row?.querySelector<HTMLElement>('[class*="barFill"]');
    };
    expect(fill('Casa')?.style.backgroundColor).toBe('rgb(3, 105, 161)');
    expect(fill('Mercado')?.style.backgroundColor).toBe('rgb(146, 64, 14)');
  });

  it('rf09 shows balance, upcoming bills and savings and losses without the cards block', async () => {
    financeServer(world({ summary: summary() }));
    renderFinance('/finance');
    const balance = await screen.findByRole('region', { name: 'Saldo' });
    expect(plain(balance.textContent)).toContain('R$ 7.500,00');
    expect(plain(balance.textContent)).toContain('Previsto em 30 de nov. de 2026: R$ 8.200,00');
    expect(within(balance).getByRole('link', { name: 'Carteira' })).toHaveAttribute(
      'href',
      '/finance/accounts/a2',
    );
    expect(screen.queryByRole('region', { name: 'Cartões' })).toBeNull();
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

  it('ct07 shows the finance tabs without Faturas', async () => {
    financeServer(world({ summary: summary() }));
    renderFinance('/finance');
    await pageHeading('Financeiro');
    const nav = screen.getByRole('navigation', { name: 'Seções do Financeiro' });
    expect(
      within(nav)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Painel', 'Entradas', 'Saídas', 'Transferências', 'Contas', 'Configurações']);
    expect(within(nav).queryByRole('link', { name: 'Faturas' })).toBeNull();
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
    expect(failures.length).toBe(7);
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
    financeServer(world({ summary: summary() }));
    renderFinance('/finance');
    const zones = await screen.findByRole('region', { name: 'Painel' });
    const cells = cellsOf(zones);
    expect(cells).toHaveLength(7);
    const at = (zone: string, row: string) =>
      cells.find((cell) => cell.zone === zone && cell.row === row);
    expect(at('main', '1')?.text).toContain('Fechamento');
    expect(at('side', '1')?.text).toContain('Saldo');
    expect(at('main', '2')?.text).toContain('Mês a mês');
    expect(at('side', '2')?.text).toContain('Próximas movimentações');
    expect(at('main', '3')?.text).toContain('Para onde foi');
    expect(at('side', '3')?.text).toContain('Economias e perdas');
    expect(at('main', '4')?.text).toContain('Previsto x realizado');
    expect(cells.filter((cell) => cell.alone).map((cell) => cell.row)).toEqual(['4']);
  });

  it('rf15 shows the monthly card below the closing', async () => {
    financeServer(world({ summary: summary() }));
    renderFinance('/finance');
    const zones = await screen.findByRole('region', { name: 'Painel' });
    const cell = zones.querySelector('[data-zone="main"][data-row="2"]');
    expect(cell?.querySelector('h2')?.textContent).toBe('Mês a mês');
    const table = await screen.findByRole('table', {
      name: 'Entradas, saídas e saldo mês a mês',
    });
    expect(within(table).getAllByRole('row')).toHaveLength(13);
  });

  it('rf16 switches the monthly card between incomes and expenses and balance through the url', async () => {
    financeServer(world({ summary: summary() }));
    const user = userEvent.setup();
    const { router, unmount } = renderFinance('/finance');
    const group = await screen.findByRole('radiogroup', { name: 'Mostrar' });
    expect(within(group).getByRole('radio', { name: 'Entradas e saídas' })).toBeChecked();
    await user.click(within(group).getByRole('radio', { name: 'Saldo' }));
    await waitFor(() => {
      expect(router.state.location.search).toMatchObject({ monthly: 'balance' });
    });
    const columns = async () => {
      const table = await screen.findByRole('table', {
        name: 'Entradas, saídas e saldo mês a mês',
      });
      return within(table)
        .getAllByRole('columnheader')
        .map((cell) => cell.textContent);
    };
    await waitFor(async () => {
      expect(await columns()).toEqual(['Mês', 'Situação', 'Saldo']);
    });
    unmount();

    const second = renderFinance('/finance?monthly=balance');
    expect(await screen.findByRole('radio', { name: 'Saldo' }, { timeout: 3000 })).toBeChecked();
    expect(await columns()).toEqual(['Mês', 'Situação', 'Saldo']);
    second.unmount();

    renderFinance('/finance?monthly=bar');
    expect(await screen.findByRole('radio', { name: 'Entradas e saídas' })).toBeChecked();
    expect(await columns()).toEqual(['Mês', 'Situação', 'Entradas', 'Saídas']);
  });

  it('keeps one column below 960 px with the main zone first', async () => {
    financeServer(world({ summary: summary() }));
    renderFinance('/finance');
    const zones = await screen.findByRole('region', { name: 'Painel' });
    expect(zones.className).toContain('zones');
    const order = cellsOf(zones).map((cell) => cell.zone);
    expect(order).toEqual(['main', 'main', 'main', 'main', 'side', 'side', 'side']);
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
