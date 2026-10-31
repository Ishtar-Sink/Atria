import { createRoute, type AnyRoute } from '@tanstack/react-router';
import { ExportsPage } from './exports-page';
import { ReportPage } from './report-page';
import { ReportsListPage } from './reports-list-page';

/**
 * Rotas de Relatórios, para a TASK-35 registrar. A página de um relatório lê o período, os
 * filtros, `from_module` e `run` da URL pelo `useReportSearch`, que descarta valor inválido.
 */
export function createReportsRoutes(parent_route: AnyRoute): AnyRoute[] {
  const list = createRoute({
    getParentRoute: () => parent_route,
    path: '/reports',
    component: ReportsListPage,
    staticData: { title_key: 'reports.title', breadcrumb_key: 'reports.title' },
  });
  const exports_route = createRoute({
    getParentRoute: () => parent_route,
    path: '/reports/exports',
    component: ExportsPage,
    staticData: { title_key: 'reports.exports.title', breadcrumb_key: 'reports.exports.title' },
  });
  const report = createRoute({
    getParentRoute: () => parent_route,
    path: '/reports/$report',
    component: ReportPage,
    staticData: { title_key: 'reports.title', breadcrumb_key: 'reports.title' },
  });
  return [list, exports_route, report];
}
