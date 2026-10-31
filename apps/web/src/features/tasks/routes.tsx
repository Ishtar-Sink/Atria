import { createRoute, useNavigate, type AnyRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { rootRoute } from '../../app/router';
import { TaskFormScreen } from './screens/task-form-screen';
import { TaskScreen, type ExtraTab } from './screens/task-screen';
import { TasksScreen } from './screens/tasks-screen';
import { tasksSearchSchema } from './hooks/use-tasks';

export interface TasksRoutesOptions {
  /** Abas de outras features no detalhe (Conexões), montadas pela TASK-35. */
  extra_tabs?: readonly ExtraTab[];
}

const detail_search = z.object({ tab: z.string().catch('overview') });
const edit_search = z.object({ from: z.string().optional().catch(undefined) });

/** As quatro rotas de tarefas; a TASK-35 as registra em `app/routes.ts`. */
export function createTasksRoutes(parent: AnyRoute = rootRoute, options: TasksRoutesOptions = {}) {
  const meta = (title_key: string) => ({ title_key, breadcrumb_key: title_key });

  const list = createRoute({
    getParentRoute: () => parent,
    path: '/tasks',
    validateSearch: (raw: Record<string, unknown>) => tasksSearchSchema.parse(raw),
    component: TasksScreen,
    staticData: meta('tasks.nav.title'),
  });

  const create = createRoute({
    getParentRoute: () => parent,
    path: '/tasks/new',
    component: () => <TaskFormScreen />,
    staticData: meta('tasks.nav.new'),
  });

  const detail = createRoute({
    getParentRoute: () => parent,
    path: '/tasks/$taskId',
    validateSearch: (raw: Record<string, unknown>) => detail_search.parse(raw),
    component: function TaskDetailRoute() {
      const { taskId } = detail.useParams() as unknown as { taskId: string };
      const { tab } = detail.useSearch() as unknown as z.output<typeof detail_search>;
      const navigate = useNavigate();
      return (
        <TaskScreen
          task_id={taskId}
          tab={tab}
          on_tab_change={(next) => {
            void navigate({ to: '.', replace: true, search: { tab: next } });
          }}
          {...(options.extra_tabs ? { extra_tabs: options.extra_tabs } : {})}
        />
      );
    },
    staticData: meta('tasks.nav.detail'),
  });

  const edit = createRoute({
    getParentRoute: () => parent,
    path: '/tasks/$taskId/edit',
    validateSearch: (raw: Record<string, unknown>) => edit_search.parse(raw),
    component: function TaskEditRoute() {
      const { taskId } = edit.useParams() as unknown as { taskId: string };
      const { from } = edit.useSearch() as unknown as z.output<typeof edit_search>;
      return <TaskFormScreen task_id={taskId} from={from} />;
    },
    staticData: meta('tasks.nav.edit'),
  });

  return [list, create, detail, edit];
}
