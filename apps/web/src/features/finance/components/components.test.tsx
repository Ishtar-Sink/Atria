import { zodResolver } from '@hookform/resolvers/zod';
import { createRoute } from '@tanstack/react-router';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm } from 'react-hook-form';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { z } from 'zod';
import { rootRoute } from '../../../app/router';
import { renderWithProviders } from '../../../shared/test/render';
import { item, mockApi } from '../test-utils';
import { DifferenceBadge } from './difference-badge';
import { FinanceShell, type FinanceTab } from './finance-shell';
import { MoneyAmount } from './money-amount';
import { MoneyField } from './money-field';
import { MonthlyChart } from './monthly-chart';
import { ExpectedVsSettledBars, HorizontalBars } from './panel-charts';
import { TransactionRow } from './transaction-row';
import { VisibilityField } from './visibility-field';

beforeEach(() => {
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
  vi.unstubAllGlobals();
});

function quietApi() {
  mockApi({ 'GET /me': { status: 401, body: { code: 'unauthenticated', title: 'x' } } });
}

/** Troca espaços especiais do Intl por espaço comum, para comparar texto. */
const plain = (text: string | null | undefined) => (text ?? '').replace(/[  ]/g, ' ');

describe('finance components', () => {
  it('rf11 shows incomes in green with plus and expenses with minus', async () => {
    quietApi();
    renderWithProviders(
      <ul>
        <TransactionRow
          item={item({ id: 't2', kind: 'income', expected_amount: 500000, description: 'Salário' })}
        />
        <TransactionRow
          item={item({
            id: 't1',
            kind: 'expense',
            expected_amount: 150000,
            description: 'Aluguel',
          })}
        />
      </ul>,
    );
    const income = amountIn(await screen.findByRole('link', { name: 'Salário' }));
    const expense = amountIn(screen.getByRole('link', { name: 'Aluguel' }));
    expect(plain(income?.textContent)).toBe('+R$ 5.000,00');
    expect(income?.className).toContain('positive');
    expect(plain(expense?.textContent)).toBe('\u2212R$ 1.500,00');
    expect(expense?.className).not.toContain('positive');
    expect(expense?.className).not.toContain('negative');
  });

  it('rn06 takes the sign from the kind, never from the stored number', async () => {
    quietApi();
    renderWithProviders(
      <div>
        <MoneyAmount amount={150000} currency="BRL" kind="expense" />
        <MoneyAmount amount={-150000} currency="BRL" kind="income" />
      </div>,
    );
    const [expense, income] = await amounts();
    expect(plain(expense?.textContent)).toBe('\u2212R$ 1.500,00');
    expect(plain(income?.textContent)).toBe('+R$ 1.500,00');
  });

  it('rf12 shows a positive balance in green and a negative one in amber', async () => {
    quietApi();
    renderWithProviders(
      <div>
        <MoneyAmount amount={250000} currency="BRL" kind="balance" />
        <MoneyAmount amount={-50000} currency="BRL" kind="balance" />
      </div>,
    );
    const [positive, negative] = await amounts();
    expect(plain(positive?.textContent)).toBe('R$ 2.500,00');
    expect(positive?.className).toContain('positive');
    expect(plain(negative?.textContent)).toBe('\u2212R$ 500,00');
    expect(negative?.className).toContain('negative');
  });

  it('cb07 shows a zero balance in the text color without sign', async () => {
    quietApi();
    renderWithProviders(<MoneyAmount amount={0} currency="BRL" kind="balance" />);
    const [zero] = await amounts();
    expect(plain(zero?.textContent)).toBe('R$ 0,00');
    expect(zero?.className).not.toContain('positive');
    expect(zero?.className).not.toContain('negative');
  });

  it('rn07 never paints an amount in red', async () => {
    quietApi();
    const { container } = renderWithProviders(<SignedAmounts />);
    await amounts();
    expect(container.querySelector('[class*="danger"]')).toBeNull();
  });

  it('rnf03 keeps the sign as text next to the color', async () => {
    quietApi();
    renderWithProviders(<SignedAmounts />);
    const colored = (await amounts()).filter(
      (el) => el.className.includes('positive') || el.className.includes('negative'),
    );
    expect(colored.length).toBeGreaterThan(0);
    for (const el of colored) {
      if (el.dataset.kind === 'balance' && el.className.includes('positive')) continue;
      expect(plain(el.textContent)).toMatch(/^[+\u2212]/);
    }
  });

  it('rnf02 has no axe violations with signed amounts', async () => {
    quietApi();
    const { container } = renderWithProviders(<SignedAmounts />);
    await amounts();
    const previous = document.documentElement.dataset.theme;
    for (const theme of ['light', 'dark']) {
      document.documentElement.dataset.theme = theme;
      expect(await axe(container)).toHaveNoViolations();
    }
    document.documentElement.dataset.theme = previous;
  });

  it('shows the value above the status, recurring and difference badges', async () => {
    quietApi();
    const { container } = renderWithProviders(
      <ul>
        <TransactionRow
          item={item({
            id: 't1',
            description: 'Luz',
            status: 'settled',
            expected_amount: 20000,
            settled_amount: 18000,
            difference_amount: -2000,
            difference_kind: 'saving',
            recurrence_id: 'r1',
          })}
          category_name="Casa"
          account_name="Conta"
        />
      </ul>,
    );
    const link = await screen.findByRole('link', { name: 'Luz' });
    expect(link).toHaveAttribute('href', '/finance/transactions/t1');
    const row = link.closest('li');
    if (!row) throw new Error('sem linha');
    const meta = row.lastElementChild as HTMLElement;
    const value = meta.firstElementChild;
    expect(plain(value?.textContent)).toBe('\u2212R$ 180,00');
    const badges = within(meta).getByText('Liquidada').parentElement;
    expect(value?.compareDocumentPosition(badges as Node)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(within(meta).getByText('Recorrente')).toBeInTheDocument();
    expect(plain(within(meta).getByText(/Economizou/).textContent)).toBe('Economizou R$ 20,00');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('writes the difference as saved, paid more, received more or received less', async () => {
    quietApi();
    renderWithProviders(
      <div>
        <DifferenceBadge
          kind="expense"
          difference_kind="saving"
          difference_amount={-500}
          currency="BRL"
        />
        <DifferenceBadge
          kind="expense"
          difference_kind="loss"
          difference_amount={700}
          currency="BRL"
        />
        <DifferenceBadge
          kind="income"
          difference_kind="gain"
          difference_amount={900}
          currency="BRL"
        />
        <DifferenceBadge
          kind="income"
          difference_kind="loss"
          difference_amount={-300}
          currency="BRL"
        />
        <DifferenceBadge
          kind="income"
          difference_kind={null}
          difference_amount={0}
          currency="BRL"
        />
      </div>,
    );
    expect(plain((await screen.findByText(/Economizou/)).textContent)).toBe('Economizou R$ 5,00');
    expect(plain(screen.getByText(/Pagou/).textContent)).toBe('Pagou R$ 7,00 a mais');
    expect(plain(screen.getByText(/a mais$/, { selector: '.success' }).textContent)).toBe(
      'Recebeu R$ 9,00 a mais',
    );
    expect(plain(screen.getByText(/a menos/).textContent)).toBe('Recebeu R$ 3,00 a menos');
  });

  it('shows a loss in warning tone, never danger', async () => {
    quietApi();
    renderWithProviders(
      <ul>
        <TransactionRow
          item={item({
            id: 't1',
            status: 'overdue',
            difference_kind: 'loss',
            difference_amount: 700,
            settled_amount: null,
          })}
        />
      </ul>,
    );
    const loss = await screen.findByText(/Pagou/);
    expect(loss.className).toContain('warning');
    expect(screen.getByText('Atrasada').className).toContain('warning');
    expect(document.querySelectorAll('.danger')).toHaveLength(0);
  });

  it('shows visibility as a segmented group defaulting to personal', async () => {
    quietApi();
    const schema = z.object({
      visibility: z.enum(['personal', 'shared']),
      amount: z.number().nullable(),
    });
    function Form() {
      const { control } = useForm<z.input<typeof schema>>({
        resolver: zodResolver(schema),
        defaultValues: { visibility: 'personal', amount: 1234 },
      });
      return (
        <form>
          <VisibilityField control={control} name="visibility" />
          <MoneyField control={control} name="amount" label="Valor" />
        </form>
      );
    }
    const { container } = renderWithProviders(<Form />);
    const group = await screen.findByRole('radiogroup', { name: 'Visibilidade' });
    expect(within(group).getByRole('radio', { name: 'Pessoal' })).toBeChecked();
    expect(within(group).getByRole('radio', { name: 'Compartilhada' })).not.toBeChecked();
    expect(
      screen.getByText('Pessoal: só você vê. Compartilhada: outras pessoas da instância também.'),
    ).toBeInTheDocument();
    expect(group.closest('[data-span="full"]')).not.toBeNull();
    const money = screen.getByRole('textbox', { name: 'Valor (R$)' });
    expect((money as HTMLInputElement).value).toMatch(/^R\$\s12,34$/);
    expect(money).toHaveAttribute('inputmode', 'decimal');
    expect(container.querySelector('input[type="number"]')).toBeNull();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('rf24 keeps the tabs inside the sticky header', async () => {
    quietApi();
    const page = createRoute({
      getParentRoute: () => rootRoute,
      path: '/finance/$',
      component: () => (
        <FinanceShell tab="panel">
          <p>conteúdo</p>
        </FinanceShell>
      ),
      staticData: { title_key: 'finance.nav.title', breadcrumb_key: 'finance.nav.title' },
    });
    renderWithProviders(null, { route: '/finance/x', routes: [page] });
    const tabs = await screen.findByRole('navigation', { name: 'Seções do Financeiro' });
    expect(tabs.closest('[data-sticky-header]')).not.toBeNull();
  });

  it('opens the type dialog with the type of the open tab focused', async () => {
    quietApi();
    const cases: [FinanceTab, string][] = [
      ['income', 'Entrada'],
      ['transfers', 'Transferência'],
      ['settings', 'Categoria'],
      ['accounts', 'Conta'],
      ['panel', 'Saída'],
    ];
    for (const [tab, focused] of cases) {
      const page = createRoute({
        getParentRoute: () => rootRoute,
        path: '/finance/$',
        component: () => (
          <FinanceShell tab={tab}>
            <p>conteúdo</p>
          </FinanceShell>
        ),
        staticData: { title_key: 'finance.nav.title', breadcrumb_key: 'finance.nav.title' },
      });
      const view = renderWithProviders(null, { route: '/finance/x', routes: [page] });
      const user = userEvent.setup();
      await user.click(await screen.findByRole('button', { name: 'Novo registro' }));
      const dialog = await screen.findByRole('dialog', { name: 'O que você quer registrar?' });
      const cards = within(dialog).getAllByRole('link');
      expect(cards.map((card) => card.getAttribute('data-create-type'))).toEqual([
        'income',
        'expense',
        'transfer',
        'category',
        'account',
      ]);
      await waitFor(() => {
        expect(document.activeElement?.textContent).toContain(focused);
      });
      expect(within(dialog).getByRole('link', { name: /Entrada/ })).toHaveAttribute(
        'href',
        '/finance/transactions/new?kind=income',
      );
      await user.keyboard('{Escape}');
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).toBeNull();
      });
      view.unmount();
    }
  });

  it('shows bars and columns with values in text', async () => {
    quietApi();
    const { container } = renderWithProviders(
      <div>
        <HorizontalBars
          label="Saídas por categoria"
          currency="BRL"
          items={[
            { id: 'c1', label: 'Casa', value: 120000, color: '#6d28d9', href: '/finance/expenses' },
            { id: 'others', label: 'Outras', value: 30000 },
          ]}
        />
        <ExpectedVsSettledBars
          label="Previsto e realizado no período"
          currency="BRL"
          expected_label="Previsto"
          settled_label="Realizado"
          groups={[
            { id: 'income', label: 'Entradas', expected: 500000, settled: 400000 },
            { id: 'expense', label: 'Saídas', expected: 300000, settled: 250000 },
          ]}
        />
      </div>,
    );
    const bars = await screen.findByRole('table', { name: 'Saídas por categoria' });
    expect(plain(within(bars).getByRole('row', { name: /Casa/ }).textContent)).toContain(
      'R$ 1.200,00',
    );
    expect(within(bars).getByRole('link', { name: 'Casa' })).toHaveAttribute(
      'href',
      '/finance/expenses',
    );
    const columns = screen.getByRole('table', { name: 'Previsto e realizado no período' });
    const income = within(columns).getByRole('row', { name: /Entradas/ });
    expect(plain(income.textContent)).toContain('R$ 5.000,00');
    expect(plain(income.textContent)).toContain('R$ 4.000,00');
    expect(screen.getAllByText('Previsto').length).toBeGreaterThan(0);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('rf18 paints each bar in the hex color of its category', async () => {
    quietApi();
    const { container } = renderWithProviders(
      <HorizontalBars
        label="Saídas por categoria"
        currency="BRL"
        items={[
          { id: 'c2', label: 'Casa', value: 120000, color: '#0369a1' },
          { id: 'others', label: 'Outras', value: 30000 },
        ]}
      />,
    );
    await screen.findByRole('table', { name: 'Saídas por categoria' });
    const fill = (label: string) => {
      const row = [...container.querySelectorAll('li')].find((li) =>
        li.textContent.startsWith(label),
      );
      return row?.querySelector<HTMLElement>('[class*="barFill"]');
    };
    expect(fill('Casa')?.style.backgroundColor).toBe('rgb(3, 105, 161)');
    expect(fill('Outras')?.style.backgroundColor).toBe('');
    expect(fill('Outras')?.className).toContain('barFillNeutral');
  });

  it('keeps the chart table inside a visually hidden container', async () => {
    quietApi();
    renderWithProviders(
      <div>
        <HorizontalBars
          label="Saídas por categoria"
          currency="BRL"
          items={[{ id: 'c1', label: 'Casa', value: 120000, color: '#6d28d9' }]}
        />
        <ExpectedVsSettledBars
          label="Previsto e realizado no período"
          currency="BRL"
          expected_label="Previsto"
          settled_label="Realizado"
          groups={[{ id: 'income', label: 'Entradas', expected: 500000, settled: 400000 }]}
        />
      </div>,
    );
    for (const name of ['Saídas por categoria', 'Previsto e realizado no período']) {
      const table = await screen.findByRole('table', { name });
      expect(table.className).toBe('');
      expect(table.parentElement?.className).toContain('srOnly');
      const caption = table.querySelector('caption');
      expect(caption?.textContent).toBe(name);
      expect(table.contains(caption)).toBe(true);
    }
  });
  it('rf14 draws expected and settled as horizontal bars with labels', async () => {
    quietApi();
    const { container } = renderWithProviders(<ExpectedChart />);
    await screen.findByRole('table', { name: 'Previsto e realizado no período' });
    const axis = container.querySelector('.recharts-yAxis-tick-labels');
    expect(axis?.textContent).toContain('Entradas');
    expect(axis?.textContent).toContain('Saídas');
    const rects = rectangles(container);
    expect(rects).toHaveLength(4);
    const svg = plain(container.querySelector('svg.recharts-surface')?.textContent);
    expect(svg).toContain('Previsto R$ 5.000,00');
    expect(svg).toContain('Realizado R$ 4.000,00');
    const [expected_income, expected_expense, settled_income, settled_expense] = rects;
    expect(expected_income?.getAttribute('fill')).toBe('var(--success)');
    expect(settled_income?.getAttribute('fill')).toBe('var(--success)');
    expect(expected_expense?.getAttribute('fill')).toBe('var(--accent)');
    expect(settled_expense?.getAttribute('fill')).toBe('var(--accent)');
    expect(opacity(expected_income)).toBeLessThan(opacity(settled_income));
    expect(opacity(expected_expense)).toBeLessThan(opacity(settled_expense));
  });

  it('rf13 shows the value and the difference in the tooltip on focus', async () => {
    quietApi();
    const user = userEvent.setup();
    const { container } = renderWithProviders(<ExpectedChart />);
    await screen.findByRole('table', { name: 'Previsto e realizado no período' });
    const surface = container.querySelector<SVGElement>('svg.recharts-surface');
    expect(surface?.getAttribute('tabindex')).toBe('0');
    surface?.focus();
    await user.keyboard('{ArrowRight}');
    const tooltip = await waitFor(() => {
      const found = container.querySelector('[data-chart-tooltip]');
      expect(found).not.toBeNull();
      return found;
    });
    const text = plain(tooltip?.textContent);
    expect(text).toContain('Entradas');
    expect(text).toContain('Previsto R$ 5.000,00');
    expect(text).toContain('Realizado R$ 4.000,00');
    expect(text).toContain('R$ 1.000,00 abaixo do previsto');
  });

  it('rnf03 keeps the accessible table with the difference', async () => {
    quietApi();
    renderWithProviders(<ExpectedChart />);
    const table = await screen.findByRole('table', { name: 'Previsto e realizado no período' });
    const headers = within(table)
      .getAllByRole('columnheader')
      .map((cell) => cell.textContent);
    expect(headers).toEqual(['Previsto', 'Realizado', 'Diferença']);
    expect(plain(within(table).getByRole('row', { name: /Entradas/ }).textContent)).toContain(
      'R$ 1.000,00 abaixo do previsto',
    );
  });

  it('rf15 draws one column per month with the projected months lighter', async () => {
    quietApi();
    const { container } = renderWithProviders(<Monthly mode="flow" />);
    const table = await screen.findByRole('table', {
      name: 'Entradas, saídas e saldo mês a mês',
    });
    expect(
      container.querySelectorAll('.recharts-xAxis-tick-labels .recharts-cartesian-axis-tick-label'),
    ).toHaveLength(12);
    // Um mês zerado não desenha barra: 11 meses com entradas e saídas, 6 deles projetados.
    const rects = rectangles(container);
    expect(rects).toHaveLength(22);
    expect(rects.filter((rect) => opacity(rect) === 1)).toHaveLength(10);
    expect(rects.filter((rect) => opacity(rect) < 1)).toHaveLength(12);
    expect(screen.getByText('Meses projetados em tom mais claro')).toBeInTheDocument();
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(12);
    expect(rows[0]?.textContent).toContain('Realizado');
    expect(rows[11]?.textContent).toContain('Projetado');
    const headers = within(table)
      .getAllByRole('columnheader')
      .map((cell) => cell.textContent);
    expect(headers).toEqual(['Mês', 'Situação', 'Entradas', 'Saídas']);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('cb08 shows a month without transactions as zero', async () => {
    quietApi();
    const { container } = renderWithProviders(<Monthly mode="flow" />);
    const table = await screen.findByRole('table', {
      name: 'Entradas, saídas e saldo mês a mês',
    });
    expect(plain(container.querySelector('.recharts-xAxis-tick-labels')?.textContent)).toContain(
      'ago.',
    );
    const august = within(table).getByRole('row', { name: /ago\. de 26/ });
    expect(plain(august.textContent)).toContain('R$ 0,00');
  });

  it('rn07 shows a negative balance in amber, never red', async () => {
    quietApi();
    const { container } = renderWithProviders(<Monthly mode="balance" />);
    await screen.findByRole('table', { name: 'Entradas, saídas e saldo mês a mês' });
    const rects = rectangles(container);
    expect(rects).toHaveLength(11);
    const fills = rects.map((rect) => rect.getAttribute('fill'));
    expect(fills).toContain('var(--warning)');
    expect(fills).toContain('var(--success)');
    expect(rects[0]?.getAttribute('fill')).toBe('var(--success)');
    expect(container.innerHTML).not.toMatch(/danger/);
  });

  it('rnf05 moves the monthly tooltip with the keyboard', async () => {
    quietApi();
    const user = userEvent.setup();
    const { container } = renderWithProviders(<Monthly mode="flow" />);
    await screen.findByRole('table', { name: 'Entradas, saídas e saldo mês a mês' });
    container.querySelector<SVGElement>('svg.recharts-surface')?.focus();
    const tooltip = () => plain(container.querySelector('[data-chart-tooltip]')?.textContent);
    await waitFor(() => {
      expect(tooltip()).toContain('jun. de 26');
    });
    await user.keyboard('{ArrowRight}{ArrowRight}');
    await waitFor(() => {
      expect(tooltip()).toContain('ago. de 26');
    });
  });
});

function ExpectedChart() {
  return (
    <ExpectedVsSettledBars
      label="Previsto e realizado no período"
      currency="BRL"
      expected_label="Previsto"
      settled_label="Realizado"
      groups={[
        { id: 'income', label: 'Entradas', expected: 500000, settled: 400000 },
        { id: 'expense', label: 'Saídas', expected: 300000, settled: 250000 },
      ]}
    />
  );
}

/** Doze meses de 2026-06 a 2027-05: os 6 últimos projetados, agosto zerado e um saldo negativo. */
const MONTHS = [
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
  if (month === '2026-08') return { month, income: 0, expense: 0, balance: 0, projected: false };
  const expense = month === '2027-01' ? 900000 : 300000;
  return { month, income: 500000, expense, balance: 500000 - expense, projected: index >= 6 };
});

function Monthly({ mode }: { mode: 'flow' | 'balance' }) {
  return (
    <MonthlyChart
      label="Entradas, saídas e saldo mês a mês"
      currency="BRL"
      months={MONTHS}
      mode={mode}
    />
  );
}

function rectangles(container: HTMLElement): Element[] {
  return [...container.querySelectorAll('.recharts-bar-rectangle path')];
}

function opacity(element: Element | undefined): number {
  return Number(element?.getAttribute('fill-opacity') ?? '1');
}

function SignedAmounts() {
  return (
    <div>
      <MoneyAmount amount={500000} currency="BRL" kind="income" />
      <MoneyAmount amount={150000} currency="BRL" kind="expense" />
      <MoneyAmount amount={250000} currency="BRL" kind="balance" />
      <MoneyAmount amount={-50000} currency="BRL" kind="balance" />
      <MoneyAmount amount={0} currency="BRL" kind="balance" />
    </div>
  );
}

/** Os valores com sinal na ordem da tela; espera o primeiro aparecer. */
async function amounts(): Promise<HTMLElement[]> {
  return waitFor(() => {
    const found = [...document.querySelectorAll<HTMLElement>('[data-kind]')];
    expect(found.length).toBeGreaterThan(0);
    return found;
  });
}

function amountIn(link: HTMLElement): HTMLElement | null | undefined {
  return link.closest('li')?.querySelector<HTMLElement>('[data-kind]');
}
