import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { clearToasts } from '../../../shared/toast/toast-store';
import {
  category,
  expectNoNativeControls,
  financeServer,
  pageHeading,
  problem,
  renderFinance,
  tabsThrough,
  world,
  type FinanceWorld,
} from '../test-utils';

function seed(): FinanceWorld {
  return world({
    categories: [
      category({ id: 'c1', name: 'Mercado', kind: 'expense', color: 'warning' }),
      category({ id: 'c2', name: 'Casa', kind: 'expense', color: 'info' }),
      category({ id: 'c3', name: 'Salário', kind: 'income', color: 'success' }),
    ],
  });
}

afterEach(() => {
  clearToasts();
  vi.unstubAllGlobals();
});

describe('categories screens', () => {
  it('groups categories by income and expense in finance settings', async () => {
    financeServer(seed());
    const user = userEvent.setup();
    const { container } = renderFinance('/finance/settings');
    await pageHeading('Financeiro');
    expect(screen.getByRole('link', { name: 'Configurações' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(
      screen.getByText('Agrupam as entradas e saídas nos painéis e relatórios.'),
    ).toBeInTheDocument();
    const income = screen.getByRole('region', { name: 'Entradas' });
    const expense = screen.getByRole('region', { name: 'Saídas' });
    expect(await within(income).findByRole('link', { name: 'Salário' })).toBeInTheDocument();
    const names = (await within(expense).findAllByRole('link')).map((link) => link.textContent);
    expect(names).toEqual(['Casa', 'Mercado']);
    expect(within(expense).getByText('Âmbar')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Período/ })).toBeNull();
    await tabsThrough(user);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('shows an empty group with a calm text', async () => {
    financeServer(world({ categories: [category({ id: 'c1', name: 'Mercado' })] }));
    renderFinance('/finance/settings');
    const income = await screen.findByRole('region', { name: 'Entradas' });
    expect(await within(income).findByText('Nenhuma categoria.')).toBeInTheDocument();
  });

  it('creates and renames a category', async () => {
    const { calls } = financeServer(seed());
    const user = userEvent.setup();
    const created = renderFinance('/finance/categories/new?kind=income');
    await pageHeading('Nova categoria');
    expectNoNativeControls(created.container);
    expect(screen.getByRole('radio', { name: 'Entradas' })).toBeChecked();
    await user.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(await screen.findByText('Informe o nome.')).toHaveAttribute('role', 'alert');
    await user.type(screen.getByRole('textbox', { name: 'Nome' }), 'Freelas');
    await user.click(screen.getByLabelText('Cor'));
    await user.click(await screen.findByRole('option', { name: 'Verde' }));
    expect(await axe(created.container)).toHaveNoViolations();
    await user.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => {
      expect(created.router.state.location.pathname).toBe('/finance/categories/c4');
    });
    expect(calls.find((call) => call.method === 'POST')?.body).toEqual({
      name: 'Freelas',
      kind: 'income',
      color: 'success',
      visibility: 'personal',
    });
    created.unmount();

    const edit = renderFinance('/finance/categories/c4/edit');
    await pageHeading('Editar categoria');
    expect(screen.queryByRole('radiogroup', { name: 'Tipo' })).toBeNull();
    const name = screen.getByRole('textbox', { name: 'Nome' });
    await user.clear(name);
    await user.type(name, 'Trabalhos extras');
    await user.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => {
      expect(edit.router.state.location.pathname).toBe('/finance/categories/c4');
    });
    const patch = calls.find((call) => call.method === 'PATCH');
    expect(patch?.body).toMatchObject({ name: 'Trabalhos extras' });
    expect(patch?.body).not.toHaveProperty('kind');
  });

  it('opens each category on its own page', async () => {
    financeServer(seed());
    const user = userEvent.setup();
    const { router } = renderFinance('/finance/settings');
    await user.click(await screen.findByRole('link', { name: 'Mercado' }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/finance/categories/c1');
    });
    await pageHeading('Mercado');
    expect(screen.getByRole('button', { name: 'Editar' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Registro' })).toBeInTheDocument();
  });

  it('asks for a destination category of the same kind when deleting one in use', async () => {
    const state = seed();
    state.override = (call) =>
      call.method === 'DELETE' && !call.url.searchParams.has('replacement_id')
        ? problem(409, 'category_replacement_required')
        : undefined;
    const { calls } = financeServer(state);
    const user = userEvent.setup();
    const { router } = renderFinance('/finance/categories/c1');
    await pageHeading('Mercado');
    await user.click(screen.getByRole('button', { name: 'Mais ações' }));
    await user.click(screen.getByRole('menuitem', { name: 'Excluir' }));
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Excluir' }),
    );
    const dialog = await screen.findByRole('alertdialog', { name: 'Excluir esta categoria?' });
    expect(dialog).toHaveTextContent('Esta categoria está em uso.');
    await user.click(within(dialog).getByRole('button', { name: 'Excluir' }));
    expect(await within(dialog).findByText('Escolha a categoria de destino.')).toBeInTheDocument();
    await user.click(within(dialog).getByLabelText('Categoria de destino'));
    expect(screen.queryByRole('option', { name: 'Salário' })).toBeNull();
    await user.click(screen.getByRole('option', { name: 'Casa' }));
    await user.click(within(dialog).getByRole('button', { name: 'Excluir' }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/finance/settings');
    });
    const last = calls.filter((call) => call.method === 'DELETE').at(-1);
    expect(last?.url.searchParams.get('replacement_id')).toBe('c2');
  });

  it('issues the category spending report from an expense category', async () => {
    financeServer(seed());
    const user = userEvent.setup();
    const expense = renderFinance('/finance/categories/c1');
    await pageHeading('Mercado');
    await user.click(screen.getByRole('button', { name: 'Mais ações' }));
    expect(screen.getByRole('menuitem', { name: 'Gastos por categoria' })).toHaveAttribute(
      'href',
      '/reports/fin-cat?category_id=c1&run=1',
    );
    expense.unmount();
    renderFinance('/finance/categories/c3');
    await pageHeading('Salário');
    await user.click(screen.getByRole('button', { name: 'Mais ações' }));
    expect(screen.queryByRole('menuitem', { name: 'Gastos por categoria' })).toBeNull();
  });
});
