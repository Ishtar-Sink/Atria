import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  lazyRouteComponent,
  Outlet,
  useMatches,
  type AnyRoute,
  type RouterHistory,
} from '@tanstack/react-router';
import type { ComponentType, ReactNode } from 'react';
import type { NavItem } from '../shared/navigation/nav-item';
import { AppLayout } from './layout/app-layout';
import { NotFoundPage } from './layout/not-found-page';

/** Serviços do app inteiro, montados uma vez no layout (paleta e aviso de lembretes, TASK-35). */
export interface AppShell {
  Services: ComponentType<{ children: ReactNode }>;
  SearchTrigger: ComponentType<{ className?: string }>;
}

export interface RouterContext {
  nav_items: NavItem[];
  /** Sem `shell`, o layout fica sem esses serviços, como no render isolado das features. */
  shell?: AppShell;
}

function RootComponent() {
  const bare = useMatches().some((match) => match.staticData.layout === 'bare');
  return bare ? <Outlet /> : <AppLayout />;
}

/** Raiz compartilhada: as rotas das features a usam como `getParentRoute`. */
export const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: RootComponent,
  notFoundComponent: NotFoundPage,
  staticData: { title_key: 'common.brand', breadcrumb_key: 'common.brand' },
});

function devRoutes(): AnyRoute[] {
  if (!import.meta.env.DEV) return [];
  return [
    createRoute({
      getParentRoute: () => rootRoute,
      path: '/dev/forms',
      component: lazyRouteComponent(() => import('./dev/forms-preview'), 'FormsPreview'),
      staticData: { title_key: 'common.brand', breadcrumb_key: 'common.brand' },
    }),
  ];
}

export function createAppRouter(
  routes: AnyRoute[],
  options: { history?: RouterHistory; nav_items?: NavItem[]; shell?: AppShell } = {},
) {
  return createRouter({
    routeTree: rootRoute.addChildren([...routes, ...devRoutes()]),
    context: {
      nav_items: options.nav_items ?? [],
      ...(options.shell ? { shell: options.shell } : {}),
    },
    ...(options.history ? { history: options.history } : {}),
  });
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
