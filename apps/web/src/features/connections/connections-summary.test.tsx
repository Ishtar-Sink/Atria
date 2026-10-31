import type { Schemas } from '@atria/contracts';
import { createRoute } from '@tanstack/react-router';
import { screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { rootRoute } from '../../app/router';
import { renderWithProviders } from '../../shared/test/render';
import { ConnectionsSummary } from './connections-summary';

type Link = Schemas['LinkResponse'];

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function linkTo(
  index: number,
  type: string,
  id: string,
): Link & { linked_type: string; linked_id: string } {
  const at = `2026-10-${String(10 + index).padStart(2, '0')}T10:00:00Z`;
  return {
    id: `l-${String(index)}`,
    owner_id: 'u-1',
    source_type: 'project',
    source_id: 'p-1',
    target_type: type,
    target_id: id,
    linked_type: type,
    linked_id: id,
    visibility: 'personal',
    created_at: at,
    updated_at: at,
  };
}

function stubServer(mode: 'ok' | 'loading', links: Link[]) {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: string | URL | Request) => {
      const url = new URL(input instanceof Request ? input.url : input, 'http://localhost');
      if (url.pathname === '/api/v1/me')
        return Promise.resolve(json({ id: 'u-1', email: 'a@b.c' }));
      if (mode === 'loading') return new Promise<Response>(() => undefined);
      if (url.pathname === '/api/v1/links')
        return Promise.resolve(json({ items: links, next_cursor: null }));
      const id = url.pathname.split('/').pop();
      return Promise.resolve(json({ id, title: `Título ${id ?? ''}`, name: `Título ${id ?? ''}` }));
    }),
  );
}

function renderSummary(limit?: number) {
  const route = createRoute({
    getParentRoute: () => rootRoute,
    path: '/projects/$projectId',
    component: () => (
      <ConnectionsSummary entity_type="project" entity_id="p-1" {...(limit ? { limit } : {})} />
    ),
    staticData: { title_key: 'common.brand', breadcrumb_key: 'common.brand' },
  });
  return renderWithProviders(null, { routes: [route], route: '/projects/p-1' });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('connections summary', () => {
  it('pd42 lists the linked entities with title and type label up to the limit', async () => {
    stubServer('ok', [
      linkTo(1, 'note', 'n-1'),
      linkTo(2, 'task', 't-1'),
      linkTo(3, 'goal', 'g-1'),
    ]);
    renderSummary(2);
    // Das mais recentes para as mais antigas, até o limite.
    expect(await screen.findByText('Título g-1')).toBeInTheDocument();
    expect(screen.getByText('Título t-1')).toBeInTheDocument();
    expect(screen.queryByText('Título n-1')).not.toBeInTheDocument();
    expect(screen.getByText('Meta')).toBeInTheDocument();
    expect(screen.getByText('Tarefa')).toBeInTheDocument();
    const more = screen.getByRole('link', { name: 'Ver todas' });
    expect(more).toHaveAttribute('href', expect.stringContaining('tab=connections'));
  });

  it('pd42 links each item to the entity screen', async () => {
    stubServer('ok', [linkTo(1, 'note', 'n-1'), linkTo(2, 'task', 't-1')]);
    renderSummary();
    expect(await screen.findByRole('link', { name: 'Título n-1' })).toHaveAttribute(
      'href',
      '/notes/n-1',
    );
    expect(screen.getByRole('link', { name: 'Título t-1' })).toHaveAttribute('href', '/tasks/t-1');
    expect(screen.queryByRole('link', { name: 'Ver todas' })).not.toBeInTheDocument();
  });

  it('pd42 shows the empty text and the connect link to the connections tab', async () => {
    stubServer('ok', []);
    renderSummary();
    expect(await screen.findByText('Nenhuma ligação ainda.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Conectar a algo' })).toHaveAttribute(
      'href',
      expect.stringContaining('tab=connections'),
    );
  });

  it('shows the loading state', async () => {
    stubServer('loading', []);
    renderSummary();
    expect(await screen.findByRole('status')).toHaveAttribute('aria-busy', 'true');
  });

  it('has no axe violations', async () => {
    stubServer('ok', [linkTo(1, 'note', 'n-1'), linkTo(2, 'task', 't-1')]);
    const { container } = renderSummary();
    await screen.findByRole('link', { name: 'Título n-1' });
    expect(await axe(container)).toHaveNoViolations();
  });
});
