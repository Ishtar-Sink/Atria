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
      account({ id: 'a3', name: 'Cartão Nu', visibility: 'shared' }),
    ],
    transactions: [transaction({ id: 't1', account_id: 'a2', description: 'Café' })],
  });
}

const heading = pageHeading;
const plain = (text: string | null | undefined) => (text ?? '').replace(/[\u00a0\u202f]/g, ' ');

/** A conta `a2` tem movimentações: sem `move_to` o servidor recusa; com `move_to=a1`, move e exclui. */
function withTransactions(): FinanceWorld {
  const state = seed();
  state.override = (call) => {
    if (call.method !== 'DELETE' || call.path !== '/accounts/a2') return undefined;
    const move_to = call.url.searchParams.get('move_to');
    if (move_to === null) return problem(409, 'account_has_transactions');
    if (move_to !== 'a1') return undefined;
    state.accounts = state.accounts.filter((entry) => entry.id !== 'a2');
    const main = state.accounts.find((entry) => entry.id === 'a1');
    if (main) main.balance_amount += 5000;
    const moved = state.transactions.find((entry) => entry.id === 't1');
    if (moved) moved.account_id = 'a1';
    return { status: 204 };
  };
  return state;
}

async function chooseOption(label: string, option: string) {
  const user = userEvent.setup();
  await user.click(screen.getByLabelText(label));
  await user.click(await screen.findByRole('option', { name: option }));
}

