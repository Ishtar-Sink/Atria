import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  lazyRouteComponent,
  Outlet,
  useMatches,
  useNavigate,
  useRouter,
  useRouterState,
  type AnyRoute,
  type RouterHistory,
} from '@tanstack/react-router';
import { useEffect, type ComponentType, type ReactNode } from 'react';
import type { NavItem } from '../shared/navigation/nav-item';
import { rememberReturnTo, takeReturnTo, useSessionState } from '../shared/session/current-user';
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
  /** Rotas não `bare` só abrem com sessão (RF-01, RF-02). */
  guard_session: boolean;
}

/** Sem sessão, leva ao assistente ou ao login sem montar a tela nem chamar as APIs dela (CB-01). */
function SessionGate() {
  const state = useSessionState();
  const { href, pathname } = useRouterState({ select: (s) => s.location });
  const navigate = useNavigate();
  useEffect(() => {
    if (state === 'needs_setup' || state === 'needs_sign_in') {
      const target = state === 'needs_setup' ? '/setup' : '/sign-in';
      // O portão ainda vê o destino antes de desmontar; lembrá-lo apagaria o endereço de volta.
      if (pathname === target) return;
      rememberReturnTo(href);
      void navigate({ to: target, replace: true });
      return;
    }
    if (state !== 'authenticated') return;
    const back = takeReturnTo();
    if (back !== undefined && back !== href) void navigate({ href: back, replace: true });
  }, [state, href, pathname, navigate]);
  return state === 'authenticated' ? <AppLayout /> : null;
}

/** As rotas `bare` (login, assistente, cadastro) ficam fora da proteção, sem laço entre elas. */
function RootComponent() {
  const bare = useMatches().some((match) => match.staticData.layout === 'bare');
  const { guard_session } = useRouter().options.context;
  if (bare) return <Outlet />;
  return guard_session ? <SessionGate /> : <AppLayout />;
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
  options: {
    history?: RouterHistory;
    nav_items?: NavItem[];
    shell?: AppShell;
    guard_session?: boolean;
  } = {},
) {
  return createRouter({
    routeTree: rootRoute.addChildren([...routes, ...devRoutes()]),
    context: {
      nav_items: options.nav_items ?? [],
      ...(options.shell ? { shell: options.shell } : {}),
      // O app completo (`main.tsx`, com `shell`) protege as rotas; os testes das features e os
      // harness de evidência montam o roteador sem `shell` e continuam sem sessão.
      guard_session: options.guard_session ?? options.shell !== undefined,
    },
    ...(options.history ? { history: options.history } : {}),
  });
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
