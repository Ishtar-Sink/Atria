import { createRoute, type AnyRoute } from '@tanstack/react-router';
import { GoalFormScreen } from './screens/goal-form-screen';
import { GoalScreen, type GoalExtraTab } from './screens/goal-screen';
import { GoalsScreen } from './screens/goals-screen';

export interface GoalsRoutesOptions {
  /** Abas da meta que outra feature acrescenta (Conexões, montadas na TASK-35). */
  extra_tabs?: readonly GoalExtraTab[];
}

/**
 * Rotas de Metas, para a TASK-35 registrar. A lista e a meta leem a busca da URL pelo
 * `useListSearch` (filtros, `view` e `tab`), que descarta valor inválido em vez de errar.
 */
export function createGoalsRoutes(parent: AnyRoute, options: GoalsRoutesOptions = {}): AnyRoute[] {
  const list = createRoute({
    getParentRoute: () => parent,
    path: '/goals',
    component: GoalsScreen,
    staticData: { title_key: 'goals.nav.title', breadcrumb_key: 'goals.nav.title' },
  });
  const create = createRoute({
    getParentRoute: () => parent,
    path: '/goals/new',
    component: GoalFormScreen,
    staticData: { title_key: 'goals.form.title_new', breadcrumb_key: 'goals.form.title_new' },
  });
  const detail = createRoute({
    getParentRoute: () => parent,
    path: '/goals/$goalId',
    component: () => (
      <GoalScreen {...(options.extra_tabs ? { extra_tabs: options.extra_tabs } : {})} />
    ),
    staticData: { title_key: 'goals.detail.crumb', breadcrumb_key: 'goals.detail.crumb' },
  });
  const edit = createRoute({
    getParentRoute: () => parent,
    path: '/goals/$goalId/edit',
    component: GoalFormScreen,
    staticData: { title_key: 'goals.form.title_edit', breadcrumb_key: 'goals.form.title_edit' },
  });
  return [list, create, detail, edit];
}
