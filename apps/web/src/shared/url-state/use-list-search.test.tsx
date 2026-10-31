import { createRoute } from '@tanstack/react-router';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { rootRoute } from '../../app/router';
import { renderWithProviders } from '../test/render';
import { useListSearch } from './use-list-search';

const schema = z.object({
  q: z.string().default(''),
  view: z.enum(['list', 'grid']).default('list'),
});

function Page({ view_key }: { view_key?: string }) {
  const { search, setSearch } = useListSearch(schema, view_key ? { view_key } : undefined);
  return (
    <div>
      <p data-testid="state">{`${search.q}|${search.view}`}</p>
      <button
        type="button"
        onClick={() => {
          setSearch({ q: 'novo', view: 'grid' });
        }}
      >
        change
      </button>
    </div>
  );
}

function renderAt(route: string, view_key?: string) {
  const items = createRoute({
    getParentRoute: () => rootRoute,
    path: '/items',
    component: () => <Page {...(view_key ? { view_key } : {})} />,
    staticData: { title_key: 'common.brand', breadcrumb_key: 'common.brand' },
  });
  return renderWithProviders(null, { route, routes: [items] });
}

describe('useListSearch', () => {
  it('reads filters, search and view from the URL', async () => {
    renderAt('/items?q=abc&view=grid');
    expect(await screen.findByTestId('state')).toHaveTextContent('abc|grid');
  });

  it('writes changes back to the URL', async () => {
    const { router } = renderAt('/items');
    await userEvent.click(await screen.findByText('change'));
    await waitFor(() => {
      expect(router.state.location.search).toMatchObject({ q: 'novo', view: 'grid' });
    });
    expect(screen.getByTestId('state')).toHaveTextContent('novo|grid');
  });

  it('drops invalid values with the schema defaults', async () => {
    renderAt('/items?q=abc&view=table');
    expect(await screen.findByTestId('state')).toHaveTextContent('abc|list');
  });

  it('remembers the view per module and per tab', async () => {
    const first = renderAt('/items', 'finance:accounts');
    await userEvent.click(await screen.findByText('change'));
    await waitFor(() => {
      expect(localStorage.getItem('atria_view:finance:accounts')).toBe('grid');
    });
    first.unmount();
    renderAt('/items', 'finance:accounts');
    expect(await screen.findByTestId('state')).toHaveTextContent('|grid');
  });

  it('keeps the remembered view of another tab apart', async () => {
    localStorage.setItem('atria_view:finance:accounts', 'grid');
    renderAt('/items', 'finance:transactions');
    expect(await screen.findByTestId('state')).toHaveTextContent('|list');
  });

  it('prefers the view in the URL over the remembered one', async () => {
    localStorage.setItem('atria_view:finance', 'grid');
    renderAt('/items?view=list', 'finance');
    expect(await screen.findByTestId('state')).toHaveTextContent('|list');
  });
});
