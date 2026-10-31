import { createRoute, type AnyRoute } from '@tanstack/react-router';
import { DashboardScreen } from './screens/dashboard-screen';

/** Rota `/` do Dashboard; a TASK-35 a registra no app. */
export function createDashboardRoutes(parent: AnyRoute) {
  return createRoute({
    getParentRoute: () => parent,
    path: '/',
    component: DashboardScreen,
    staticData: { title_key: 'dashboard.title', breadcrumb_key: 'dashboard.title' },
  });
}
