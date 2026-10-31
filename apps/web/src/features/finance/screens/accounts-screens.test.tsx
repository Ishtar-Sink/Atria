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
  tabsThrough,
  transaction,
  world,
  type FinanceWorld,
} from '../test-utils';

const renderAt = renderFinance;

function seed(): FinanceWorld {
  return world({
    accounts: [
      account({ id: 'a1', name: 'Conta principal', is_default: true, balance_amount: 350000 }),
      account({ id: 'a2', name: 'Carteira', balance_amount: 5000 }),
      account({
        id: 'a3',
        name: 'Cartão Nu',
        kind: 'credit_card',
        credit_limit_amount: 500000,
        closing_day: 3,
        due_day: 10,
      }),
    ],
    transactions: [transaction({ id: 't1', account_id: 'a2', description: 'Café' })],
  });
}

const heading = pageHeading;
const noNativeControls = expectNoNativeControls;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-11-05T12:00:00Z') });
});

afterEach(() => {
  vi.useRealTimers();
  clearToasts();
  vi.unstubAllGlobals();
});

describe('accounts screens', () => {
  it('lists accounts with filters in the url', async () => {
    financeServer(seed());
    const user = userEvent.setup();
    const { container, router } = renderAt('/finance/accounts?kind=credit_card');
    await heading('Financeiro');
    expect(
      screen.getByText('Contas, entradas e saídas, do previsto ao realizado.'),
    ).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Cartão Nu' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Carteira' })).toBeNull();
    const filters = screen.getByRole('group', { name: 'Filtros' });
    expect(within(filters).getByRole('button', { name: 'Cartões' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('searchbox', { name: 'Busca' })).toHaveAttribute('maxlength', '100');
    expect(screen.getByRole('group', { name: 'Visualização' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Contas' })).toHaveAttribute('aria-current', 'page');
    await user.click(within(filters).getByRole('button', { name: 'Todas' }));
    await waitFor(() => {
      expect(router.state.location.search).toMatchObject({ kind: 'all' });
    });
    expect(await screen.findByRole('link', { name: 'Carteira' })).toBeInTheDocument();
    expect(screen.getByText('Padrão')).toBeInTheDocument();
    await user.type(screen.getByRole('searchbox', { name: 'Busca' }), 'cart');
    await waitFor(() => {
      expect(router.state.location.search).toMatchObject({ q: 'cart' });
    });
    expect(screen.queryByRole('link', { name: 'Conta principal' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Grade' }));
    await waitFor(() => {
      expect(router.state.location.search).toMatchObject({ view: 'grid' });
    });
    await tabsThrough(user);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('shows accounts empty, loading and error', async () => {
    const state = world();
    let mode: 'hang' | 'error' | 'ok' = 'hang';
    state.override = (call) => {
      if (call.path !== '/accounts') return undefined;
      if (mode === 'hang') return { hang: true };
      if (mode === 'error') return problem(500, 'internal_error');
      return undefined;
    };
    financeServer(state);
    const first = renderAt('/finance/accounts');
    expect(await screen.findByRole('status')).toHaveAttribute('aria-busy', 'true');
    first.unmount();
    mode = 'error';
    const second = renderAt('/finance/accounts');
    const alert = await screen.findByRole('alert');
    expect(within(alert).getByRole('button', { name: 'Tentar de novo' })).toBeInTheDocument();
    mode = 'ok';
    await userEvent.click(within(alert).getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByText('Nenhuma conta ainda.')).toBeInTheDocument();
    expect(
      screen.getByText('Crie uma conta ou um cartão para registrar as movimentações.'),
    ).toBeInTheDocument();
    second.unmount();
  });

  it('creates a credit card account', async () => {
    const { calls } = financeServer(seed());
    const user = userEvent.setup();
    const { container, router } = renderAt('/finance/accounts/new');
    await heading('Nova conta');
    noNativeControls(container);
    await user.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(await screen.findByText('Informe o nome.')).toHaveAttribute('role', 'alert');
    await user.type(screen.getByRole('textbox', { name: 'Nome' }), 'Cartão Inter');
    await user.click(screen.getByRole('radio', { name: 'Cartão de crédito' }));
    await user.type(await screen.findByRole('textbox', { name: 'Limite (R$)' }), '5.000,00');
    await user.type(screen.getByRole('textbox', { name: 'Dia de fechamento' }), '3');
    await user.type(screen.getByRole('textbox', { name: 'Dia de vencimento' }), '10');
    expect(screen.getByRole('radio', { name: 'Pessoal' })).toBeChecked();
    expect(await axe(container)).toHaveNoViolations();
    await user.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => {
      expect(calls.some((call) => call.method === 'POST' && call.path === '/accounts')).toBe(true);
    });
    expect(calls.find((call) => call.method === 'POST')?.body).toEqual({
      name: 'Cartão Inter',
      kind: 'credit_card',
      visibility: 'personal',
      credit_limit_amount: 500000,
      closing_day: 3,
      due_day: 10,
    });
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/finance/accounts/a4');
    });
  });

  it('renames an account', async () => {
    const { calls } = financeServer(seed());
    const user = userEvent.setup();
    const { router } = renderAt('/finance/accounts/a2/edit');
    await heading('Editar conta');
    expect(screen.queryByRole('radiogroup', { name: 'Tipo' })).toBeNull();
    const name = await screen.findByRole('textbox', { name: 'Nome' });
    await user.clear(name);
    await user.type(name, 'Dinheiro');
    await user.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/finance/accounts/a2');
    });
    expect(calls.find((call) => call.method === 'PATCH')?.body).toMatchObject({ name: 'Dinheiro' });
  });

  it('deletes a common account after confirmation', async () => {
    const { calls } = financeServer(seed());
    const user = userEvent.setup();
    const { router } = renderAt('/finance/accounts/a2');
    await heading('Carteira');
    await user.click(screen.getByRole('button', { name: 'Mais ações' }));
    await user.click(screen.getByRole('menuitem', { name: 'Excluir' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Excluir esta conta?' });
    expect(calls.some((call) => call.method === 'DELETE')).toBe(false);
    await user.click(within(dialog).getByRole('button', { name: 'Excluir' }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/finance/accounts');
    });
    expect(calls.find((call) => call.method === 'DELETE')?.path).toBe('/accounts/a2');
  });

  it('offers rename or the transactions when the account has transactions', async () => {
    const state = seed();
    state.override = (call) =>
      call.method === 'DELETE' ? problem(409, 'account_has_transactions') : undefined;
    financeServer(state);
    const user = userEvent.setup();
    renderAt('/finance/accounts/a2');
    await heading('Carteira');
    await user.click(screen.getByRole('button', { name: 'Mais ações' }));
    await user.click(screen.getByRole('menuitem', { name: 'Excluir' }));
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Excluir' }),
    );
    const dialog = await screen.findByRole('alertdialog', {
      name: 'Esta conta tem movimentações',
    });
    expect(within(dialog).getByRole('button', { name: 'Renomear' })).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Ver movimentações' }));
    expect(await screen.findByRole('tab', { name: 'Movimentações' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(await screen.findByRole('link', { name: 'Café' })).toBeInTheDocument();
  });

  it('disables delete for the default account with a hint', async () => {
    financeServer(seed());
    const user = userEvent.setup();
    renderAt('/finance/accounts/a1');
    await heading('Conta principal');
    expect(
      screen.getByText('A conta principal não pode ser excluída. Você pode renomeá-la em Editar.'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Mais ações' }));
    const menu = screen.getByRole('menu');
    expect(within(menu).queryByRole('menuitem', { name: 'Excluir' })).toBeNull();
  });

  it('shows edit, card statement and more actions on the account detail', async () => {
    financeServer(seed());
    const user = userEvent.setup();
    const { container, router } = renderAt('/finance/accounts/a3');
    await heading('Cartão Nu');
    expect(screen.getByRole('button', { name: 'Editar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mais ações' })).toBeInTheDocument();
    expect(screen.getByText('dia 3 / dia 10')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Registro' })).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
    await user.click(screen.getByRole('button', { name: 'Ver fatura' }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/finance/statements');
    });
    expect(router.state.location.search).toMatchObject({ card_id: 'a3' });
  });

  it('issues the finance reports filtered by the account', async () => {
    financeServer(seed());
    const user = userEvent.setup();
    renderAt('/finance/accounts/a2');
    await heading('Carteira');
    await user.click(screen.getByRole('button', { name: 'Mais ações' }));
    const flow = screen.getByRole('menuitem', { name: /Entradas e saídas por mês/ });
    expect(flow).toHaveAttribute('href', '/reports/fin-flow?account_id=a2&period=all&run=1');
    expect(screen.getByRole('menuitem', { name: /Gastos por categoria/ })).toHaveAttribute(
      'href',
      '/reports/fin-cat?account_id=a2&period=all&run=1',
    );
    expect(screen.getByRole('menuitem', { name: /Economias e perdas/ })).toHaveAttribute(
      'href',
      '/reports/fin-diff?account_id=a2&period=all&run=1',
    );
  });
});
