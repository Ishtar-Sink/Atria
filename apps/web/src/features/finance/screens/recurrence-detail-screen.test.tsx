import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { clearToasts } from '../../../shared/toast/toast-store';
import {
  account,
  financeServer,
  item,
  pageHeading,
  renderFinance,
  transaction,
  world,
  type ApiCall,
  type FinanceWorld,
} from '../test-utils';

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

function rent() {
  return {
    id: 'r1',
    account_id: 'a1',
    category_id: null,
    currency: 'BRL',
    description: 'Aluguel',
    expected_amount: 200000,
    kind: 'expense',
    owner_id: 'u1',
    visibility: 'personal',
    rule: RULE,
    open_occurrence: { occurrence_date: '2026-10-31', status: 'overdue' },
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };
}

function copy(id: string, date: string) {
  return transaction({
    id,
    description: 'Aluguel',
    category_id: null,
    status: 'settled',
    expected_amount: 200000,
    settled_amount: 200000,
    settled_at: date,
    expected_date: date,
    effective_date: date,
    occurrence_date: date,
    generated_from: 'r1',
    recurrence_id: 'r1',
  });
}

function virtual(date: string, status: 'overdue' | 'forecast') {
  return item({
    id: null,
    recurrence_id: 'r1',
    occurrence_date: date,
    expected_date: date,
    effective_date: date,
    status,
    description: 'Aluguel',
    category_id: null,
    expected_amount: 200000,
  });
}

function seed(): FinanceWorld {
  const t9 = copy('t9', '2026-09-30');
  const t8 = copy('t8', '2026-08-31');
  return world({
    accounts: [account({ id: 'a1', name: 'Conta', is_default: true, balance_amount: 500000 })],
    transactions: [
      virtual('2026-10-31', 'overdue'),
      virtual('2026-11-30', 'forecast'),
      t9,
      t8,
      transaction({
        id: 't2',
        description: 'Luz',
        category_id: null,
        status: 'settled',
        expected_amount: 20000,
        settled_amount: 20000,
        settled_at: '2026-11-03',
        effective_date: '2026-11-03',
      }),
    ],
    recurring: [rent()],
    copies: { r1: [t9, t8] },
  });
}

function calledWith(calls: ApiCall[], method: string, path: string) {
  return calls.filter((call) => call.method === method && call.path === path);
}

/** Exclusão da recorrência no servidor simulado: some com ela e com as ocorrências virtuais. */
function deleteRecurrence(state: FinanceWorld) {
  state.override = (call) => {
    if (call.method === 'DELETE' && call.path === '/recurring-transactions/r1') {
      state.recurring = state.recurring.filter((entry) => entry.id !== 'r1');
      state.transactions = state.transactions.filter(
        (entry) => !(entry.id === null && entry.recurrence_id === 'r1'),
      );
      return { status: 204 };
    }
    return undefined;
  };
}

async function openDeleteDialog(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Mais ações' }));
  await user.click(screen.getByRole('menuitem', { name: 'Excluir' }));
  return screen.findByRole('alertdialog', { name: 'Excluir esta recorrência?' });
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-11-05T12:00:00Z') });
});

afterEach(() => {
  vi.useRealTimers();
  clearToasts();
  vi.unstubAllGlobals();
});

