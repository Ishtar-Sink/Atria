import type { Schemas } from '@atria/contracts';
import { createRoute } from '@tanstack/react-router';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { rootRoute } from '../../app/router';
import { renderWithProviders } from '../../shared/test/render';
import { clearToasts } from '../../shared/toast/toast-store';
import { ConnectionsTab } from './connections-tab';

type Link = Schemas['LinkResponse'];

const GOAL = 'g-1';
const NOTE = 'n-1';
const TASK = 't-1';
const BOOK = 'b-1';
const CARD = 'c-1';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function linkOf(id: string, source: [string, string], target: [string, string], at: string): Link {
  return {
    id,
    owner_id: 'u-1',
    source_type: source[0],
    source_id: source[1],
    target_type: target[0],
    target_id: target[1],
    visibility: 'personal',
    created_at: at,
    updated_at: at,
  };
}

const DETAILS: Record<string, unknown> = {
  [`/api/v1/goals/${GOAL}`]: { id: GOAL, title: 'Viajar para Lisboa' },
  [`/api/v1/notes/${NOTE}`]: { id: NOTE, title: 'Ideias de viagem' },
  [`/api/v1/tasks/${TASK}`]: { id: TASK, title: 'Comprar passagens' },
  [`/api/v1/books/${BOOK}`]: { id: BOOK, title: 'Guia de Portugal' },
  [`/api/v1/cards/${CARD}`]: { id: CARD, title: 'Roteiro', project_id: 'p-1' },
};

interface Server {
  links: Link[];
  mode: 'ok' | 'loading' | 'error';
  refuse_delete: boolean;
  calls: { method: string; url: URL }[];
}

/** API falsa em memória: ligações dos dois lados, títulos por id e as recusas que os testes provocam. */
function stubServer(initial: Partial<Server> = {}): Server {
  const server: Server = { links: [], mode: 'ok', refuse_delete: false, calls: [], ...initial };
  vi.stubGlobal(
    'fetch',
    vi.fn((input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(input instanceof Request ? input.url : input, 'http://localhost');
      const method = init?.method ?? 'GET';
      if (url.pathname === '/api/v1/me')
        return Promise.resolve(json({ id: 'u-1', email: 'a@b.c' }));
      if (url.pathname === '/api/v1/me/preferences')
        return Promise.resolve(json({ theme: 'system' }));
      server.calls.push({ method, url });
      if (url.pathname === '/api/v1/links') {
        if (server.mode === 'loading') return new Promise<Response>(() => undefined);
        if (server.mode === 'error')
          return Promise.resolve(json({ code: 'boom', title: 'x' }, 500));
        const type = url.searchParams.get('entity_type');
        const id = url.searchParams.get('entity_id');
        const wanted = url.searchParams.get('linked_type');
        const items = server.links.flatMap((link) => {
          const from_source = link.source_type === type && link.source_id === id;
          const from_target = link.target_type === type && link.target_id === id;
          if (!from_source && !from_target) return [];
          const linked_type = from_source ? link.target_type : link.source_type;
          if (wanted && wanted !== linked_type) return [];
          return [
            {
              ...link,
              linked_type,
              linked_id: from_source ? link.target_id : link.source_id,
            },
          ];
        });
        return Promise.resolve(json({ items, next_cursor: null }));
      }
      if (url.pathname.startsWith('/api/v1/links/') && method === 'DELETE') {
        if (server.refuse_delete) return Promise.resolve(json({ code: 'boom', title: 'x' }, 500));
        const removed = url.pathname.split('/').pop();
        server.links = server.links.filter((link) => link.id !== removed);
        return Promise.resolve(new Response(null, { status: 204 }));
      }
      const detail = DETAILS[url.pathname];
      if (detail) return Promise.resolve(json(detail));
      return Promise.resolve(json({ code: 'not_found', title: 'x' }, 404));
    }),
  );
  return server;
}

function renderTab(route = '/goals/g-1', entity: [string, string] = ['goal', GOAL]) {
  const screenRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/goals/$goalId',
    component: () => <ConnectionsTab entity_type={entity[0]} entity_id={entity[1]} />,
    staticData: { title_key: 'common.brand', breadcrumb_key: 'common.brand' },
  });
  return renderWithProviders(null, { routes: [screenRoute], route });
}

afterEach(() => {
  vi.unstubAllGlobals();
  clearToasts();
});

