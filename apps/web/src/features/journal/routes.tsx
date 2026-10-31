import { createRoute, useNavigate, type AnyRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { EmotionsPage } from './emotions-page';
import { JournalEntryFormPage } from './journal-entry-form-page';
import { JournalEntryPage, type ExtraTab } from './journal-entry-page';
import { JournalListPage } from './journal-list-page';
import { journalSearchSchema } from './use-journal-entries';

export interface JournalRoutesOptions {
  /** Abas de outras features no detalhe (Conexões), montadas pela TASK-35. */
  extra_tabs?: readonly ExtraTab[];
}

const detail_search = z.object({ tab: z.string().catch('overview') });

/**
 * As rotas do Diário, sem modal: criar e editar têm rota própria. A TASK-35 as registra em
 * `app/routes.ts`, passando a rota pai.
 */
export function createJournalRoutes(parent_route: AnyRoute, options: JournalRoutesOptions = {}) {
  const meta = (title_key: string) => ({ title_key, breadcrumb_key: title_key });

  const list = createRoute({
    getParentRoute: () => parent_route,
    path: '/journal',
    validateSearch: (raw: Record<string, unknown>) => journalSearchSchema.parse(raw),
    component: JournalListPage,
    staticData: meta('journal.nav'),
  });

  const create = createRoute({
    getParentRoute: () => parent_route,
    path: '/journal/new',
    component: () => <JournalEntryFormPage />,
    staticData: meta('journal.nav_new'),
  });

  const emotions = createRoute({
    getParentRoute: () => parent_route,
    path: '/journal/emotions',
    component: EmotionsPage,
    staticData: meta('journal.nav_emotions'),
  });

  const detail = createRoute({
    getParentRoute: () => parent_route,
    path: '/journal/$entryId',
    validateSearch: (raw: Record<string, unknown>) => detail_search.parse(raw),
    component: function JournalEntryRoute() {
      const { entryId } = detail.useParams() as unknown as { entryId: string };
      const { tab } = detail.useSearch() as unknown as z.output<typeof detail_search>;
      const navigate = useNavigate();
      return (
        <JournalEntryPage
          entry_id={entryId}
          tab={tab}
          on_tab_change={(next) => {
            void navigate({ to: '.', replace: true, search: { tab: next } });
          }}
          {...(options.extra_tabs ? { extra_tabs: options.extra_tabs } : {})}
        />
      );
    },
    staticData: meta('journal.nav_entry'),
  });

  const edit = createRoute({
    getParentRoute: () => parent_route,
    path: '/journal/$entryId/edit',
    component: function JournalEditRoute() {
      const { entryId } = edit.useParams() as unknown as { entryId: string };
      return <JournalEntryFormPage entry_id={entryId} />;
    },
    staticData: meta('journal.nav_edit'),
  });

  return [list, create, emotions, detail, edit];
}
