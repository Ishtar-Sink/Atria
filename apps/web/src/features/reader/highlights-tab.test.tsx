import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { clearToasts, getToasts } from '../../shared/toast/toast-store';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HighlightsTab } from './highlights-tab';
import type { Highlight } from './use-highlights';

function highlight(overrides: Partial<Highlight>): Highlight {
  return {
    id: 'h-1',
    owner_id: 'u-1',
    file_id: 'f-1',
    is_current_file: true,
    page: 3,
    color: 'accent',
    text: 'Primeiro trecho',
    rects: [{ x: 0.1, y: 0.1, width: 0.5, height: 0.02 }],
    created_at: '2026-10-30T10:00:00Z',
    ...overrides,
  };
}

interface FakeCall {
  method: string;
  path: string;
  body: Record<string, unknown>;
}

interface FakeApi {
  calls: FakeCall[];
  refuse: boolean;
}

/** `fetch` falso com a lista em memória: GET lista, PATCH troca a cor e DELETE tira o item. */
function stubApi(initial: Highlight[]): FakeApi {
  let items = initial;
  const api: FakeApi = { calls: [], refuse: false };
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      const path = new URL(
        input instanceof Request ? input.url : input.toString(),
        'http://localhost',
      ).pathname;
      const body =
        typeof init?.body === 'string' ? (JSON.parse(init.body) as Record<string, unknown>) : {};
      api.calls.push({ method, path, body });
      const json = (data: unknown, status = 200) =>
        Promise.resolve(
          new Response(JSON.stringify(data), {
            status,
            headers: { 'Content-Type': 'application/json' },
          }),
        );
      if (method === 'GET') return json({ items });
      if (api.refuse) return json({ code: 'boom', title: 'x' }, 500);
      const id = path.split('/').pop();
      if (method === 'PATCH') {
        items = items.map((item) => (item.id === id ? { ...item, ...body } : item));
        return json(items.find((item) => item.id === id));
      }
      items = items.filter((item) => item.id !== id);
      return Promise.resolve(new Response(null, { status: 204 }));
    }),
  );
  return api;
}

function renderTab(item_type: 'book' | 'article' = 'book') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <HighlightsTab item_type={item_type} item_id={item_type === 'book' ? 'b-1' : 'a-1'} />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  clearToasts();
});

describe('HighlightsTab', () => {
  it('lists highlights with their color and page', async () => {
    stubApi([
      highlight({}),
      highlight({ id: 'h-2', page: 9, color: 'warning', text: 'Segundo trecho' }),
    ]);
    renderTab();
    const items = await screen.findAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(within(items[0] as HTMLElement).getByText('ciano')).toBeInTheDocument();
    expect(within(items[0] as HTMLElement).getByText('Página 3')).toBeInTheDocument();
    expect(within(items[1] as HTMLElement).getByText('âmbar')).toBeInTheDocument();
    expect(within(items[1] as HTMLElement).getByText('Segundo trecho')).toBeInTheDocument();
  });

  it('marks highlights from another file', async () => {
    stubApi([highlight({}), highlight({ id: 'h-2', is_current_file: false })]);
    renderTab();
    await screen.findAllByRole('listitem');
    expect(screen.getAllByText('De outro arquivo')).toHaveLength(1);
  });

  it('shows the empty state', async () => {
    stubApi([]);
    renderTab();
    expect(await screen.findByText('Nenhum destaque ainda')).toBeInTheDocument();
  });

  it('has no axe violations', async () => {
    stubApi([highlight({}), highlight({ id: 'h-2', is_current_file: false })]);
    const { container } = renderTab();
    await screen.findAllByRole('listitem');
    expect(await axe(container)).toHaveNoViolations();
  });

  describe.each([
    { item_type: 'book', collection: 'books', id: 'b-1' },
    { item_type: 'article', collection: 'articles', id: 'a-1' },
  ] as const)('$item_type actions', ({ item_type, collection, id }) => {
    it(`rf32 changes the color of ${item_type === 'book' ? 'a book' : 'an article'} highlight`, async () => {
      const api = stubApi([highlight({})]);
      renderTab(item_type);
      const group = await screen.findByRole('group', { name: 'Cor do destaque da página 3' });
      await userEvent.click(within(group).getByRole('button', { name: 'Trocar para verde' }));
      expect(within(group).getByRole('button', { name: 'Trocar para verde' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      expect(screen.getByText('verde')).toBeInTheDocument();
      await waitFor(() => {
        expect(
          api.calls.find(
            (call) =>
              call.method === 'PATCH' && call.path === `/api/v1/${collection}/${id}/highlights/h-1`,
          )?.body,
        ).toEqual({ color: 'success' });
      });
    });

    it(`rf32 deletes ${item_type === 'book' ? 'a book' : 'an article'} highlight after confirmation`, async () => {
      const api = stubApi([highlight({})]);
      renderTab(item_type);
      await userEvent.click(
        await screen.findByRole('button', { name: 'Excluir o destaque da página 3' }),
      );
      const dialog = await screen.findByRole('alertdialog');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Excluir destaque' }));
      expect(await screen.findByText('Nenhum destaque ainda')).toBeInTheDocument();
      await waitFor(() => {
        expect(
          api.calls.some(
            (call) =>
              call.method === 'DELETE' &&
              call.path === `/api/v1/${collection}/${id}/highlights/h-1`,
          ),
        ).toBe(true);
      });
    });
  });

  it('rf32 rolls back the color and warns when the server refuses', async () => {
    const api = stubApi([highlight({})]);
    api.refuse = true;
    renderTab();
    await userEvent.click(await screen.findByRole('button', { name: 'Trocar para verde' }));
    await waitFor(() => {
      expect(getToasts().map((toast) => toast.message_key)).toContain(
        'reader.highlight_change_error',
      );
    });
    expect(screen.getByText('ciano')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Trocar para ciano' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('rf32 disables the actions of a highlight not saved yet', async () => {
    stubApi([highlight({ id: 'temp-1' })]);
    renderTab();
    expect(
      await screen.findByRole('button', { name: 'Excluir o destaque da página 3' }),
    ).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Trocar para verde' })).toBeDisabled();
  });

  it('rf32 has no axe violations with the actions', async () => {
    stubApi([highlight({}), highlight({ id: 'h-2', page: 9, color: 'warning' })]);
    const { container } = renderTab();
    await screen.findAllByRole('listitem');
    expect(await axe(container)).toHaveNoViolations();
  });
});
