import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { axe } from 'vitest-axe';
import { rootRoute } from '../../../app/router';
import { renderWithProviders } from '../../../shared/test/render';
import { clearToasts } from '../../../shared/toast/toast-store';
import type { AdminUser } from '../hooks/use-users';
import { createAdminRoutes } from '../routes';

const ADMIN = { id: 'a1', email: 'admin@casa.test', role: 'admin' };
const ELEVATED = { id: 'e1', email: 'elevada@casa.test', role: 'elevated' };

const ana: AdminUser = {
  id: 'u1',
  email: 'ana@casa.test',
  role: 'user',
  is_active: true,
  totp_enabled: true,
  created_at: '2026-10-01T12:00:00Z',
};
const bia: AdminUser = { ...ana, id: 'u2', email: 'bia@casa.test', is_active: false };
const caio: AdminUser = { ...ana, id: 'u3', email: 'caio@casa.test', role: 'elevated' };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': status >= 400 ? 'application/problem+json' : 'application/json' },
  });
}

interface Setup {
  viewer?: { id: string; email: string; role: string };
  users?: AdminUser[] | 'loading' | 'error';
}

let fetcher: Mock<(input: string, init?: RequestInit) => Promise<Response>>;

function stub({ viewer = ADMIN, users = [ana, bia, caio] }: Setup = {}) {
  fetcher = vi.fn((input, init) => {
    const url = new URL(input, 'http://x');
    if (url.pathname === '/api/v1/me') return Promise.resolve(json(viewer));
    if (url.pathname === '/api/v1/admin/users') {
      if (users === 'loading') return new Promise<Response>(() => undefined);
      if (users === 'error') return Promise.resolve(json({ code: 'boom', title: 'x' }, 500));
      return Promise.resolve(json({ items: users, next_cursor: null }));
    }
    if (init?.method === 'PATCH') return Promise.resolve(json({ ...ana }));
    return Promise.resolve(json({}));
  });
  vi.stubGlobal('fetch', fetcher);
}

function renderUsers(route = '/admin/users') {
  return renderWithProviders(null, { route, routes: createAdminRoutes(rootRoute) });
}

function patches() {
  return fetcher.mock.calls
    .filter((call) => call[1]?.method === 'PATCH')
    .map((call) => ({
      url: call[0],
      body: JSON.parse((call[1] as { body: string }).body) as Record<string, unknown>,
    }));
}

function usersCalls() {
  return fetcher.mock.calls
    .map((call) => new URL(call[0], 'http://x'))
    .filter((url) => url.pathname === '/api/v1/admin/users');
}

beforeEach(() => {
  stub();
});

afterEach(() => {
  vi.unstubAllGlobals();
  clearToasts();
});

