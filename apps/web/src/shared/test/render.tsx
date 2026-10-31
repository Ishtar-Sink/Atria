import { QueryClient } from '@tanstack/react-query';
import {
  createMemoryHistory,
  createRoute,
  RouterProvider,
  type AnyRoute,
} from '@tanstack/react-router';
import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { AppProviders } from '../../app/providers';
import { createAppRouter, rootRoute } from '../../app/router';
import type { NavItem } from '../navigation/nav-item';

export interface RenderOptions {
  route?: string;
  routes?: AnyRoute[];
  nav_items?: NavItem[];
}

/** Monta o app com roteador em memória, Query, i18n e tema, para os testes das features. */
export function renderWithProviders(ui: ReactNode, options: RenderOptions = {}) {
  const query_client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const routes = options.routes ?? [
    createRoute({
      getParentRoute: () => rootRoute,
      path: '$',
      component: () => ui,
      staticData: { title_key: 'common.brand', breadcrumb_key: 'common.brand' },
    }),
  ];
  const history = createMemoryHistory({ initialEntries: [options.route ?? '/'] });
  const router = createAppRouter(routes, { history, nav_items: options.nav_items ?? [] });

  const result = render(
    <AppProviders query_client={query_client}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return { ...result, router, query_client };
}
