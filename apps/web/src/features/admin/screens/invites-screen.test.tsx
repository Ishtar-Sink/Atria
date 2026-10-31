import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi, type Mock } from 'vitest';
import { axe } from 'vitest-axe';
import { rootRoute } from '../../../app/router';
import { renderWithProviders } from '../../../shared/test/render';
import { clearToasts, getToasts } from '../../../shared/toast/toast-store';
import { createAdminRoutes } from '../routes';

const ADMIN = { id: 'a1', email: 'admin@casa.test', role: 'admin' };
const ELEVATED = { id: 'e1', email: 'elevada@casa.test', role: 'elevated' };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': status >= 400 ? 'application/problem+json' : 'application/json' },
  });
}

interface Setup {
  viewer?: { id: string; email: string; role: string };
  settings?: 'loading' | 'error' | 'ok';
  patch_status?: number;
}

let fetcher: Mock<(input: string, init?: RequestInit) => Promise<Response>>;

function stub({ viewer = ADMIN, settings = 'ok', patch_status = 200 }: Setup = {}) {
  fetcher = vi.fn((input, init) => {
    const url = new URL(input, 'http://x');
    if (url.pathname === '/api/v1/me') return Promise.resolve(json(viewer));
    if (url.pathname === '/api/v1/admin/instance/settings') {
      if (init?.method === 'PATCH') {
        return Promise.resolve(
          patch_status === 200
            ? json({ invite_required: false, web_push_enabled: false })
            : json({ code: 'forbidden', title: 'x' }, patch_status),
        );
      }
      if (settings === 'loading') return new Promise<Response>(() => undefined);
      if (settings === 'error') return Promise.resolve(json({ code: 'boom', title: 'x' }, 500));
      return Promise.resolve(json({ invite_required: true, web_push_enabled: false }));
    }
    return Promise.resolve(json({}));
  });
  vi.stubGlobal('fetch', fetcher);
}

function renderInvites() {
  return renderWithProviders(null, {
    route: '/admin/invites',
    routes: createAdminRoutes(rootRoute),
  });
}

function settingsPatches() {
  return fetcher.mock.calls.filter((call) => call[1]?.method === 'PATCH');
}

afterEach(() => {
  vi.unstubAllGlobals();
  clearToasts();
});

describe('InvitesScreen', () => {
  it('explains the invite and leads to the generation screen', async () => {
    stub();
    const { router } = renderInvites();
    expect(await screen.findByRole('heading', { level: 1, name: 'Convites' })).toBeInTheDocument();
    expect(screen.getByText(/uso único, com validade/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Gerar convite' }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/admin/invites/new');
    });
  });

  it('admin turns off the invite requirement', async () => {
    stub();
    renderInvites();
    const toggle = await screen.findByRole('switch', { name: 'Exigir convite para cadastro' });
    await waitFor(() => {
      expect(toggle).toBeChecked();
    });
    await userEvent.click(toggle);
    await waitFor(() => {
      expect(settingsPatches()).toHaveLength(1);
    });
    expect(JSON.parse((settingsPatches()[0]?.[1] as { body: string }).body)).toEqual({
      invite_required: false,
    });
  });

  it('puts the switch back and warns when the server refuses', async () => {
    stub({ patch_status: 403 });
    renderInvites();
    const toggle = await screen.findByRole('switch', { name: 'Exigir convite para cadastro' });
    await waitFor(() => {
      expect(toggle).toBeChecked();
    });
    await userEvent.click(toggle);
    await waitFor(() => {
      expect(getToasts()).toHaveLength(1);
    });
    await waitFor(() => {
      expect(toggle).toBeChecked();
    });
  });

  it('elevated does not see the invite requirement', async () => {
    stub({ viewer: ELEVATED });
    renderInvites();
    await screen.findByRole('button', { name: 'Gerar convite' });
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
    expect(fetcher.mock.calls.some((call) => call[0].includes('/admin/instance/settings'))).toBe(
      false,
    );
  });

  it('shows loading and error states for the setting', async () => {
    stub({ settings: 'loading' });
    const first = renderInvites();
    expect(await screen.findByRole('status')).toHaveTextContent('Carregando a configuração…');
    first.unmount();

    stub({ settings: 'error' });
    renderInvites();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível carregar a configuração',
    );
    stub();
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByRole('switch')).toBeInTheDocument();
  });

  it('reaches the switch with the keyboard and has no axe violations', async () => {
    stub();
    const { container } = renderInvites();
    const toggle = await screen.findByRole('switch');
    for (let step = 0; step < 40 && document.activeElement !== toggle; step += 1) {
      await userEvent.tab();
    }
    expect(toggle).toHaveFocus();
    expect(await axe(container)).toHaveNoViolations();
  });
});