const BASE_LINKS = [
  linkOf('l-1', ['note', NOTE], ['goal', GOAL], '2026-10-20T10:00:00Z'),
  linkOf('l-2', ['goal', GOAL], ['task', TASK], '2026-09-12T10:00:00Z'),
  linkOf('l-3', ['book', BOOK], ['goal', GOAL], '2026-09-02T10:00:00Z'),
];

describe('connections tab', () => {
  it('lists the connections of any entity type and id', async () => {
    stubServer({ links: BASE_LINKS });
    renderTab();
    expect(await screen.findByText('Ideias de viagem')).toBeInTheDocument();
    expect(await screen.findByText('Comprar passagens')).toBeInTheDocument();
    expect(await screen.findByText('Guia de Portugal')).toBeInTheDocument();
  });

  it('exposes the Filtros, Busca and Visualização controls by accessible name', async () => {
    stubServer({ links: BASE_LINKS });
    renderTab();
    await screen.findByText('Ideias de viagem');
    expect(screen.getByRole('group', { name: 'Filtros' })).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: 'Busca' })).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: 'Agrupar por' })).toBeInTheDocument();
  });

  it('shows a connection created on the other side', async () => {
    // A ligação foi criada a partir da nota; a meta a mostra, e a nota mostra a meta.
    stubServer({ links: [BASE_LINKS[0] as Link] });
    const goal_side = renderTab();
    expect(await screen.findByText('Ideias de viagem')).toBeInTheDocument();
    goal_side.unmount();
    renderTab('/goals/n-1', ['note', NOTE]);
    expect(await screen.findByText('Viajar para Lisboa')).toBeInTheDocument();
  });

  it('uses linked_type and linked_id from the server for the other side', async () => {
    const server = stubServer({ links: [BASE_LINKS[0] as Link] });
    renderTab();
    await screen.findByText('Ideias de viagem');
    const read = server.calls.find((call) => call.url.pathname === '/api/v1/links');
    expect(read?.url.searchParams.get('entity_type')).toBe('goal');
    expect(read?.url.searchParams.get('entity_id')).toBe(GOAL);
    // Nenhuma leitura do lado de origem: só o outro lado (nota) é consultado por id.
    const detail_paths = server.calls
      .filter((call) => call.url.pathname !== '/api/v1/links')
      .map((call) => call.url.pathname);
    expect(detail_paths).toEqual([`/api/v1/notes/${NOTE}`]);
  });

  it('dec003 lists the task linked to a project card on the task side', async () => {
    stubServer({
      links: [linkOf('l-9', ['project_card', CARD], ['task', TASK], '2026-10-01T10:00:00Z')],
    });
    renderTab('/goals/t-1', ['task', TASK]);
    const link = await screen.findByRole('link', { name: 'Roteiro' });
    expect(link).toHaveAttribute('href', '/projects/p-1/cards/c-1');
  });

  it('filters by category', async () => {
    const server = stubServer({ links: BASE_LINKS });
    renderTab();
    await screen.findByText('Ideias de viagem');
    await userEvent.click(screen.getByRole('button', { name: /^Categoria/ }));
    await userEvent.click(screen.getByRole('option', { name: 'Tarefas' }));
    await waitFor(() => {
      expect(screen.queryByText('Ideias de viagem')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Comprar passagens')).toBeInTheDocument();
    // A categoria "Tarefas" tem um só tipo: o filtro é feito pelo servidor.
    await waitFor(() => {
      expect(server.calls.some((call) => call.url.searchParams.get('linked_type') === 'task')).toBe(
        true,
      );
    });
  });

  it('searches by title', async () => {
    stubServer({ links: BASE_LINKS });
    renderTab();
    await screen.findByText('Ideias de viagem');
    await userEvent.type(screen.getByRole('searchbox', { name: 'Busca' }), 'passagens');
    await waitFor(() => {
      expect(screen.queryByText('Ideias de viagem')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Comprar passagens')).toBeInTheDocument();
    await userEvent.clear(screen.getByRole('searchbox', { name: 'Busca' }));
    await userEvent.type(screen.getByRole('searchbox', { name: 'Busca' }), 'zzz');
    expect(await screen.findByText('Nenhuma conexão encontrada')).toBeInTheDocument();
  });

  it('groups with the segmented text field', async () => {
    stubServer({ links: BASE_LINKS });
    renderTab();
    await screen.findByText('Ideias de viagem');
    expect(screen.queryByRole('group', { name: 'Visualização' })).toBeNull();
    const grouping = screen.getByRole('radiogroup', { name: 'Agrupar por' });
    expect(
      within(grouping)
        .getAllByRole('radio')
        .map((r) => r.closest('label')?.textContent),
    ).toEqual(['Categoria', 'Data', 'Sem grupos']);
  });

  it('groups by category and by date', async () => {
    stubServer({ links: BASE_LINKS });
    renderTab();
    await screen.findByText('Ideias de viagem');
    const by_category = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(by_category).toEqual(['Acervo', 'Notas', 'Tarefas']);

    const views = screen.getByRole('radiogroup', { name: 'Agrupar por' });
    await userEvent.click(within(views).getByRole('radio', { name: 'Data' }));
    await waitFor(() => {
      const by_date = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
      expect(by_date).toEqual(['outubro de 2026', 'setembro de 2026']);
    });

    await userEvent.click(within(views).getByRole('radio', { name: 'Sem grupos' }));
    await waitFor(() => {
      expect(screen.queryAllByRole('heading', { level: 2 })).toHaveLength(0);
    });
    expect(screen.getAllByRole('button', { name: /^Remover ligação com/ })).toHaveLength(3);
  });

  it('labels each connection with its category', async () => {
    stubServer({ links: BASE_LINKS });
    renderTab();
    const row = (await screen.findByText('Comprar passagens')).closest('li');
    expect(row).not.toBeNull();
    expect(within(row as HTMLElement).getByText('Tarefas')).toBeInTheDocument();
    expect(within(row as HTMLElement).getByText('Tarefa')).toBeInTheDocument();
  });

  it('links each connection to the entity screen', async () => {
    stubServer({ links: BASE_LINKS });
    renderTab();
    expect(await screen.findByRole('link', { name: 'Ideias de viagem' })).toHaveAttribute(
      'href',
      '/notes/n-1',
    );
    expect(screen.getByRole('link', { name: 'Comprar passagens' })).toHaveAttribute(
      'href',
      '/tasks/t-1',
    );
    expect(screen.getByRole('link', { name: 'Guia de Portugal' })).toHaveAttribute(
      'href',
      '/library/books/b-1',
    );
    expect(screen.getByRole('link', { name: 'Conectar com' })).toHaveAttribute(
      'href',
      expect.stringContaining('/connections/new?'),
    );
  });

  it('keeps filter, search and grouping in the url', async () => {
    stubServer({ links: BASE_LINKS });
    const { router } = renderTab(
      '/goals/g-1?connections_category=notes&connections_q=viag&connections_group=date',
    );
    expect(await screen.findByText('Ideias de viagem')).toBeInTheDocument();
    expect(screen.queryByText('Comprar passagens')).not.toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: 'Busca' })).toHaveValue('viag');
    expect(
      within(screen.getByRole('radiogroup', { name: 'Agrupar por' })).getByRole('radio', {
        name: 'Data',
      }),
    ).toBeChecked();

    await userEvent.type(screen.getByRole('searchbox', { name: 'Busca' }), 'e');
    await waitFor(() => {
      expect(router.state.location.search).toMatchObject({
        connections_q: 'viage',
        connections_category: 'notes',
        connections_group: 'date',
      });
    });
  });

  it('shows the empty state with explanatory text', async () => {
    stubServer();
    renderTab();
    expect(await screen.findByText('Nenhuma conexão')).toBeInTheDocument();
    expect(screen.getByText(/ligar este item a qualquer outro/)).toBeInTheDocument();
  });

  it('shows the loading state', async () => {
    stubServer({ mode: 'loading' });
    renderTab();
    expect(await screen.findByRole('status')).toHaveAttribute('aria-busy', 'true');
  });

  it('shows the error state', async () => {
    stubServer({ mode: 'error' });
    renderTab();
    expect(await screen.findByRole('button', { name: 'Tentar de novo' })).toBeInTheDocument();
    expect(screen.getByText('Não foi possível carregar as conexões')).toBeInTheDocument();
  });

  it('has no axe violations', async () => {
    stubServer({ links: BASE_LINKS });
    const { container } = renderTab();
    await screen.findByText('Ideias de viagem');
    await screen.findByText('Guia de Portugal');
    expect(await axe(container)).toHaveNoViolations();
  });
});