function expectViewIcons(group: HTMLElement, names: string[]): void {
  const buttons = within(group).getAllByRole('button');
  expect(buttons.map((b) => b.getAttribute('aria-label'))).toEqual(names);
  for (const [i, button] of buttons.entries()) {
    expect(button).toHaveAttribute('title', names[i]);
    expect(button).toHaveAccessibleName(names[i] ?? '');
    expect(button.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(button.textContent).toBe('');
  }
}

describe('UsersScreen', () => {
  it('filters and searches users through the url', async () => {
    const { router } = renderUsers('/admin/users?role=elevated&q=caio');
    expect(await screen.findByText('caio@casa.test')).toBeInTheDocument();
    const first = usersCalls()[0];
    expect(first?.searchParams.get('role')).toBe('elevated');
    expect(first?.searchParams.get('q')).toBe('caio');
    expect(screen.getByRole('searchbox', { name: 'Busca' })).toHaveValue('caio');

    const search = screen.getByRole('searchbox', { name: 'Busca' });
    await userEvent.clear(search);
    await userEvent.type(search, 'bia');
    await waitFor(() => {
      expect(router.state.location.search).toMatchObject({ q: 'bia' });
    });
    expect(screen.getByRole('group', { name: 'Filtros' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Visualização' })).toBeInTheDocument();
  });

  it('picks the role filter in the custom select by keyboard', async () => {
    const { router, container } = renderUsers();
    await screen.findByText('ana@casa.test');
    const trigger = screen.getByRole('button', { name: /Papel/ });
    trigger.focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{Enter}');
    await waitFor(() => {
      expect(router.state.location.search).toMatchObject({ role: 'elevated' });
    });
    expect(container.querySelector('select')).toBeNull();
    expect(document.querySelector('select')).toBeNull();
  });

  it('uses the shared view icons with title and accessible name', async () => {
    renderUsers();
    await screen.findByText('ana@casa.test');
    expectViewIcons(screen.getByRole('group', { name: 'Visualização' }), ['Lista', 'Tabela']);
  });

  it('switches between list and table', async () => {
    const { router } = renderUsers();
    await screen.findByText('ana@casa.test');
    expect(screen.getByRole('list', { name: 'Contas' })).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Tabela' }));
    const table = await screen.findByRole('table');
    expect(within(table).getByRole('columnheader', { name: 'E-mail' })).toBeInTheDocument();
    expect(within(table).getAllByRole('row')).toHaveLength(4);
    expect(router.state.location.search).toMatchObject({ view: 'table' });
    await userEvent.click(screen.getByRole('button', { name: 'Lista' }));
    expect(await screen.findByRole('list', { name: 'Contas' })).toBeInTheDocument();
  });

  it('grants and revokes elevated for the admin', async () => {
    renderUsers();
    await screen.findByText('ana@casa.test');
    await userEvent.click(screen.getByRole('button', { name: /^Conceder elevado: ana@casa.test/ }));
    await waitFor(() => {
      expect(patches()).toContainEqual({
        url: '/api/v1/admin/users/u1',
        body: { role: 'elevated' },
      });
    });
    await userEvent.click(screen.getByRole('button', { name: /^Retirar elevado: caio@casa.test/ }));
    await waitFor(() => {
      expect(patches()).toContainEqual({ url: '/api/v1/admin/users/u3', body: { role: 'user' } });
    });
  });

  it('hides role actions from elevated', async () => {
    stub({ viewer: ELEVATED });
    renderUsers();
    await screen.findByText('ana@casa.test');
    expect(screen.queryByRole('button', { name: /elevado/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /redefinição/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Desativar: ana@casa.test/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Reativar: bia@casa.test/ })).toBeInTheDocument();
    // contas elevadas não são do alcance do elevado
    expect(screen.queryByRole('button', { name: /caio@casa.test/ })).not.toBeInTheDocument();
  });

  it('deactivates a user after confirmation', async () => {
    renderUsers();
    await screen.findByText('ana@casa.test');
    await userEvent.click(screen.getByRole('button', { name: /^Desativar: ana@casa.test/ }));
    const dialog = await screen.findByRole('alertdialog');
    expect(patches()).toHaveLength(0);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Desativar' }));
    await waitFor(() => {
      expect(patches()).toContainEqual({
        url: '/api/v1/admin/users/u1',
        body: { is_active: false },
      });
    });
  });

  it('does not deactivate when the confirmation is cancelled', async () => {
    renderUsers();
    await screen.findByText('ana@casa.test');
    await userEvent.click(screen.getByRole('button', { name: /^Desativar: ana@casa.test/ }));
    const dialog = await screen.findByRole('alertdialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    expect(patches()).toHaveLength(0);
  });

  it('goes to the password reset screen from the row', async () => {
    const { router } = renderUsers();
    await screen.findByText('ana@casa.test');
    await userEvent.click(
      screen.getByRole('button', { name: /^Gerar link de redefinição: ana@casa.test/ }),
    );
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/admin/users/u1/password-reset');
    });
  });

  it('marks a deactivated account with text, not with red', async () => {
    renderUsers();
    const row = (await screen.findByText('bia@casa.test')).closest('li');
    expect(row).not.toBeNull();
    expect(within(row as HTMLElement).getByText('Desativada')).toBeInTheDocument();
  });

  it('shows empty, loading and error states', async () => {
    stub({ users: 'loading' });
    const first = renderUsers();
    expect(await screen.findByRole('status')).toHaveTextContent('Carregando as contas…');
    first.unmount();

    stub({ users: [] });
    const second = renderUsers();
    expect(
      await screen.findByText('Nenhuma conta encontrada com esses filtros.'),
    ).toBeInTheDocument();
    second.unmount();

    stub({ users: 'error' });
    renderUsers();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível carregar as contas',
    );
    stub();
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByText('ana@casa.test')).toBeInTheDocument();
  });

  it('reaches the row actions with the keyboard', async () => {
    renderUsers();
    await screen.findByText('ana@casa.test');
    const target = screen.getByRole('button', { name: /^Desativar: ana@casa.test/ });
    for (let step = 0; step < 40 && document.activeElement !== target; step += 1) {
      await userEvent.tab();
    }
    expect(target).toHaveFocus();
  });

  it('has no axe violations in list and table', async () => {
    const { container } = renderUsers();
    await screen.findByText('ana@casa.test');
    expect(await axe(container)).toHaveNoViolations();
    await userEvent.click(screen.getByRole('button', { name: 'Tabela' }));
    await screen.findByRole('table');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('sends a plain user away from the administration', async () => {
    stub({ viewer: { id: 'u9', email: 'x@y', role: 'user' } });
    const { router } = renderUsers();
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/');
    });
  });
});
