import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { account, transaction } from '../features/finance/test-utils';
import { articleOf, bookOf, videoOf } from '../features/library/library-test-server';
import { defaultLanes, projectOf } from '../features/projects/test-server';
import { renderWithProviders } from '../shared/test/render';
import { ENTITY_ROUTES } from './entity-types';
import { featureRoutes } from './feature-registry';
import { rootRoute } from './router';

const STAMP = { created_at: '2026-11-01T10:00:00Z', updated_at: '2026-11-02T10:00:00Z' };
const OWNER = { owner_id: 'u1', visibility: 'personal' };

/** Uma entidade de cada tela de detalhe, pela rota `GET` por id. */
const DETAILS: Record<string, unknown> = {
  '/me': { id: 'u1', email: 'ana@atria.test', role: 'user' },
  '/accounts/a1': account({ id: 'a1', name: 'Conta corrente' }),
  '/transactions/t1': transaction({ id: 't1' }),
  '/goals/g1': {
    id: 'g1',
    title: 'Ler doze livros',
    description: null,
    deadline: null,
    status: 'in_progress',
    labels: [],
    milestone_count: 0,
    completed_milestone_count: 0,
    progress_percent: 0,
    ...OWNER,
    ...STAMP,
  },
  '/tasks/k1': {
    id: 'k1',
    title: 'Pagar a luz',
    is_recurring: false,
    labels: [],
    ...OWNER,
    ...STAMP,
  },
  '/reminders/r1': {
    id: 'r1',
    title: 'Ligar para a clínica',
    kind: 'one_off',
    timezone: 'America/Sao_Paulo',
    ...OWNER,
    ...STAMP,
  },
  '/notes/n1': { id: 'n1', title: 'Ideias de viagem', body: 'Lisboa.', ...OWNER, ...STAMP },
  '/journal-entries/j1': {
    id: 'j1',
    text: 'Dia leve.',
    occurred_at: '2026-11-04T23:30:00Z',
    emotions: [],
    ...OWNER,
    ...STAMP,
  },
  '/books/b1': bookOf({ id: 'b1' }),
  '/articles/ar1': articleOf({ id: 'ar1' }),
  '/videos/v1': videoOf({ id: 'v1' }),
  '/projects/p1': projectOf({ id: 'p1' }),
  '/projects/p1/lanes': { items: defaultLanes('p1') },
  '/projects/p1/summary': {
    progress: { done_cards: 0, total_cards: 0 },
    lanes: [],
    upcoming_due: [],
    in_progress: [],
  },
};

type LinksMode = 'ok' | 'loading' | 'error';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function stubApi(links: LinksMode = 'ok') {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: string) => {
      const path = new URL(input, 'http://localhost').pathname.replace('/api/v1', '');
      if (path === '/links') {
        if (links === 'loading') return new Promise<Response>(() => undefined);
        if (links === 'error') return Promise.resolve(json({ code: 'internal', title: 'x' }, 500));
      }
      const body = DETAILS[path];
      return Promise.resolve(json(body ?? { items: [], next_cursor: null }));
    }),
  );
}

function open(route: string, links: LinksMode = 'ok') {
  stubApi(links);
  return renderWithProviders(null, { routes: featureRoutes(rootRoute), route });
}

async function tabsOf(name: RegExp): Promise<string[]> {
  const list = await screen.findByRole('tablist', { name });
  return within(list)
    .getAllByRole('tab')
    .map((tab) => tab.textContent);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('EntityLayout', () => {
  it('renders the Visão geral tab by default', async () => {
    open('/finance/accounts/a1');
    const tab = await screen.findByRole('tab', { name: 'Visão geral' });
    expect(tab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Conexões' })).toHaveAttribute('aria-selected', 'false');
  });

  it('opens connections tab from tab=connections in the URL', async () => {
    open('/finance/accounts/a1?tab=connections');
    expect(await screen.findByRole('tab', { name: 'Conexões' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(await screen.findByRole('tabpanel')).toBeInTheDocument();
  });

  it('passes connections and highlights as extra_tabs to book and article pages', async () => {
    open('/library/books/b1');
    const book = await tabsOf(/livro/i);
    expect(book.slice(-2)).toEqual(['Destaques', 'Conexões']);
    open('/library/articles/ar1');
    const article = await tabsOf(/artigo/i);
    expect(article.slice(-2)).toEqual(['Destaques', 'Conexões']);
  });

  it('passes connections as extra_tabs to the screens with their own tabs', async () => {
    const routes = [
      '/finance/accounts/a1',
      '/finance/transactions/t1',
      '/goals/g1',
      '/tasks/k1',
      '/reminders/r1',
      '/notes/n1',
      '/journal/j1',
      '/library/videos/v1',
      '/projects/p1',
    ];
    for (const route of routes) {
      const view = open(route);
      expect(await screen.findByRole('tab', { name: 'Conexões' }), route).toBeInTheDocument();
      expect(screen.getAllByRole('tablist'), route).toHaveLength(1);
      view.unmount();
    }
  });

  it('passes connections before Configurações in the project and the summary in links_slot', async () => {
    open('/projects/p1');
    const tabs = await screen.findAllByRole('tab');
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      'Visão geral',
      'Quadro',
      'Conexões',
      'Configurações',
    ]);
    const links = await screen.findByRole('region', { name: 'Ligações' });
    expect(await within(links).findByText('Nenhuma ligação ainda.')).toBeInTheDocument();
  });

  it('does not render a page header of its own', async () => {
    const { container } = open('/goals/g1?tab=connections');
    await screen.findByRole('tab', { name: 'Conexões' });
    expect(container.querySelectorAll('.page-heading, h1')).toHaveLength(1);
  });

  it('does not wrap the card form', () => {
    const card = ENTITY_ROUTES.find((entry) => entry.path === '/projects/$projectId/cards/$cardId');
    expect(card?.layout).toBe('none');
  });

  it('switches tab with arrow keys', async () => {
    const user = userEvent.setup();
    open('/finance/accounts/a1');
    const overview = await screen.findByRole('tab', { name: 'Visão geral' });
    overview.focus();
    await user.keyboard('{ArrowLeft}');
    expect(screen.getByRole('tab', { name: 'Conexões' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('tab', { name: 'Conexões' })).toHaveAttribute('aria-selected', 'true');
  });

  it('shows loading and error states', async () => {
    const loading = open('/goals/g1?tab=connections', 'loading');
    await screen.findByRole('tab', { name: 'Conexões' });
    expect(await within(screen.getByRole('tabpanel')).findByRole('status')).toBeInTheDocument();
    loading.unmount();
    open('/goals/g1?tab=connections', 'error');
    await screen.findByRole('tab', { name: 'Conexões' });
    expect(await within(screen.getByRole('tabpanel')).findByRole('alert')).toBeInTheDocument();
  });

  it('has no axe violations', async () => {
    const { container } = open('/finance/accounts/a1?tab=connections');
    await screen.findByRole('tab', { name: 'Conexões' });
    expect(await axe(container)).toHaveNoViolations();
  });

  it('dec006 renders no visibility control above the tabs', async () => {
    for (const route of ['/finance/accounts/a1', '/goals/g1', '/library/books/b1']) {
      const view = open(route);
      const list = await screen.findByRole('tablist');
      const before = [...view.container.querySelectorAll('[role="radiogroup"], button')].filter(
        (node) =>
          node.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING &&
          /visibilidade|compartilhad|pessoal/i.test(
            node.textContent + (node.getAttribute('aria-label') ?? ''),
          ),
      );
      expect(before, route).toEqual([]);
      view.unmount();
    }
  });
});
