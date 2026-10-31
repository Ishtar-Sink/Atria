import type { Schemas } from '@atria/contracts';
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
  type QueryKey,
} from '@tanstack/react-query';
import { z } from 'zod';
import { api } from '../../shared/api/client';
import { ApiProblem } from '../../shared/api/problem';
import { hasMessage, registerMessages } from '../../shared/i18n/i18n';
import { pushToast } from '../../shared/toast/toast-store';
import messages from './i18n/pt-br.json';

// Todas as telas da feature passam por aqui; o registro é idempotente.
registerMessages('projects', messages);

export type Project = Schemas['ProjectResponse'];
export type ProjectPage = Schemas['ProjectPage'];
export type Lane = Schemas['LaneResponse'];
export type LanePage = Schemas['LanePage'];
export type Card = Schemas['CardResponse'];
export type CardPage = Schemas['CardPage'];
export type ChecklistItem = Schemas['ChecklistItemResponse'];
export type ProjectSummary = Schemas['ProjectSummaryResponse'];
export type Visibility = Schemas['Visibility'];

export const PRIORITIES = ['low', 'medium', 'high'] as const;
export type Priority = (typeof PRIORITIES)[number];

export function isPriority(value: string | null | undefined): value is Priority {
  return PRIORITIES.some((priority) => priority === value);
}

const PAGE_SIZE = 20;

export interface ProjectFilters {
  q?: string | undefined;
  visibility?: Visibility | undefined;
}

export interface ProjectInput {
  name: string;
  description?: string | null;
  visibility?: Visibility;
}

const optionalText = z.preprocess(
  (value) =>
    (typeof value === 'string' && value !== '') || typeof value === 'number'
      ? String(value)
      : undefined,
  z.string().optional(),
);

/** Busca, filtro e visualização da lista, como ficam na URL ([project/frontend-13]). */
export const projectsSearchSchema = z.object({
  q: optionalText,
  visibility: z.enum(['personal', 'shared']).optional(),
  view: z.enum(['list', 'grid']).default('list'),
});

export type ProjectsSearch = z.output<typeof projectsSearchSchema>;

export function searchToFilters(search: ProjectsSearch): ProjectFilters {
  return { q: search.q, visibility: search.visibility };
}

export const projectKeys = {
  all: ['projects'] as const,
  lists: ['projects', 'list'] as const,
  list: (filters: ProjectFilters) => ['projects', 'list', filters] as const,
  detail: (id: string) => ['projects', 'detail', id] as const,
  lanes: (id: string) => ['projects', 'lanes', id] as const,
  cards: (id: string) => ['projects', 'cards', id] as const,
  card: (id: string, card_id: string) => ['projects', 'card', id, card_id] as const,
  summary: (id: string, today: string) => ['projects', 'summary', id, today] as const,
  card_task: (card_id: string) => ['projects', 'card-task', card_id] as const,
};

/** Chave de tradução do aviso quando o servidor recusa uma mudança. */
export function refusalMessageKey(error: unknown): string {
  if (error instanceof ApiProblem) {
    const key = `common.errors.${error.code}`;
    if (hasMessage(key)) return key;
  }
  return 'common.errors.generic';
}

/** Data sem hora (`YYYY-MM-DD`): formatada em UTC para não cair no dia anterior. */
const day_formats = new Map<string, Intl.DateTimeFormat>();
export function formatDay(date: string, locale: string): string {
  let format = day_formats.get(locale);
  if (format === undefined) {
    format = new Intl.DateTimeFormat(locale, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: 'UTC',
    });
    day_formats.set(locale, format);
  }
  return format.format(new Date(`${date}T00:00:00Z`));
}

/** A data de hoje (`YYYY-MM-DD`) no fuso da pessoa. */
export function todayIn(time_zone: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: time_zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function useProjects(filters: ProjectFilters) {
  return useInfiniteQuery({
    queryKey: projectKeys.list(filters),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) =>
      api.get<ProjectPage>('/projects', {
        query: {
          q: filters.q,
          visibility: filters.visibility,
          cursor: pageParam,
          limit: PAGE_SIZE,
        },
        signal,
      }),
    getNextPageParam: (last) => last.next_cursor ?? undefined,
  });
}

