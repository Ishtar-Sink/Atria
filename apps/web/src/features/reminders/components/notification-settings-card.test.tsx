import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { renderWithProviders } from '../../../shared/test/render';
import { NotificationSettingsCard } from './notification-settings-card';

type Role = 'user' | 'admin';

let calls: string[] = [];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function install(options: { role?: Role; web_push?: boolean } = {}) {
  const { role = 'user', web_push = true } = options;
  calls = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((input: string, init?: RequestInit) => {
      const path = new URL(input, 'http://localhost').pathname.replace('/api/v1', '');
      calls.push(path);
      if (path === '/me') {
        return Promise.resolve(json({ id: 'u1', email: 'ana@exemplo.com', role }));
      }
      if (path === '/web-push/public-key') {
        return Promise.resolve(
          web_push
            ? json({ public_key: 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9' })
            : json({ code: 'web_push_disabled', title: 'Web Push desligado' }, 404),
        );
      }
      if (init?.method === 'POST' && path === '/push-subscriptions') {
        return Promise.resolve(
          json({ id: 'sub-1', endpoint: 'https://push.example/1', created_at: '2026-11-05' }, 201),
        );
      }
      return Promise.resolve(json({ code: 'not_found', title: 'x' }, 404));
    }),
  );
}

function installBrowser(options: { push_support?: boolean } = {}) {
  vi.stubGlobal('Notification', {
    permission: 'granted',
    requestPermission: vi.fn(() => Promise.resolve('granted')),
  });
  if (options.push_support === false) return;
  const subscription = {
    endpoint: 'https://push.example/1',
    toJSON: () => ({ endpoint: 'https://push.example/1', keys: { p256dh: 'p', auth: 'a' } }),
    unsubscribe: vi.fn(() => Promise.resolve(true)),
  };
  const registration = {
    pushManager: {
      subscribe: vi.fn(() => Promise.resolve(subscription)),
      getSubscription: () => Promise.resolve(subscription),
    },
  };
  Object.defineProperty(navigator, 'serviceWorker', {
    value: {
      register: vi.fn(() => Promise.resolve(registration)),
      getRegistration: () => Promise.resolve(registration),
    },
    configurable: true,
  });
  vi.stubGlobal('PushManager', function PushManager() {});
}

const DISABLED = /está desligado nesta instância/;

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, 'serviceWorker');
});

describe('NotificationSettingsCard', () => {
  it('explains that web push is off in the instance for a regular person', async () => {
    install({ web_push: false });
    installBrowser();
    renderWithProviders(<NotificationSettingsCard />, { route: '/reminders' });

    expect(
      await screen.findByText(
        'O aviso com o Atria fechado está desligado nesta instância. Quem administra pode ligar em Configurações › Instância.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Abrir Configurações › Instância' })).toBeNull();
    expect(screen.queryByRole('switch')).toBeNull();
  });

  it('links the admin to the instance settings when web push is off', async () => {
    install({ web_push: false, role: 'admin' });
    installBrowser();
    renderWithProviders(<NotificationSettingsCard />, { route: '/reminders' });

    expect(
      await screen.findByText(
        'O aviso com o Atria fechado está desligado nesta instância. Ligue em Configurações › Instância.',
      ),
    ).toBeInTheDocument();
    const link = await screen.findByRole('link', { name: 'Abrir Configurações › Instância' });
    expect(link).toHaveAttribute('href', '/settings/instance');
  });

  it('says the browser does not offer web push', async () => {
    install({ role: 'admin' });
    installBrowser({ push_support: false });
    renderWithProviders(<NotificationSettingsCard />, { route: '/reminders' });

    expect(await screen.findByText(/Este navegador não oferece o aviso/)).toBeInTheDocument();
    await waitFor(() => {
      expect(calls).toContain('/me');
    });
    expect(screen.queryByRole('link', { name: 'Abrir Configurações › Instância' })).toBeNull();
    expect(calls).not.toContain('/web-push/public-key');
  });

  it('asks to turn the switch on when the device is not subscribed', async () => {
    install();
    installBrowser();
    const user = userEvent.setup();
    renderWithProviders(<NotificationSettingsCard />, { route: '/reminders' });

    const toggle = await screen.findByRole('switch', { name: 'Receber com o Atria fechado' });
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByText(/Este aparelho ainda não recebe/)).toBeInTheDocument();

    await user.click(toggle);

    await waitFor(() => {
      expect(toggle).toHaveAttribute('aria-checked', 'true');
    });
    expect(screen.queryByText(/Este aparelho ainda não recebe/)).toBeNull();
  });

  it('has no axe violations in every push state', async () => {
    const states: { name: string; role: Role; web_push: boolean; push_support: boolean }[] = [
      { name: 'off', role: 'user', web_push: false, push_support: true },
      { name: 'off-admin', role: 'admin', web_push: false, push_support: true },
      { name: 'unsupported', role: 'user', web_push: true, push_support: false },
      { name: 'not-subscribed', role: 'user', web_push: true, push_support: true },
    ];
    for (const state of states) {
      install(state);
      installBrowser(state);
      const { container, unmount } = renderWithProviders(<NotificationSettingsCard />, {
        route: '/reminders',
      });
      if (state.name === 'unsupported') await screen.findByText(/Este navegador não oferece/);
      else if (state.name === 'not-subscribed') await screen.findByRole('switch');
      else await screen.findByText(DISABLED);
      if (state.name === 'off-admin')
        await screen.findByRole('link', { name: 'Abrir Configurações › Instância' });
      expect(await axe(container)).toHaveNoViolations();
      unmount();
      vi.unstubAllGlobals();
      Reflect.deleteProperty(navigator, 'serviceWorker');
    }
  });
});
