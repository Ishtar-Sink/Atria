import type { Schemas } from '@atria/contracts';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../shared/api/client';
import { useT } from '../../shared/i18n/i18n';
import { emotionLabel } from '../journal/use-emotions';
import type { ReportFilterKey } from './report-catalog';

export interface FilterOption {
  value: string;
  label: string;
}

interface Page<T> {
  items: T[];
  next_cursor?: string | null | undefined;
}

const PAGE_SIZE = 100;

/** Lê todas as páginas de uma listagem curta. */
async function readAll<T>(
  path: string,
  query: Record<string, string | number>,
  signal: AbortSignal,
): Promise<T[]> {
  const items: T[] = [];
  let cursor: string | undefined;
  for (;;) {
    const page = await api.get<Page<T>>(path, {
      query: { ...query, limit: PAGE_SIZE, cursor },
      signal,
    });
    items.push(...page.items);
    if (!page.next_cursor) return items;
    cursor = page.next_cursor;
  }
}

function useOptions<T>(
  enabled: boolean,
  key: string,
  load: (signal: AbortSignal) => Promise<T[]>,
  toOption: (item: T) => FilterOption,
) {
  return useQuery({
    queryKey: ['reports', 'options', key],
    queryFn: ({ signal }) => load(signal),
    enabled,
    select: (items) => items.map(toOption),
  });
}

/**
 * Opções dos seletores de filtro: uma consulta por filtro, só enquanto ele aparece na página.
 * As categorias são só as de saída, as únicas que o relatório de gastos usa.
 */
export function useFilterOptions(filters: readonly ReportFilterKey[]) {
  const t = useT();
  const wants = (key: ReportFilterKey) => filters.includes(key);
  const account = useOptions(
    wants('account'),
    'accounts',
    (signal) => readAll<Schemas['AccountResponse']>('/accounts', {}, signal),
    (item) => ({ value: item.id, label: item.name }),
  );
  const category = useOptions(
    wants('category'),
    'categories-expense',
    (signal) => readAll<Schemas['CategoryResponse']>('/categories', { kind: 'expense' }, signal),
    (item) => ({ value: item.id, label: item.name }),
  );
  const book = useOptions(
    wants('book'),
    'books',
    (signal) => readAll<Schemas['BookResponse']>('/books', {}, signal),
    (item) => ({ value: item.id, label: item.title }),
  );
  const emotion = useQuery({
    queryKey: ['reports', 'options', 'emotions'],
    queryFn: ({ signal }) => api.get<Schemas['EmotionList']>('/emotions', { signal }),
    enabled: wants('emotion'),
    select: (list): FilterOption[] =>
      list.items.map((item) => ({ value: item.id, label: emotionLabel(item, t) })),
  });
  const goal = useOptions(
    wants('goal'),
    'goals',
    (signal) => readAll<Schemas['GoalResponse']>('/goals', {}, signal),
    (item) => ({ value: item.id, label: item.title }),
  );
  const project = useOptions(
    wants('project'),
    'projects',
    (signal) => readAll<Schemas['ProjectResponse']>('/projects', {}, signal),
    (item) => ({ value: item.id, label: item.name }),
  );
  return { account, category, book, emotion, goal, project };
}
