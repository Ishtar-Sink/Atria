import { createRoute, lazyRouteComponent, type AnyRoute } from '@tanstack/react-router';

/**
 * Rotas do modo leitura. A TASK-35 as registra fora do layout autenticado (`layout: 'bare'`,
 * sem sidebar nem topbar). O componente vem sob demanda, para a biblioteca de PDF ficar num
 * chunk carregado só nestas rotas.
 */
export function createReaderRoutes(root_route: AnyRoute): AnyRoute[] {
  const staticData = {
    title_key: 'reader.region',
    breadcrumb_key: 'reader.region',
    layout: 'bare',
  } as const;
  const book = createRoute({
    getParentRoute: () => root_route,
    path: '/library/books/$bookId/read',
    component: lazyRouteComponent(() => import('./reader-page'), 'BookReaderPage'),
    staticData,
  });
  const article = createRoute({
    getParentRoute: () => root_route,
    path: '/library/articles/$articleId/read',
    component: lazyRouteComponent(() => import('./reader-page'), 'ArticleReaderPage'),
    staticData,
  });
  return [book, article];
}
