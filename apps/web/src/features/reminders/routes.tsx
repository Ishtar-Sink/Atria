import { createRoute, useNavigate, type AnyRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { rootRoute } from '../../app/router';
import { remindersSearchSchema } from './hooks/use-reminders';
import { ReminderFormScreen } from './screens/reminder-form-screen';
import { ReminderScreen, type ExtraTab } from './screens/reminder-screen';
import { RemindersScreen } from './screens/reminders-screen';

export interface RemindersRoutesOptions {
  /** Abas de outras features (Conexões) no detalhe, montadas pela TASK-35. */
  extra_tabs?: readonly ExtraTab[];
}

const detail_search = z.object({ tab: z.string().catch('overview') });

/** As quatro rotas de lembretes; a TASK-35 as registra em `app/routes.ts`. */
export function createRemindersRoutes(
  parent: AnyRoute = rootRoute,
  options: RemindersRoutesOptions = {},
) {
  const meta = (title_key: string) => ({ title_key, breadcrumb_key: title_key });

  const list = createRoute({
    getParentRoute: () => parent,
    path: '/reminders',
    validateSearch: (raw: Record<string, unknown>) => remindersSearchSchema.parse(raw),
    component: RemindersScreen,
    staticData: meta('reminders.nav.title'),
  });

  const create = createRoute({
    getParentRoute: () => parent,
    path: '/reminders/new',
    component: () => <ReminderFormScreen />,
    staticData: meta('reminders.nav.new'),
  });

  const detail = createRoute({
    getParentRoute: () => parent,
    path: '/reminders/$reminderId',
    validateSearch: (raw: Record<string, unknown>) => detail_search.parse(raw),
    component: function ReminderDetailRoute() {
      const { reminderId } = detail.useParams() as unknown as { reminderId: string };
      const { tab } = detail.useSearch() as unknown as z.output<typeof detail_search>;
      const navigate = useNavigate();
      return (
        <ReminderScreen
          reminder_id={reminderId}
          tab={tab}
          on_tab_change={(next) => {
            void navigate({ to: '.', replace: true, search: { tab: next } });
          }}
          {...(options.extra_tabs ? { extra_tabs: options.extra_tabs } : {})}
        />
      );
    },
    staticData: meta('reminders.nav.detail'),
  });

  const edit = createRoute({
    getParentRoute: () => parent,
    path: '/reminders/$reminderId/edit',
    component: function ReminderEditRoute() {
      const { reminderId } = edit.useParams() as unknown as { reminderId: string };
      return <ReminderFormScreen reminder_id={reminderId} />;
    },
    staticData: meta('reminders.nav.edit'),
  });

  return [list, create, detail, edit];
}
