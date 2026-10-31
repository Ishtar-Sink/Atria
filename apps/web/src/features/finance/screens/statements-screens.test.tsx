import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { clearToasts } from '../../../shared/toast/toast-store';
import {
  account,
  expectNoNativeControls,
  financeServer,
  pageHeading,
  problem,
  renderFinance,
  transaction,
  world,
  type FinanceWorld,
} from '../test-utils';

const plain = (text: string | null | undefined) => (text ?? '').replace(/[  ]/g, ' ');

function statement(period: string, overrides: Record<string, unknown> = {}) {
  const [year = '2026', month = '11'] = period.split('-');
  return {
    period,
    closing_date: `${year}-${month}-03`,
    due_date: `${year}-${month}-10`,
    total_amount: 10000,
    outstanding_amount: 10000,
    paid: false,
    transaction_count: 1,
    ...overrides,
  };
}

function seed(): FinanceWorld {
  return world({
    accounts: [
      account({ id: 'a1', name: 'Conta', is_default: true, balance_amount: 500000 }),
      account({ id: 'a3', name: 'Cartão Nu', kind: 'credit_card', credit_limit_amount: 500000 }),
    ],
    transactions: [1, 2, 3].map((number) =>
      transaction({
        id: `p${String(number)}`,
        account_id: 'a3',
        description: 'Geladeira',
        expected_amount: 10000,
        installment: { number, total: 3 },
        statement_period: `2026-${String(10 + number)}`,
      }),
    ),
    statements: {
      a3: [statement('2026-11'), statement('2026-12'), statement('2026-13')],
    },
  });
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-11-05T12:00:00Z') });
});

afterEach(() => {
  vi.useRealTimers();
  clearToasts();
  vi.unstubAllGlobals();
});

describe('statements screens', () => {
  it('shows installments in their statements', async () => {
    financeServer(seed());
    const user = userEvent.setup();
    const { container, router } = renderFinance('/finance/statements');
    await pageHeading('Financeiro');
    expect(await screen.findByRole('heading', { name: 'novembro de 2026' })).toBeInTheDocument();
    expect(screen.getByLabelText('Cartão')).toHaveTextContent('Cartão Nu');
    const list = screen.getByRole('region', { name: 'Movimentações da fatura' });
    const rows = await within(list).findAllByRole('listitem');
    expect(rows).toHaveLength(1);
    expect(plain(rows[0]?.textContent)).toContain('parcela 1 de 3');
    const card = screen.getByRole('region', { name: 'novembro de 2026' });
    expect(plain(card.textContent)).toContain('TotalR$ 100,00');
    expect(plain(card.textContent)).toContain('Vencimento10 de nov. de 2026');
    expect(await axe(container)).toHaveNoViolations();
    await user.click(screen.getByLabelText('Fatura'));
    await user.click(await screen.findByRole('option', { name: /dezembro de 2026/ }));
    await waitFor(() => {
      expect(router.state.location.search).toMatchObject({ statement: '2026-12' });
    });
    expect(plain((await within(list).findAllByRole('listitem'))[0]?.textContent)).toContain(
      'parcela 2 de 3',
    );
  });

  it('pays the statement from an account', async () => {
    const { calls } = financeServer(seed());
    const user = userEvent.setup();
    const { router } = renderFinance('/finance/statements?card_id=a3');
    await user.click(await screen.findByRole('button', { name: 'Pagar fatura' }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(
        '/finance/credit-cards/a3/statements/2026-11/pay',
      );
    });
    const { container } = { container: document.body };
    await pageHeading('Pagar fatura');
    expectNoNativeControls(container);
    expect(screen.getByLabelText('Conta de origem')).toHaveTextContent('Conta');
    await user.click(screen.getByRole('button', { name: 'Pagar' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Pagar esta fatura?' });
    expect(calls.some((call) => call.method === 'POST')).toBe(false);
    await user.click(within(dialog).getByRole('button', { name: 'Pagar' }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/finance/statements');
    });
    const post = calls.find((call) => call.method === 'POST');
    expect(post?.path).toBe('/credit-cards/a3/statements/2026-11/payment');
    expect(post?.body).toEqual({ from_account_id: 'a1', paid_on: '2026-11-05' });
    expect(post?.headers['Idempotency-Key']).toBeDefined();
    const card = await screen.findByRole('region', { name: 'novembro de 2026' });
    expect(await within(card).findByText('Paga')).toBeInTheDocument();
    expect(within(card).queryByRole('button', { name: 'Pagar fatura' })).toBeNull();
  });

  it('shows statements empty, loading and error', async () => {
    const empty = financeServer(world({ accounts: [account({ id: 'a1', name: 'Conta' })] }));
    const first = renderFinance('/finance/statements');
    expect(await screen.findByText('Nenhum cartão de crédito.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Criar uma conta' })).toHaveAttribute(
      'href',
      '/finance/accounts/new',
    );
    first.unmount();
    expect(empty.calls.length).toBeGreaterThan(0);

    const state = seed();
    let mode: 'hang' | 'error' | 'ok' = 'hang';
    state.override = (call) => {
      if (!call.path.endsWith('/statements')) return undefined;
      if (mode === 'hang') return { hang: true };
      if (mode === 'error') return problem(500, 'internal_error');
      return undefined;
    };
    financeServer(state);
    const second = renderFinance('/finance/statements');
    expect(await screen.findByRole('status')).toHaveAttribute('aria-busy', 'true');
    second.unmount();
    mode = 'error';
    renderFinance('/finance/statements');
    const alert = await screen.findByRole('alert');
    mode = 'ok';
    await userEvent.click(within(alert).getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByRole('heading', { name: 'novembro de 2026' })).toBeInTheDocument();
  });
});
