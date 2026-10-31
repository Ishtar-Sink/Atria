import { createMemoryHistory } from '@tanstack/react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { z } from 'zod';
import { usersSearchSchema } from '../features/admin/hooks/use-users';
import { accountsSearchSchema } from '../features/finance/screens/accounts-screen';
import { transactionsSearchSchema } from '../features/finance/screens/transactions-screen';
import { transfersSearchSchema } from '../features/finance/screens/transfers-screen';
import { goalsSearchSchema } from '../features/goals/hooks/use-goals';
import { journalSearchSchema } from '../features/journal/use-journal-entries';
import { librarySearchSchema } from '../features/library/use-library-items';
import { notesSearchSchema } from '../features/notes/hooks/use-notes';
import { projectsSearchSchema } from '../features/projects/use-projects';
import { remindersSearchSchema } from '../features/reminders/hooks/use-reminders';
import { tasksSearchSchema } from '../features/tasks/hooks/use-tasks';
import { featureRoutes } from './feature-registry';
import { createAppRouter, rootRoute } from './router';

interface Listing {
  path: string;
  schema: z.ZodObject<z.ZodRawShape>;
  /** Busca, visualização fora do padrão e um filtro, todos válidos. */
  search: Record<string, string>;
}

/** Toda listagem do registro: as da sidebar e as internas (contas, artigos, vídeos, usuários). */
const LISTINGS: Listing[] = [
  { path: '/goals', schema: goalsSearchSchema, search: { q: 'ler', view: 'grid', label: 'casa' } },
  { path: '/tasks', schema: tasksSearchSchema, search: { q: 'luz', view: 'day', status: 'all' } },
  {
    path: '/reminders',
    schema: remindersSearchSchema,
    search: { q: 'clínica', view: 'day', kind: 'recurring' },
  },
  {
    path: '/notes',
    schema: notesSearchSchema,
    search: { q: 'viagem', view: 'grid', visibility: 'shared' },
  },
  {
    path: '/journal',
    schema: journalSearchSchema,
    search: { q: 'parque', view: 'timeline', period: 'this_year' },
  },
  {
    path: '/library',
    schema: librarySearchSchema,
    search: { q: 'sertão', view: 'list', tag: 'romance' },
  },
  {
    path: '/library',
    schema: librarySearchSchema,
    search: { tab: 'articles', q: 'rust', view: 'list', tag: 'web' },
  },
  {
    path: '/library',
    schema: librarySearchSchema,
    search: { tab: 'videos', q: 'palestra', view: 'list', tag: 'curso' },
  },
  {
    path: '/projects',
    schema: projectsSearchSchema,
    search: { q: 'casa', view: 'grid', visibility: 'personal' },
  },
  {
    path: '/finance/expenses',
    schema: transactionsSearchSchema,
    search: { q: 'mercado', view: 'grid', repetition: 'recurring' },
  },
  {
    path: '/finance/income',
    schema: transactionsSearchSchema,
    search: { q: 'salário', view: 'grid', repetition: 'one_off' },
  },
  {
    path: '/finance/accounts',
    schema: accountsSearchSchema,
    search: { q: 'nubank', view: 'grid', kind: 'credit_card' },
  },
  {
    path: '/finance/transfers',
    schema: transfersSearchSchema,
    search: { q: 'reserva', view: 'grid', period: 'all' },
  },
  {
    path: '/admin/users',
    schema: usersSearchSchema,
    search: { q: 'ana', view: 'table', role: 'admin' },
  },
];

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('listing standard', () => {
  it.each(LISTINGS)(
    '$path keeps q, view and filters in the URL',
    async ({ path, schema, search }) => {
      // A administração confere o papel em `/me` antes de abrir; as listas podem vir vazias.
      vi.stubGlobal(
        'fetch',
        vi.fn((input: string) =>
          Promise.resolve(
            Response.json(
              input.endsWith('/me')
                ? { id: 'u1', email: 'ana@atria.test', role: 'admin' }
                : { items: [], next_cursor: null },
            ),
          ),
        ),
      );
      const keys = Object.keys(schema.shape);
      expect(keys).toContain('q');
      expect(keys).toContain('view');
      expect(keys.length).toBeGreaterThan(2);
      expect(schema.parse(search)).toMatchObject(search);

      const url = `${path}?${new URLSearchParams(search).toString()}`;
      const router = createAppRouter(featureRoutes(rootRoute), {
        history: createMemoryHistory({ initialEntries: [url] }),
      });
      await router.load();
      expect(router.state.matches.at(-1)?.fullPath).toBe(path);
      expect(router.state.location.search).toMatchObject(search);
    },
  );
});