/** "Mais ações", "Excluir" e confirmar: a conta com movimentações abre o diálogo da conta de destino. */
async function openDestination(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Mais ações' }));
  await user.click(screen.getByRole('menuitem', { name: 'Excluir' }));
  await user.click(
    within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Excluir' }),
  );
  const dialog = await screen.findByRole('alertdialog', { name: 'Excluir esta conta?' });
  await within(dialog).findByText('Conta de destino');
  return dialog;
}
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
    const { container, router } = renderAt('/finance/accounts?visibility=shared');
    await heading('Financeiro');
    expect(
      screen.getByText('Contas, entradas e saídas, do previsto ao realizado.'),
    ).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Cartão Nu' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Carteira' })).toBeNull();
    const filters = screen.getByRole('group', { name: 'Filtros' });
    expect(within(filters).getByRole('button', { name: 'Compartilhadas' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('searchbox', { name: 'Busca' })).toHaveAttribute('maxlength', '100');
    expect(screen.getByRole('group', { name: 'Visualização' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Contas' })).toHaveAttribute('aria-current', 'page');
    await user.click(within(filters).getByRole('button', { name: 'Todas' }));
    await waitFor(() => {
      expect(router.state.location.search).toMatchObject({ visibility: 'all' });
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
    expect(screen.getByText('Crie uma conta para registrar as movimentações.')).toBeInTheDocument();
    second.unmount();
  });

  it('rf07 creates an account without the card type', async () => {
    const { calls } = financeServer(seed());
    const user = userEvent.setup();
    const { container, router } = renderAt('/finance/accounts/new');
    await heading('Nova conta');
    noNativeControls(container);
    expect(screen.queryByRole('radio', { name: 'Cartão de crédito' })).toBeNull();
    expect(screen.queryByRole('textbox', { name: 'Limite (R$)' })).toBeNull();
    expect(screen.queryByRole('textbox', { name: 'Dia de fechamento' })).toBeNull();
    expect(screen.queryByRole('textbox', { name: 'Dia de vencimento' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(await screen.findByText('Informe o nome.')).toHaveAttribute('role', 'alert');
    await user.type(screen.getByRole('textbox', { name: 'Nome' }), 'Reserva');
    expect(screen.getByRole('radio', { name: 'Pessoal' })).toBeChecked();
    expect(await axe(container)).toHaveNoViolations();
    await user.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => {
      expect(calls.some((call) => call.method === 'POST' && call.path === '/accounts')).toBe(true);
    });
    expect(calls.find((call) => call.method === 'POST')?.body).toEqual({
      name: 'Reserva',
      visibility: 'personal',
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
    const remove = calls.find((call) => call.method === 'DELETE');
    expect(remove?.path).toBe('/accounts/a2');
    expect(remove?.url.searchParams.has('move_to')).toBe(false);
  });

  it('rf05 asks for the destination account when the account has transactions', async () => {
    const state = withTransactions();
    const { calls } = financeServer(state);
    const user = userEvent.setup();
    const { router, container } = renderAt('/finance/accounts/a2');
    await heading('Carteira');
    const dialog = await openDestination(user);
    expect(dialog).toHaveTextContent(
      'Esta conta tem movimentações. Escolha a conta que vai recebê-las: as movimentações, as transferências e as recorrências passam para ela, e os saldos das duas são recalculados.',
    );
    await user.click(within(dialog).getByLabelText('Conta de destino'));
    const options = (await screen.findAllByRole('option')).map((option) => option.textContent);
    expect(options).toEqual(['Conta principal', 'Cartão Nu']);
    await user.keyboard('{Escape}');
    expect(await axe(container)).toHaveNoViolations();
    await chooseOption('Conta de destino', 'Conta principal');
    await user.click(
      within(screen.getByRole('alertdialog', { name: 'Excluir esta conta?' })).getByRole('button', {
        name: 'Mover e excluir',
      }),
    );
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/finance/accounts');
    });
    const moved = calls.filter(
      (call) => call.method === 'DELETE' && call.url.searchParams.get('move_to') === 'a1',
    );
    expect(moved.map((call) => call.path)).toEqual(['/accounts/a2']);
    expect(
      await screen.findByText('Conta excluída. As movimentações passaram para Conta principal.'),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByRole('link', { name: 'Carteira' })).toBeNull();
    });
    const main = (await screen.findByRole('link', { name: 'Conta principal' })).closest('li');
    expect(plain(main?.textContent)).toContain('R$ 3.550,00');
  });

  it('rf05 asks to choose the destination before deleting', async () => {
    const { calls } = financeServer(withTransactions());
    const user = userEvent.setup();
    renderAt('/finance/accounts/a2');
    await heading('Carteira');
    const dialog = await openDestination(user);
    await user.click(within(dialog).getByRole('button', { name: 'Mover e excluir' }));
    expect(await within(dialog).findByText('Escolha a conta de destino.')).toBeInTheDocument();
    expect(calls.filter((call) => call.method === 'DELETE')).toHaveLength(1);
  });

  it('ct05 shows a destination in another currency inside the dialog', async () => {
    const state = withTransactions();
    const base = state.override;
    state.override = (call) =>
      call.method === 'DELETE' && call.url.searchParams.has('move_to')
        ? problem(422, 'currency_mismatch')
        : base?.(call);
    financeServer(state);
    const user = userEvent.setup();
    const { router } = renderAt('/finance/accounts/a2');
    await heading('Carteira');
    const dialog = await openDestination(user);
    await chooseOption('Conta de destino', 'Conta principal');
    await user.click(within(dialog).getByRole('button', { name: 'Mover e excluir' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'A conta de destino precisa ter a mesma moeda desta conta.',
    );
    expect(screen.getByRole('alertdialog', { name: 'Excluir esta conta?' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/finance/accounts/a2');
    expect(screen.getByRole('heading', { level: 1, name: 'Carteira' })).toBeInTheDocument();
    await chooseOption('Conta de destino', 'Cartão Nu');
    await waitFor(() => {
      expect(within(dialog).queryByRole('alert')).toBeNull();
    });
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

  it('rf07 shows edit and more actions on the account detail without the statement', async () => {
    financeServer(seed());
    const { container } = renderAt('/finance/accounts/a3');
    await heading('Cartão Nu');
    expect(screen.getByRole('button', { name: 'Editar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mais ações' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ver fatura' })).toBeNull();
    for (const text of ['Tipo', 'Limite', 'Fechamento / vencimento']) {
      expect(screen.queryByText(text)).toBeNull();
    }
    expect(screen.getByRole('heading', { name: 'Registro' })).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
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
