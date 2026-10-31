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
import type { NavItem } from '../shared/navigation/nav-item';
import { AppLayout } from './layout/app-layout';
import { NotFoundPage } from './layout/not-found-page';
import { navItems } from './nav';
import { featureRoutes } from './routes';

export interface RouterContext {
  nav_items: NavItem[];
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
  routes: AnyRoute[] = featureRoutes,
  options: { history?: RouterHistory; nav_items?: NavItem[] } = {},
) {
  return createRouter({
    routeTree: rootRoute.addChildren([...routes, ...devRoutes()]),
    context: { nav_items: options.nav_items ?? navItems },
    ...(options.history ? { history: options.history } : {}),
  });
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