describe('recurrence deletion', () => {
  it('rf01 deletes a recurrence from more actions after confirmation', async () => {
    const state = seed();
    deleteRecurrence(state);
    const { calls } = financeServer(state);
    const user = userEvent.setup();
    const { router, container } = renderFinance('/finance/recurring-transactions/r1');
    await pageHeading('Aluguel');
    const dialog = await openDeleteDialog(user);
    expect(dialog).toHaveTextContent(
      'A recorrência e a ocorrência aberta saem das listas e da previsão. As liquidações já feitas continuam no histórico, sem mudar o saldo.',
    );
    expect(calledWith(calls, 'DELETE', '/recurring-transactions/r1')).toHaveLength(0);
    expect(await axe(container)).toHaveNoViolations();
    await user.click(within(dialog).getByRole('button', { name: 'Excluir' }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/finance/expenses');
    });
    expect(calledWith(calls, 'DELETE', '/recurring-transactions/r1')).toHaveLength(1);
    expect(
      await screen.findByText(
        'Recorrência excluída. As liquidações já feitas continuam no histórico.',
      ),
    ).toBeInTheDocument();
  });

  it('rf01 keeps the recurrence when the deletion is cancelled', async () => {
    const { calls } = financeServer(seed());
    const user = userEvent.setup();
    renderFinance('/finance/recurring-transactions/r1');
    await pageHeading('Aluguel');
    const dialog = await openDeleteDialog(user);
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });
    expect(calledWith(calls, 'DELETE', '/recurring-transactions/r1')).toHaveLength(0);
    expect(screen.getByRole('heading', { level: 1, name: 'Aluguel' })).toBeInTheDocument();
  });

  it('ct01 keeps the settled copies in the history after deleting the recurrence', async () => {
    const state = seed();
    deleteRecurrence(state);
    const { calls } = financeServer(state);
    const user = userEvent.setup();
    const { router } = renderFinance('/finance/recurring-transactions/r1');
    await pageHeading('Aluguel');
    const dialog = await openDeleteDialog(user);
    await user.click(within(dialog).getByRole('button', { name: 'Excluir' }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/finance/expenses');
    });
    await router.navigate({ to: '/finance/expenses', search: { period: 'all' } });
    await waitFor(() => {
      expect(screen.getAllByRole('link', { name: /Aluguel/ })).toHaveLength(2);
    });
    for (const link of screen.getAllByRole('link', { name: /Aluguel/ })) {
      const row = link.closest('li');
      expect(row).toHaveTextContent('Liquidada');
      expect(row).not.toHaveTextContent(/Atrasada|Prevista|Previsão/);
    }
    const balance_writes = calls.filter(
      (call) =>
        (call.method === 'PATCH' || call.method === 'POST') && call.path.startsWith('/accounts'),
    );
    expect(balance_writes).toHaveLength(0);
  });
});

describe('settled copy of a recurrence', () => {
  it('rf04 offers undo instead of delete on a settled copy', async () => {
    financeServer(seed());
    const user = userEvent.setup();
    const first = renderFinance('/finance/transactions/t9');
    await pageHeading('Aluguel');
    expect(screen.getByRole('button', { name: 'Desfazer liquidação' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mais ações' })).not.toBeInTheDocument();
    first.unmount();
    renderFinance('/finance/transactions/t2');
    await pageHeading('Luz');
    await user.click(screen.getByRole('button', { name: 'Mais ações' }));
    expect(screen.getByRole('menuitem', { name: 'Excluir' })).toBeInTheDocument();
  });

  it('ct03 undoing a settled copy explains the reopening and reopens the occurrence', async () => {
    const state = seed();
    state.override = (call) => {
      if (call.method === 'DELETE' && call.path === '/transactions/t9/settlement') {
        state.transactions = state.transactions.filter((entry) => entry.id !== 't9');
        state.copies.r1 = (state.copies.r1 ?? []).filter((entry) => entry.id !== 't9');
        const recurrence = state.recurring[0] as Record<string, unknown>;
        recurrence.open_occurrence = { occurrence_date: '2026-09-30', status: 'overdue' };
        const conta = state.accounts[0];
        if (conta) conta.balance_amount += 200000;
        return { status: 204 };
      }
      return undefined;
    };
    const { calls } = financeServer(state);
    const user = userEvent.setup();
    const { router } = renderFinance('/finance/transactions/t9');
    await pageHeading('Aluguel');
    await user.click(screen.getByRole('button', { name: 'Desfazer liquidação' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Desfazer esta liquidação?' });
    expect(dialog).toHaveTextContent(
      'O valor volta para o saldo e, se esta for a liquidação mais recente da recorrência, a ocorrência volta a ficar aberta.',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Desfazer liquidação' }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/finance/recurring-transactions/r1');
    });
    expect(await screen.findByText('Ocorrência de 30 de set. de 2026')).toBeInTheDocument();
    const undo_at = calls.findIndex(
      (call) => call.method === 'DELETE' && call.path === '/transactions/t9/settlement',
    );
    await waitFor(() => {
      expect(
        calls
          .slice(undo_at + 1)
          .some((call) => call.method === 'GET' && call.path.startsWith('/accounts')),
      ).toBe(true);
    });
  });
});
