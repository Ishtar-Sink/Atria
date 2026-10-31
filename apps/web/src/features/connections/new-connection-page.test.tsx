import type { Schemas } from '@atria/contracts';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { rootRoute } from '../../app/router';
import { renderWithProviders } from '../../shared/test/render';
import { clearToasts } from '../../shared/toast/toast-store';
import { createConnectionsRoutes } from './routes';

type Link = Schemas['LinkResponse'];

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const HITS = [
  { entity_type: 'goal', id: 'g-1', title: 'Viajar para Lisboa', snippet: null },
  { entity_type: 'note', id: 'n-1', title: 'Ideias de viagem', snippet: null },
  { entity_type: 'task', id: 't-1', title: 'Comprar viagem', snippet: null },
  { entity_type: 'note', id: 'n-2', title: 'Roteiro de viagem', snippet: null },
];

interface Server {
  links: Link[];
  posts: Record<string, unknown>[];
}

/** API falsa: busca global, ligações da meta de origem e a criação da ligação. */
function stubServer(links: Link[] = []): Server {
  const server: Server = { links, posts: [] };
  vi.stubGlobal(
    'fetch',
    vi.fn((input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(input instanceof Request ? input.url : input, 'http://localhost');
      const method = init?.method ?? 'GET';
      if (url.pathname === '/api/v1/me')
        return Promise.resolve(json({ id: 'u-1', email: 'a@b.c' }));
      if (url.pathname === '/api/v1/search') {
        const q = (url.searchParams.get('q') ?? '').toLowerCase();
        const items = HITS.filter((hit) => hit.title.toLowerCase().includes(q));
        return Promise.resolve(json({ groups: [{ context: 'all', items }] }));
      }
      if (url.pathname === '/api/v1/links' && method === 'GET') {
        const items = server.links.map((link) => ({
          ...link,
          linked_type: link.source_type === 'goal' ? link.target_type : link.source_type,
          linked_id: link.source_type === 'goal' ? link.target_id : link.source_id,
        }));
        return Promise.resolve(json({ items, next_cursor: null }));
      }
      if (url.pathname === '/api/v1/links' && method === 'POST') {
        const body = JSON.parse(init?.body as string) as Record<string, string>;
        server.posts.push(body);
        const created = {
          id: 'l-new',
          owner_id: 'u-1',
          visibility: 'personal',
          created_at: '2026-10-31T10:00:00Z',
          updated_at: '2026-10-31T10:00:00Z',
          ...body,
        } as Link;
        server.links.push(created);
        return Promise.resolve(json(created, 201));
      }
      if (url.pathname === '/api/v1/goals/g-1')
        return Promise.resolve(json({ id: 'g-1', title: 'Viajar para Lisboa' }));
      return Promise.resolve(json({ code: 'not_found', title: 'x' }, 404));
    }),
  );
  return server;
}

function renderPage() {
  return renderWithProviders(null, {
    routes: createConnectionsRoutes(rootRoute),
    route: '/connections/new?source_type=goal&source_id=g-1',
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  clearToasts();
});

const ALREADY: Link = {
  id: 'l-1',
  owner_id: 'u-1',
  source_type: 'goal',
  source_id: 'g-1',
  target_type: 'note',
  target_id: 'n-1',
  visibility: 'personal',
  created_at: '2026-10-20T10:00:00Z',
  updated_at: '2026-10-20T10:00:00Z',
};

describe('new connection page', () => {
  it('searches entities and links the chosen one', async () => {
    const server = stubServer();
    renderPage();
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Conectar com' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Digite para buscar em todas as categorias.')).toBeInTheDocument();
    await userEvent.type(
      await screen.findByRole('searchbox', { name: 'Buscar item para ligar' }),
      'viagem',
    );
    await userEvent.click(
      await screen.findByRole('button', { name: 'Conectar com Comprar viagem' }),
    );
    await waitFor(() => {
      expect(server.posts).toEqual([
        { source_type: 'goal', source_id: 'g-1', target_type: 'task', target_id: 't-1' },
      ]);
    });
  });

  it('does not offer the entity itself nor one already linked', async () => {
    stubServer([ALREADY]);
    renderPage();
    await userEvent.type(
      await screen.findByRole('searchbox', { name: 'Buscar item para ligar' }),
      'viag',
    );
    expect(
      await screen.findByRole('button', { name: 'Conectar com Comprar viagem' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Conectar com Roteiro de viagem' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Conectar com Viajar para Lisboa' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Conectar com Ideias de viagem' })).toBeNull();
  });

  it('returns to the entity screen after linking', async () => {
    stubServer();
    const { router } = renderPage();
    await userEvent.type(
      await screen.findByRole('searchbox', { name: 'Buscar item para ligar' }),
      'viagem',
    );
    await userEvent.click(
      await screen.findByRole('button', { name: 'Conectar com Comprar viagem' }),
    );
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/goals/g-1');
    });
    expect(router.state.location.search).toMatchObject({ tab: 'connections' });
  });

  it('is operable by keyboard only', async () => {
    const server = stubServer();
    renderPage();
    const search = await screen.findByRole('searchbox', { name: 'Buscar item para ligar' });
    await userEvent.type(search, 'viagem');
    await screen.findByRole('button', { name: 'Conectar com Comprar viagem' });

    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('button', { name: 'Conectar com Ideias de viagem' })).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('button', { name: 'Conectar com Comprar viagem' })).toHaveFocus();
    await userEvent.keyboard('{ArrowUp}{ArrowUp}');
    expect(search).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{Enter}');
    await waitFor(() => {
      expect(server.posts).toHaveLength(1);
    });
    expect(server.posts[0]).toMatchObject({ target_type: 'task', target_id: 't-1' });
  });
});
