import {
  keepPreviousData,
  useInfiniteQuery,
  useQuery,
  type InfiniteData,
} from '@tanstack/react-query';
import type { Schemas } from '@atria/contracts';
import { z } from 'zod';
import { api } from '../../../shared/api/client';
import { useOptimisticMutation } from '../../../shared/optimistic/use-optimistic-mutation';

/** `GET /me`: o papel de quem usa decide quais ações aparecem. */
export type Me = Schemas['MeResponse'];
export type AdminUser = Schemas['UserSummary'];
export type UserPage = Schemas['UserPage'];

export type UsersData = InfiniteData<UserPage, string | undefined>;

export const PAGE_SIZE = 20;

export const ROLE_FILTERS = ['all', 'admin', 'elevated', 'user'] as const;
export const USER_VIEWS = ['list', 'table'] as const;

/** Estado da listagem na URL, com padrão para cada campo ([project/frontend-13]). */
export const usersSearchSchema = z.object({
  role: z.enum(ROLE_FILTERS).default('all'),
  q: z.string().default(''),
  view: z.enum(USER_VIEWS).default('list'),
});

export interface UserFilters {
  role: (typeof ROLE_FILTERS)[number];
  q: string;
}

export function useMe() {
  return useQuery({
    queryKey: ['me'],
    queryFn: ({ signal }) => api.get<Me>('/me', { signal }),
    staleTime: 5 * 60 * 1000,
  });
}

function usersKey(filters: UserFilters) {
  return ['admin', 'users', filters.role, filters.q] as const;
}

export function useUsers(filters: UserFilters) {
  return useInfiniteQuery({
    queryKey: usersKey(filters),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) =>
      api.get<UserPage>('/admin/users', {
        signal,
        query: {
          role: filters.role === 'all' ? undefined : filters.role,
          q: filters.q.trim() === '' ? undefined : filters.q.trim(),
          cursor: pageParam,
          limit: PAGE_SIZE,
        },
      }),
    getNextPageParam: (last) => last.next_cursor ?? undefined,
    placeholderData: keepPreviousData,
  });
}

function patchUser(
  current: UsersData | undefined,
  id: string,
  change: Partial<AdminUser>,
): UsersData {
  if (current === undefined) return { pages: [], pageParams: [] };
  return {
    ...current,
    pages: current.pages.map((page) => ({
      ...page,
      items: page.items.map((user) => (user.id === id ? { ...user, ...change } : user)),
    })),
  };
}

export function useChangeRole(filters: UserFilters) {
  return useOptimisticMutation<AdminUser, { id: string; role: string }, UsersData>({
    query_key: usersKey(filters),
    mutation_fn: ({ id, role }) => api.patch<AdminUser>(`/admin/users/${id}`, { role }),
    apply: (current, { id, role }) => patchUser(current, id, { role }),
  });
}

export function useToggleActive(filters: UserFilters) {
  return useOptimisticMutation<AdminUser, { id: string; is_active: boolean }, UsersData>({
    query_key: usersKey(filters),
    mutation_fn: ({ id, is_active }) => api.patch<AdminUser>(`/admin/users/${id}`, { is_active }),
    apply: (current, { id, is_active }) => patchUser(current, id, { is_active }),
  });
}
