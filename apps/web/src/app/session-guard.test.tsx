import { useQuery } from '@tanstack/react-query';
import { createMemoryHistory, createRoute, RouterProvider } from '@tanstack/react-router';
import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAuthRoutes } from '../features/auth/routes';
import { mockApi, problem, type MockHandler } from '../features/auth/test-server';
import { api } from '../shared/api/client';
import { createQueryClient } from '../shared/api/query-client';
import { renderWithProviders } from '../shared/test/render';
import { AppProviders } from './providers';
import { createAppRouter, rootRoute } from './router';

const USER = { id: 'u1', email: 'a@b.c' };
const AUTHENTICATED = 'tela autenticada';

function Probe() {
  useQuery({ queryKey: ['probe'], queryFn: () => api.get('/accounts') });
  return <p>{AUTHENTICATED}</p>;
}

const probe = createRoute({
  getParentRoute: () => rootRoute,
  path: '$',
  component: Probe,
  staticData: { title_key: 'common.brand', breadcrumb_key: 'common.brand' },
});

/** Monta o app como o `main.tsx`: rotas de auth reais e o roteador protegido. */
function renderGuarded(route: string, handlers: Record<string, MockHandler>) {
  const { calls } = mockApi(handlers);
  const query_client = createQueryClient();
  const router = createAppRouter([...createAuthRoutes(rootRoute, rootRoute), probe], {
    history: createMemoryHistory({ initialEntries: [route] }),
    guard_session: true,
  });
  render(
    <AppProviders query_client={query_client}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return { router, query_client, calls };
}

const NO_SESSION = { 'GET /me': problem(401, 'unauthenticated') };
const CONFIGURED = { 'GET /setup': { status: 200, body: { required: false } } };

function accountCalls(calls: { path: string }[]) {
  return calls.filter((call) => call.path === '/accounts');
}

afterEach(() => {
  sessionStorage.clear();
  vi.unstubAllGlobals();
});

describe('SessionGate', () => {
  it('sends to the setup wizard without a session on a new instance', async () => {
    const { router, calls } = renderGuarded('/finance', {
      ...NO_SESSION,
      'GET /setup': { status: 200, body: { required: true } },
    });
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/setup');
    });
    expect(screen.queryByText(AUTHENTICATED)).not.toBeInTheDocument();
    expect(accountCalls(calls)).toEqual([]);
  });

  it('sends to sign-in without a session on a configured instance', async () => {
    const { router, calls } = renderGuarded('/finance', { ...NO_SESSION, ...CONFIGURED });
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/sign-in');
    });
    expect(screen.queryByText(AUTHENTICATED)).not.toBeInTheDocument();
    expect(accountCalls(calls)).toEqual([]);
  });

  it('renders the authenticated screen with a session', async () => {
    renderGuarded('/finance', {
      'GET /me': { status: 200, body: USER },
      'GET /accounts': { status: 200, body: { items: [] } },
    });
    expect(await screen.findByText(AUTHENTICATED)).toBeInTheDocument();
  });

  it('returns to the previous address after signing in', async () => {
    const { router, query_client } = renderGuarded('/notes?q=a', { ...NO_SESSION, ...CONFIGURED });
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/sign-in');
    });
    await act(async () => {
      query_client.setQueryData(['me'], USER);
      await router.navigate({ to: '/' });
    });
    await waitFor(() => {
      expect(router.state.location.href).toBe('/notes?q=a');
    });
  });

  it('sends to sign-in when a call answers 401 during use', async () => {
    let me_calls = 0;
    const { router } = renderGuarded('/finance', {
      ...CONFIGURED,
      'GET /me': () => {
        me_calls += 1;
        return me_calls === 1 ? { status: 200, body: USER } : problem(401, 'unauthenticated');
      },
      'GET /accounts': problem(401, 'unauthenticated'),
    });
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/sign-in');
    });
  });

  it('keeps the bare routes out of the guard', async () => {
    const { router } = renderGuarded('/sign-in', { ...NO_SESSION, ...CONFIGURED });
    expect(await screen.findByRole('heading', { level: 1, name: 'Entrar' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/sign-in');
  });

  it('does not guard routers created without guard_session', async () => {
    mockApi({ ...NO_SESSION, ...CONFIGURED });
    renderWithProviders(<p>livre</p>);
    expect(await screen.findByText('livre')).toBeInTheDocument();
  });
});
