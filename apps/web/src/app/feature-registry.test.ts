import { createMemoryHistory, type AnyRoute } from '@tanstack/react-router';
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { editPath, entityPath, QUICK_KINDS } from '../features/command-palette/palette-actions';
import {
  ENTITY_CATEGORIES,
  LINKABLE_TYPES,
  type LinkableType,
} from '../features/connections/entity-categories';
import { FINANCE_REPORTS } from '../features/finance/components/finance-shell';
import { accountReportHref } from '../features/finance/screens/account-detail-screen';
import { categoryReportHref } from '../features/finance/screens/category-detail-screen';
import { GOALS_REPORTS, goalReportHref, goalsReportHref } from '../features/goals/lib/goal-reports';
import { JOURNAL_REPORTS, journalReportHref } from '../features/journal/journal-reports';
import { projectReportHref } from '../features/projects/project-page';
import { FILTER_PARAM, REPORT_CATALOG } from '../features/reports/report-catalog';
import { TASKS_REPORTS, tasksReportHref } from '../features/tasks/lib/task-reports';
import { ENTITY_ROUTES } from './entity-types';
import { FEATURES, NAV_ITEMS, registerFeatures } from './feature-registry';
import { createAppRouter, rootRoute } from './router';

// Lido em tempo de execução, a partir de apps/web: o JSON fica na raiz, fora do build do frontend.
const lighthouse = JSON.parse(
  readFileSync(join(process.cwd(), '../../lighthouserc.json'), 'utf8'),
) as { ci: { collect: { url: string[] } } };

function registeredPaths(): string[] {
  const router = createAppRouter(
    registerFeatures(rootRoute).flatMap((entry) => entry.routes),
    { history: createMemoryHistory() },
  );
  return Object.keys(router.routesByPath).filter((path) => path !== '/dev/forms');
}

function patternOf(path: string): RegExp {
  const body = path.replace(/\$[A-Za-z]+/g, '[^/]+');
  return new RegExp(`^${body}/?$`);
}

function matches(url: string, paths: string[] = registeredPaths()): string | undefined {
  const pathname = new URL(url, 'http://localhost').pathname;
  const normal = pathname === '/' ? '/' : pathname.replace(/\/$/, '');
  const exact = paths.find((path) => path === normal);
  return (
    exact ?? paths.find((path) => (!path.includes('$') ? false : patternOf(path).test(normal)))
  );
}

/** Rotas com id que não são telas de entidade ligável, com o motivo. */
const NOT_ENTITY: Record<string, string> = {
  '/reset-password/$token': 'link de redefinição de senha',
  '/finance/recurring-transactions/$recurrenceId': 'recorrência não é tipo ligável',
  '/finance/categories/$categoryId': 'categoria não é tipo ligável',
  '/finance/transfers/$transferId': 'transferência sem tela de destino em ENTITY_CATEGORIES',
  '/reports/$report': 'relatório do catálogo',
};

