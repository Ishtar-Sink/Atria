import { useNavigate, useRouterState } from '@tanstack/react-router';
import { useCallback, useMemo } from 'react';
import type { z } from 'zod';

type Schema = z.ZodObject<z.ZodRawShape>;

/** Valor inválido some e o campo volta ao padrão do schema ([project/frontend-13]). */
function parseSearch<T extends Schema>(schema: T, raw: Record<string, unknown>): z.output<T> {
  const first = schema.safeParse(raw);
  if (first.success) return first.data;
  const invalid = new Set(first.error.issues.map((issue) => issue.path[0]));
  const clean = Object.fromEntries(Object.entries(raw).filter(([key]) => !invalid.has(key)));
  const second = schema.safeParse(clean);
  return second.success ? second.data : schema.parse({});
}

const VIEW_PREFIX = 'atria_view:';

function readView(view_key: string): string | undefined {
  try {
    return localStorage.getItem(`${VIEW_PREFIX}${view_key}`) ?? undefined;
  } catch {
    return undefined;
  }
}

function writeView(view_key: string, view: string) {
  try {
    localStorage.setItem(`${VIEW_PREFIX}${view_key}`, view);
  } catch {
    // Sem armazenamento: a visualização só vale nesta tela.
  }
}

export interface ListSearchOptions {
  /** O módulo, ou `módulo:aba` no Acervo: a visualização escolhida volta na próxima visita (PD-24). */
  view_key?: string;
}

export function useListSearch<T extends Schema>(schema: T, options: ListSearchOptions = {}) {
  const { view_key } = options;
  const raw: Record<string, unknown> = useRouterState({
    select: (state) => state.location.search as Record<string, unknown>,
  });
  const navigate = useNavigate();
  const search = useMemo(() => {
    if (view_key && raw.view === undefined) {
      const remembered = readView(view_key);
      if (remembered !== undefined) {
        const candidate = schema.safeParse({ ...raw, view: remembered });
        if (candidate.success) return candidate.data;
      }
    }
    return parseSearch(schema, raw);
  }, [schema, raw, view_key]);

  const setSearch = useCallback(
    (patch: Partial<z.input<T>>) => {
      const view = (patch as Record<string, unknown>).view;
      if (view_key && typeof view === 'string') writeView(view_key, view);
      void navigate({
        to: '.',
        replace: true,
        search: (previous: Record<string, unknown>) => ({ ...previous, ...patch }),
      });
    },
    [navigate, view_key],
  );

  return { search, setSearch };
}
