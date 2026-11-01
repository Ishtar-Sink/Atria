import { zodResolver } from '@hookform/resolvers/zod';
import { createRoute } from '@tanstack/react-router';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm } from 'react-hook-form';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { z } from 'zod';
import { rootRoute } from '../../../app/router';
import { renderWithProviders } from '../../../shared/test/render';
import { item, mockApi } from '../test-utils';
import { DifferenceBadge } from './difference-badge';
import { FinanceShell, type FinanceTab } from './finance-shell';
import { MoneyField } from './money-field';
import { ExpectedVsSettledColumns, HorizontalBars } from './panel-charts';
import { TransactionRow } from './transaction-row';
import { VisibilityField } from './visibility-field';

afterEach(() => {
  vi.unstubAllGlobals();
});

function quietApi() {
  mockApi({ 'GET /me': { status: 401, body: { code: 'unauthenticated', title: 'x' } } });
}

/** Troca espaços especiais do Intl por espaço comum, para comparar texto. */
const plain = (text: string | null | undefined) => (text ?? '').replace(/[  ]/g, ' ');

describe('finance components', () => {
  it('formats values without plus or minus sign', async () => {
    quietApi();
    renderWithProviders(
      <ul>
        <TransactionRow
          item={item({
            id: 't1',
            kind: 'expense',
            expected_amount: 150000,
            description: 'Aluguel',
          })}
          account_name="Conta"
          category_name="Casa"
        />
        <TransactionRow
          item={item({ id: 't2', kind: 'income', expected_amount: 500000, description: 'Salário' })}
        />
      </ul>,
    );
    const rows = [
      (await screen.findByRole('link', { name: 'Aluguel' })).closest('li'),
      screen.getByRole('link', { name: 'Salário' }).closest('li'),
    ];
    expect(plain(rows[0]?.textContent)).toContain('R$ 1.500,00');
    expect(plain(rows[1]?.textContent)).toContain('R$ 5.000,00');
    for (const row of rows) {
      expect(row?.textContent).not.toMatch(/[+−]|-\s?R\$/);
    }
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
            installment: { number: 2, total: 3 },
          })}
          category_name="Casa"
          account_name="Conta"
        />
      </ul>,
    );
    const link = await screen.findByRole('link', { name: 'Luz (2/3)' });
    expect(link).toHaveAttribute('href', '/finance/transactions/t1');
    const row = link.closest('li');
    if (!row) throw new Error('sem linha');
    const meta = row.lastElementChild as HTMLElement;
    const value = meta.firstElementChild;
    expect(plain(value?.textContent)).toBe('R$ 180,00');
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
            { id: 'c1', label: 'Casa', value: 120000, tone: 'primary', href: '/finance/expenses' },
            { id: 'others', label: 'Outras', value: 30000, tone: 'info' },
          ]}
        />
        <ExpectedVsSettledColumns
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

  it('keeps the chart table inside a visually hidden container', async () => {
    quietApi();
    renderWithProviders(
      <div>
        <HorizontalBars
          label="Saídas por categoria"
          currency="BRL"
          items={[{ id: 'c1', label: 'Casa', value: 120000, tone: 'primary' }]}
        />
        <ExpectedVsSettledColumns
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
});