describe('feature registry', () => {
  it('registers all sixteen features', () => {
    const registered = registerFeatures(rootRoute);
    expect(FEATURES).toHaveLength(16);
    expect(registered.map((entry) => entry.feature)).toEqual([...FEATURES]);
    for (const entry of registered) {
      if (entry.feature === 'command-palette') continue;
      expect(entry.routes.length, entry.feature).toBeGreaterThan(0);
    }
  });

  it('has no duplicated route path', () => {
    const all = registerFeatures(rootRoute)
      .flatMap((entry) => entry.routes)
      .flatMap((route: AnyRoute) => [route, ...((route.children as AnyRoute[] | undefined) ?? [])])
      .map((route) => (route.options as { path?: string }).path)
      .filter((path): path is string => typeof path === 'string');
    expect(new Set(all).size).toBe(all.length);
  });

  it('lists sidebar items in the order of the prototype', () => {
    expect(NAV_ITEMS.map((item) => item.id)).toEqual([
      'dashboard',
      'finance',
      'goals',
      'tasks',
      'reminders',
      'notes',
      'journal',
      'library',
      'projects',
      'reports',
      'admin',
    ]);
    const orders = NAV_ITEMS.map((item) => item.order);
    expect([...orders].sort((a, b) => a - b)).toEqual(orders);
    for (const item of NAV_ITEMS) expect(matches(item.to), item.to).toBeDefined();
  });

  it('maps every entity detail route to an entity type', () => {
    const mapped = new Set<string>(ENTITY_ROUTES.map((entry) => entry.path));
    const details = registeredPaths().filter(
      (path) => /\$[A-Za-z]+$/.test(path) && !path.endsWith('/read'),
    );
    for (const path of details) {
      if (path in NOT_ENTITY) continue;
      expect(mapped.has(path), path).toBe(true);
    }
    for (const path of mapped) expect(registeredPaths(), path).toContain(path);
  });

  it('covers every link entity type', () => {
    const with_route = new Set<LinkableType>(ENTITY_ROUTES.map((entry) => entry.entity_type));
    const without = LINKABLE_TYPES.filter((type) => !with_route.has(type));
    // Transferência e marco não têm tela própria: a leitura exige o id da entidade pai (TASK-31).
    expect(without).toEqual(['transfer', 'milestone']);
    for (const type of without) {
      expect(ENTITY_CATEGORIES[type].route('x', {}), type).toBeNull();
    }
  });

  it('registers reader outside the authenticated layout', () => {
    const reader = registerFeatures(rootRoute).find((entry) => entry.feature === 'reader');
    expect(reader?.routes).toHaveLength(2);
    for (const route of reader?.routes ?? []) {
      expect(route.options.staticData.layout).toBe('bare');
      expect((route.options as { getParentRoute: () => AnyRoute }).getParentRoute()).toBe(
        rootRoute,
      );
    }
  });

  it('registers every ENTITY_CATEGORIES route', () => {
    for (const type of LINKABLE_TYPES) {
      const url = ENTITY_CATEGORIES[type].route('id-1', { project_id: 'p-1' });
      if (url === null) continue;
      expect(matches(url), `${type}: ${url}`).toBeDefined();
    }
  });

  it('lighthouse urls are registered routes', () => {
    for (const url of lighthouse.ci.collect.url) {
      expect(matches(url), url).toBeDefined();
    }
  });

  it('registers every open-to-complete route', () => {
    for (const kind of QUICK_KINDS) {
      expect(matches(editPath(kind, 'id-1')), kind).toMatch(/\/edit$/);
    }
    for (const type of LINKABLE_TYPES) {
      expect(matches(entityPath(type, 'id-1')), type).toBeDefined();
    }
  });

  it('keeps settings out of the sidebar', () => {
    expect(NAV_ITEMS.some((item) => item.to.startsWith('/settings'))).toBe(false);
    expect(registeredPaths()).toContain('/settings');
  });

  it('registers the card form routes', () => {
    const paths = registeredPaths();
    expect(paths).toContain('/projects/$projectId/cards/new');
    expect(paths).toContain('/projects/$projectId/cards/$cardId');
    const card = ENTITY_CATEGORIES.project_card.route('c-1', { project_id: 'p-1' });
    expect(matches(card ?? '')).toBe('/projects/$projectId/cards/$cardId');
  });

  it('registers the new detail routes', () => {
    const paths = registeredPaths();
    expect(paths).toContain('/tasks/$taskId');
    expect(paths).toContain('/reminders/$reminderId');
  });

  it('registers every report of the catalog', () => {
    expect(REPORT_CATALOG.map((entry) => entry.id)).toEqual([
      'fin-flow',
      'fin-cat',
      'fin-diff',
      'read-pages',
      'lib-status',
      'journal-emo',
      'goals-progress',
      'tasks-done',
      'proj-cards',
    ]);
    const paths = registeredPaths();
    expect(paths).toContain('/reports');
    expect(paths).toContain('/reports/exports');
    for (const entry of REPORT_CATALOG) {
      expect(matches(`/reports/${entry.id}`), entry.id).toBe('/reports/$report');
    }
  });

  it('report links of modules and entities resolve to registered routes', () => {
    const sources = import.meta.glob<string>(['../features/**/*.tsx', '../features/**/*.ts'], {
      query: '?raw',
      import: 'default',
      eager: true,
    });
    const literals = Object.entries(sources)
      .filter(([file]) => !/\.(test|e2e)\.|\/evidence\//.test(file))
      .flatMap(([, text]) => [...text.matchAll(/['`](\/reports\/[a-z-]+\?[^'`]*)['`]/g)])
      .map((match) => (match[1] ?? '').replace(/\$\{[^}]+\}/g, 'x'));
    const links = [
      ...literals,
      ...GOALS_REPORTS.map((report) => goalsReportHref(report.id)),
      goalReportHref('g-1'),
      ...TASKS_REPORTS.map((report) => tasksReportHref(report.id)),
      ...JOURNAL_REPORTS.map((report) => journalReportHref(report.id)),
      ...FINANCE_REPORTS.map((report) => accountReportHref(report, 'a-1')),
      categoryReportHref('c-1'),
      projectReportHref('p-1'),
    ];
    expect(links.length).toBeGreaterThan(10);
    for (const link of links) {
      const url = new URL(link, 'http://localhost');
      const id = url.pathname.split('/')[2];
      const report = REPORT_CATALOG.find((entry) => entry.id === id);
      expect(report, link).toBeDefined();
      expect(matches(url.pathname), link).toBe('/reports/$report');
      const allowed = new Set<string>(['from_module', 'run', 'period']);
      for (const filter of report?.filters ?? []) {
        if (filter !== 'period') allowed.add(FILTER_PARAM[filter]);
      }
      for (const key of url.searchParams.keys())
        expect(allowed.has(key), `${link}: ${key}`).toBe(true);
    }
  });
});
