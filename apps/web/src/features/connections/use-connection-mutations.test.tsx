import type { Schemas } from '@atria/contracts';
import { createRoute } from '@tanstack/react-router';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { rootRoute } from '../../app/router';
import { renderWithProviders } from '../../shared/test/render';
import { clearToasts, getToasts } from '../../shared/toast/toast-store';
import { ConnectionsTab } from './connections-tab';

type Link = Schemas['LinkResponse'];

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const LINK: Link = {
  id: 'l-1',
  owner_id: 'u-1',
  source_type: 'note',
  source_id: 'n-1',
  target_type: 'goal',
  target_id: 'g-1',
  visibility: 'personal',
  created_at: '2026-10-20T10:00:00Z',
  updated_at: '2026-10-20T10:00:00Z',
};

interface Control {
  release: (status: number) => void;
  deleted: boolean;
}

/** `DELETE /links/{id}` fica pendente até o teste liberar a resposta (recusa ou sucesso). */
function stubServer(): Control {
  const control: Control = { release: () => undefined, deleted: false };
  vi.stubGlobal(
    'fetch',
    vi.fn((input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(input instanceof Request ? input.url : input, 'http://localhost');
      if (url.pathname === '/api/v1/me')
        return Promise.resolve(json({ id: 'u-1', email: 'a@b.c' }));
      if (url.pathname === '/api/v1/links' && (init?.method ?? 'GET') === 'GET') {
        const items = control.deleted ? [] : [{ ...LINK, linked_type: 'note', linked_id: 'n-1' }];
        return Promise.resolve(json({ items, next_cursor: null }));
      }
      if (url.pathname === '/api/v1/links/l-1' && init?.method === 'DELETE') {
        return new Promise<Response>((resolve) => {
          control.release = (status) => {
            if (status === 204) control.deleted = true;
            resolve(
              status === 204
                ? new Response(null, { status })
                : json({ code: 'boom', title: 'x' }, status),
            );
          };
        });
      }
      if (url.pathname === '/api/v1/notes/n-1')
        return Promise.resolve(json({ id: 'n-1', title: 'Ideias de viagem' }));
      return Promise.resolve(json({ code: 'not_found', title: 'x' }, 404));
    }),
  );
  return control;
}

function renderTab() {
  const route = createRoute({
    getParentRoute: () => rootRoute,
    path: '/goals/$goalId',
    component: () => <ConnectionsTab entity_type="goal" entity_id="g-1" />,
    staticData: { title_key: 'common.brand', breadcrumb_key: 'common.brand' },
  });
  return renderWithProviders(null, { routes: [route], route: '/goals/g-1' });
}

async function confirmRemoval() {
  await userEvent.click(
    await screen.findByRole('button', { name: 'Remover ligação com Ideias de viagem' }),
  );
  const dialog = await screen.findByRole('alertdialog');
  expect(dialog).toHaveTextContent('some dos dois lados');
  await userEvent.click(screen.getByRole('button', { name: 'Remover ligação' }));
}

afterEach(() => {
  vi.unstubAllGlobals();
  clearToasts();
});

describe('connection mutations', () => {
  it('removes the connection before the server answers', async () => {
    const control = stubServer();
    renderTab();
    await confirmRemoval();
    // O servidor ainda não respondeu, e a ligação já saiu da lista.
    await waitFor(() => {
      expect(screen.queryByText('Ideias de viagem')).not.toBeInTheDocument();
    });
    control.release(204);
    expect(await screen.findByText('Nenhuma conexão')).toBeInTheDocument();
    expect(getToasts()).toHaveLength(0);
  });

  it('rolls back and shows the undo notice when the server rejects', async () => {
    const control = stubServer();
    renderTab();
    await confirmRemoval();
    await waitFor(() => {
      expect(screen.queryByText('Ideias de viagem')).not.toBeInTheDocument();
    });
    control.release(500);
    expect(await screen.findByText('Ideias de viagem')).toBeInTheDocument();
    await waitFor(() => {
      expect(getToasts().map((toast) => toast.message_key)).toContain('connections.undo_notice');
    });
  });
});
