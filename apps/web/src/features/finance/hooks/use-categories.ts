import type { Schemas } from '@atria/contracts';
import { contrastRatio, light } from '@atria/theme';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../shared/api/client';
import {
  cancel,
  financeKeys,
  problemCode,
  readAll,
  restore,
  snapshot,
  warnRefusal,
  type Category,
  type Page,
  type Snapshot,
  type TransactionKind,
} from './finance-cache';

export type { Category } from './finance-cache';
export type CreateCategoryInput = Schemas['CreateCategoryRequest'];
export type UpdateCategoryInput = Schemas['UpdateCategoryRequest'];

/** Cor de uma categoria nova: o roxo do tema claro (RF-18). */
export const DEFAULT_CATEGORY_COLOR = '#6d28d9';

/** A cor é sempre gravada como #rrggbb em minúsculas (RN-09). */
export function normalizeHex(hex: string): string {
  return hex.trim().toLowerCase();
}

/** Texto sobre a cor livre: o token escuro ou o claro, o que tiver mais contraste (CB-09). */
export function categoryInk(hex: string): string {
  return contrastRatio(light.text, hex) >= contrastRatio(light.surface, hex)
    ? light.text
    : light.surface;
}

function byName(list: Category[]): Category[] {
  return [...list].sort((left, right) => left.name.localeCompare(right.name));
}

export function useCategories(kind?: TransactionKind) {
  return useQuery({
    queryKey: [...financeKeys.categories, kind ?? 'all'],
    queryFn: async ({ signal }) =>
      byName(
        await readAll((cursor) =>
          api.get<Page<Category>>('/categories', { query: { kind, cursor, limit: 100 }, signal }),
        ),
      ),
  });
}

export function useCategory(id: string | undefined) {
  return useQuery({
    queryKey: financeKeys.category(id ?? ''),
    queryFn: ({ signal }) => api.get<Category>(`/categories/${id ?? ''}`, { signal }),
    enabled: id !== undefined && id !== '',
  });
}

export function useCreateCategory() {
  const client = useQueryClient();
  return useMutation<Category, Error, CreateCategoryInput>({
    mutationFn: (input) => api.post<Category>('/categories', input),
    onError: warnRefusal,
    onSuccess: (created) => {
      client.setQueryData(financeKeys.category(created.id), created);
    },
    onSettled: () => client.invalidateQueries({ queryKey: financeKeys.categories }),
  });
}

export interface UpdateCategoryVariables {
  id: string;
  patch: UpdateCategoryInput;
}

/** O tipo não muda depois de criado: só nome, cor e visibilidade. */
export function useUpdateCategory() {
  const client = useQueryClient();
  return useMutation<Category, Error, UpdateCategoryVariables, { saved: Snapshot }>({
    mutationFn: ({ id, patch }) => api.patch<Category>(`/categories/${id}`, patch),
    onMutate: async ({ id, patch }) => {
      const keys = [financeKeys.categories, financeKeys.category(id)];
      await cancel(client, keys);
      const saved = snapshot(client, keys);
      const apply = (item: Category): Category => ({
        ...item,
        ...(patch.name ? { name: patch.name } : {}),
        ...(patch.color ? { color: patch.color } : {}),
        ...(patch.visibility ? { visibility: patch.visibility } : {}),
      });
      client.setQueriesData<Category[]>({ queryKey: financeKeys.categories }, (list) =>
        list?.map((item) => (item.id === id ? apply(item) : item)),
      );
      client.setQueryData<Category>(financeKeys.category(id), (item) =>
        item ? apply(item) : item,
      );
      return { saved };
    },
    onError: (error, _variables, context) => {
      restore(client, context?.saved);
      warnRefusal(error);
    },
    onSuccess: (updated) => {
      client.setQueryData(financeKeys.category(updated.id), updated);
    },
    onSettled: () => client.invalidateQueries({ queryKey: financeKeys.categories }),
  });
}

/** `needs_destination`: a categoria está em uso e o servidor pede a de destino (CB-15). */
export type DeleteCategoryState = 'idle' | 'needs_destination' | 'kind_mismatch';

export interface DeleteCategoryVariables {
  id: string;
  replacement_id?: string;
}

export function useDeleteCategory() {
  const client = useQueryClient();
  const mutation = useMutation<undefined, Error, DeleteCategoryVariables>({
    mutationFn: ({ id, replacement_id }) =>
      api.delete<undefined>(
        `/categories/${id}${replacement_id ? `?replacement_id=${encodeURIComponent(replacement_id)}` : ''}`,
      ),
    onError: (error) => {
      const code = problemCode(error);
      // Os dois casos aparecem no próprio diálogo de exclusão.
      if (code !== 'category_replacement_required' && code !== 'category_kind_mismatch') {
        warnRefusal(error);
      }
    },
    onSuccess: (_data, { id }) => {
      client.removeQueries({ queryKey: financeKeys.category(id) });
      void client.invalidateQueries({ queryKey: financeKeys.transactions });
      void client.invalidateQueries({ queryKey: financeKeys.summary });
    },
    onSettled: () => client.invalidateQueries({ queryKey: financeKeys.categories }),
  });
  const code = problemCode(mutation.error);
  const state: DeleteCategoryState =
    code === 'category_replacement_required'
      ? 'needs_destination'
      : code === 'category_kind_mismatch'
        ? 'kind_mismatch'
        : 'idle';
  return { ...mutation, state };
}
