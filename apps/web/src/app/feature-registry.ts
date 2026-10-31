import type { AnyRoute } from '@tanstack/react-router';
import { adminNav } from '../features/admin/nav';
import { createAdminRoutes } from '../features/admin/routes';
import { createAuthRoutes } from '../features/auth/routes';
import { createConnectionsRoutes } from '../features/connections/routes';
import { dashboardNav } from '../features/dashboard/nav';
import { createDashboardRoutes } from '../features/dashboard/routes';
import { financeNav } from '../features/finance/nav';
import { createFinanceRoutes } from '../features/finance/routes';
import { goalsNav } from '../features/goals/nav';
import { createGoalsRoutes } from '../features/goals/routes';
import { journalNavItem } from '../features/journal/nav';
import { createJournalRoutes } from '../features/journal/routes';
import { libraryNavItem } from '../features/library/nav';
import { createLibraryRoutes } from '../features/library/routes';
import { notesNav } from '../features/notes/nav';
import { createNotesRoutes } from '../features/notes/routes';
import { projectsNavItem } from '../features/projects/nav';
import { createProjectsRoutes } from '../features/projects/routes';
import { createReaderRoutes } from '../features/reader/routes';
import { remindersNav } from '../features/reminders/nav';
import { createRemindersRoutes } from '../features/reminders/routes';
import { reportsNavItem } from '../features/reports/nav';
import { createReportsRoutes } from '../features/reports/routes';
import { createSettingsRoutes } from '../features/settings/routes';
import { tasksNav } from '../features/tasks/nav';
import { createTasksRoutes } from '../features/tasks/routes';
import type { NavItem } from '../shared/navigation/nav-item';
import { entityExtraTabs, projectLinksSlot } from './entity-layout';

/** A paleta não tem rota própria: é montada no layout (TASK-32). */
export const FEATURES = [
  'auth',
  'admin',
  'dashboard',
  'finance',
  'goals',
  'tasks',
  'reminders',
  'notes',
  'journal',
  'library',
  'reader',
  'projects',
  'connections',
  'command-palette',
  'settings',
  'reports',
] as const;

export type Feature = (typeof FEATURES)[number];

/** Item da sidebar; com `roles`, só aparece para quem tem um deles (admin). */
export type AppNavItem = NavItem & { roles?: readonly string[] };

/** Ordem da sidebar do protótipo, sem Configurações, que abre pelo menu do perfil (PD-23). */
const NAV_IN_ORDER: readonly AppNavItem[] = [
  dashboardNav,
  financeNav,
  goalsNav,
  tasksNav,
  remindersNav,
  notesNav,
  journalNavItem,
  libraryNavItem,
  projectsNavItem,
  reportsNavItem,
  adminNav,
];

export const NAV_ITEMS: AppNavItem[] = NAV_IN_ORDER.map((item, index) => ({
  ...item,
  order: index * 10,
}));

export interface FeatureRoutes {
  feature: Feature;
  routes: AnyRoute[];
}

/**
 * Registro único das 16 features (RF-20): as rotas ficam sob a raiz, que desenha o layout
 * autenticado; o modo leitura marca `layout: 'bare'` e abre sem sidebar nem topbar.
 */
export function registerFeatures(root_route: AnyRoute): FeatureRoutes[] {
  const extra = entityExtraTabs;
  return [
    { feature: 'auth', routes: createAuthRoutes(root_route, root_route) },
    { feature: 'admin', routes: createAdminRoutes(root_route) },
    { feature: 'dashboard', routes: [createDashboardRoutes(root_route)] },
    {
      feature: 'finance',
      routes: createFinanceRoutes(root_route, {
        account_extra_tabs: extra('/finance/accounts/$accountId'),
        transaction_extra_tabs: extra('/finance/transactions/$transactionId'),
      }),
    },
    {
      feature: 'goals',
      routes: createGoalsRoutes(root_route, { extra_tabs: extra('/goals/$goalId') }),
    },
    {
      feature: 'tasks',
      routes: createTasksRoutes(root_route, { extra_tabs: extra('/tasks/$taskId') }),
    },
    {
      feature: 'reminders',
      routes: createRemindersRoutes(root_route, { extra_tabs: extra('/reminders/$reminderId') }),
    },
    {
      feature: 'notes',
      routes: createNotesRoutes(root_route, { extra_tabs: extra('/notes/$noteId') }),
    },
    {
      feature: 'journal',
      routes: createJournalRoutes(root_route, { extra_tabs: extra('/journal/$entryId') }),
    },
    {
      feature: 'library',
      routes: createLibraryRoutes(root_route, {
        book_extra_tabs: extra('/library/books/$bookId'),
        article_extra_tabs: extra('/library/articles/$articleId'),
        video_extra_tabs: extra('/library/videos/$videoId'),
      }),
    },
    { feature: 'reader', routes: createReaderRoutes(root_route) },
    {
      feature: 'projects',
      routes: createProjectsRoutes(root_route, {
        extra_tabs: extra('/projects/$projectId'),
        links_slot: projectLinksSlot,
      }),
    },
    { feature: 'connections', routes: createConnectionsRoutes(root_route) },
    { feature: 'command-palette', routes: [] },
    { feature: 'settings', routes: createSettingsRoutes(root_route) },
    { feature: 'reports', routes: createReportsRoutes(root_route) },
  ];
}

/** Rotas de todas as features, na ordem do registro. */
export function featureRoutes(root_route: AnyRoute): AnyRoute[] {
  return registerFeatures(root_route).flatMap((entry) => entry.routes);
}