export function useProject(id: string) {
  return useQuery({
    queryKey: projectKeys.detail(id),
    queryFn: ({ signal }) => api.get<Project>(`/projects/${encodeURIComponent(id)}`, { signal }),
  });
}

type ProjectList = InfiniteData<ProjectPage, string | undefined>;

interface Snapshot {
  lists: [QueryKey, ProjectList | undefined][];
  detail: Project | undefined;
}

function mapLists(client: QueryClient, change: (page: ProjectPage) => ProjectPage) {
  client.setQueriesData<ProjectList>({ queryKey: projectKeys.lists }, (current) =>
    current === undefined
      ? current
      : { ...current, pages: current.pages.map((page) => change(page)) },
  );
}

function restore(client: QueryClient, id: string | undefined, snapshot: Snapshot | undefined) {
  snapshot?.lists.forEach(([key, data]) => {
    client.setQueryData(key, data);
  });
  if (id !== undefined) client.setQueryData(projectKeys.detail(id), snapshot?.detail);
}

export interface ProjectPatch {
  name?: string;
  description?: string | null;
  visibility?: Visibility;
}

/** Criar não é otimista: o projeto só existe, com as raias padrão, depois do servidor. */
export function useCreateProject() {
  const client = useQueryClient();
  return useMutation<Project, Error, ProjectInput>({
    mutationFn: (input) => api.post<Project>('/projects', input),
    onSuccess: () => client.invalidateQueries({ queryKey: projectKeys.all }),
  });
}

export function useUpdateProject() {
  const client = useQueryClient();
  return useMutation<Project, Error, { id: string; patch: ProjectPatch }, Snapshot>({
    mutationFn: ({ id, patch }) => api.patch<Project>(`/projects/${encodeURIComponent(id)}`, patch),
    onMutate: async ({ id, patch }) => {
      await client.cancelQueries({ queryKey: projectKeys.all });
      const snapshot: Snapshot = {
        lists: client.getQueriesData<ProjectList>({ queryKey: projectKeys.lists }),
        detail: client.getQueryData<Project>(projectKeys.detail(id)),
      };
      const apply = (project: Project): Project => ({ ...project, ...patch });
      mapLists(client, (page) => ({
        ...page,
        items: page.items.map((project) => (project.id === id ? apply(project) : project)),
      }));
      client.setQueryData<Project>(projectKeys.detail(id), (project) =>
        project === undefined ? project : apply(project),
      );
      return snapshot;
    },
    onError: (error, { id }, snapshot) => {
      restore(client, id, snapshot);
      pushToast({ tone: 'danger', message_key: refusalMessageKey(error) });
    },
    onSettled: () => client.invalidateQueries({ queryKey: projectKeys.all }),
  });
}

export function useDeleteProject() {
  const client = useQueryClient();
  return useMutation<undefined, Error, { id: string }, Snapshot>({
    mutationFn: ({ id }) => api.delete<undefined>(`/projects/${encodeURIComponent(id)}`),
    onMutate: async ({ id }) => {
      await client.cancelQueries({ queryKey: projectKeys.lists });
      const snapshot: Snapshot = {
        lists: client.getQueriesData<ProjectList>({ queryKey: projectKeys.lists }),
        detail: undefined,
      };
      mapLists(client, (page) => ({
        ...page,
        items: page.items.filter((project) => project.id !== id),
      }));
      return snapshot;
    },
    onError: (error, _variables, snapshot) => {
      restore(client, undefined, snapshot);
      pushToast({ tone: 'danger', message_key: refusalMessageKey(error) });
    },
    onSuccess: (_data, { id }) => {
      client.removeQueries({ queryKey: projectKeys.detail(id) });
    },
    onSettled: () => client.invalidateQueries({ queryKey: projectKeys.lists }),
  });
}
