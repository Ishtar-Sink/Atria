import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { rootRoute } from '../../../app/router';
import { renderWithProviders } from '../../../shared/test/render';
import { createAdminRoutes } from '../routes';
import type { InstanceStatus } from '../hooks/use-instance-status';

const STATUS: InstanceStatus = {
  version: '0.4.2',
  database_bytes: 3 * 1024 * 1024,
  storage_bytes: 2 * 1024 * 1024 * 1024,
  healthy: true,
  invite_required: true,
  web_push_enabled: false,
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': status >= 400 ? 'application/problem+json' : 'application/json' },
  });
}

function stub(instance: 'loading' | 'error' | InstanceStatus = STATUS) {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: string) => {
      const url = new URL(input, 'http://x');
      if (url.pathname === '/api/v1/me') {
        return Promise.resolve(json({ id: 'e1', email: 'e@casa.test', role: 'elevated' }));
      }
      if (url.pathname === '/api/v1/admin/instance') {
        if (instance === 'loading') return new Promise<Response>(() => undefined);
        if (instance === 'error') return Promise.resolve(json({ code: 'boom', title: 'x' }, 500));
        return Promise.resolve(json(instance));
      }
      return Promise.resolve(json({}));
    }),
  );
}

function renderInstance() {
  return renderWithProviders(null, {
    route: '/admin/instance',
    routes: createAdminRoutes(rootRoute),
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('InstanceScreen', () => {
  it('shows version, used space and health', async () => {
    stub();
    const { container } = renderInstance();
    expect(await screen.findByText('0.4.2')).toBeInTheDocument();
    // 3 MB de banco + 2 GB de arquivos, no formato do locale
    expect(screen.getByText(/^2\s*GB$/)).toBeInTheDocument();
    expect(screen.getByText(/Banco de dados 3\s*MB/)).toBeInTheDocument();
    const health = screen.getByText('Saudável');
    expect(health.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('says in words when the instance is not healthy', async () => {
    stub({ ...STATUS, healthy: false });
    renderInstance();
    expect(await screen.findByText('Com problemas')).toBeInTheDocument();
  });

  it('shows the error state when the status fails', async () => {
    stub('error');
    renderInstance();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível carregar o estado da instância',
    );
    stub();
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByText('0.4.2')).toBeInTheDocument();
  });

  it('shows the loading state', async () => {
    stub('loading');
    renderInstance();
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Carregando o estado da instância…',
    );
  });

  it('keeps the section links reachable with the keyboard', async () => {
    stub();
    renderInstance();
    await screen.findByText('0.4.2');
    const link = screen.getByRole('link', { name: 'Usuários' });
    for (let step = 0; step < 40 && document.activeElement !== link; step += 1) {
      await userEvent.tab();
    }
    expect(link).toHaveFocus();
    expect(screen.getByRole('link', { name: 'Instância' })).toHaveAttribute('aria-current', 'page');
  });
});
