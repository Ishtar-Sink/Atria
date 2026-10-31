import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { axe } from 'vitest-axe';
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

function stubApi(items: Highlight[]) {
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ items }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    ),
  );
}

function renderTab() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <HighlightsTab item_type="book" item_id="b-1" />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
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
});
