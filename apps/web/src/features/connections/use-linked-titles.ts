import { useQueries } from '@tanstack/react-query';
import { api } from '../../shared/api/client';
import { ApiProblem } from '../../shared/api/problem';
import { registerMessages, useT } from '../../shared/i18n/i18n';
import { usePreferences } from '../../shared/preferences/preferences-context';
import { ENTITY_CATEGORIES, isLinkableType } from './entity-categories';
import messages from './i18n/pt-br.json';

// Todas as peças da feature passam por aqui; o registro é idempotente.
registerMessages('connections', messages);

export interface LinkedRef {
  type: string;
  id: string;
}

export interface LinkedTitle {
  /** Título da entidade, ou o rótulo do tipo enquanto carrega e quando não há leitura. */
  title: string;
  /** Rota da tela da entidade; `null` sem tela ou sem a resposta ainda. */
  href: string | null;
  loading: boolean;
}

export function linkedKey(ref: LinkedRef): string {
  return `${ref.type}:${ref.id}`;
}

function isNotFound(error: unknown): boolean {
  return error instanceof ApiProblem && error.status === 404;
}

/**
 * Título e link de cada entidade ligada. A listagem de `/links` não traz título: ele vem do
 * `GET` por id do tipo. Transferência e marco não têm leitura por id e aparecem pelo rótulo do tipo.
 */
export function useLinkedTitles(refs: readonly LinkedRef[]): Map<string, LinkedTitle> {
  const t = useT();
  const { locale, time_zone } = usePreferences();
  const results = useQueries({
    queries: refs.map((ref) => {
      const config = isLinkableType(ref.type) ? ENTITY_CATEGORIES[ref.type] : undefined;
      const path = config?.detail_path(ref.id) ?? null;
      return {
        queryKey: ['connections', 'linked', ref.type, ref.id],
        queryFn: ({ signal }: { signal: AbortSignal }) => api.get<unknown>(path ?? '', { signal }),
        enabled: path !== null,
        retry: (count: number, error: Error) => !isNotFound(error) && count < 2,
        staleTime: 30_000,
      };
    }),
  });

  const titles = new Map<string, LinkedTitle>();
  refs.forEach((ref, index) => {
    const result = results[index];
    const label = isLinkableType(ref.type) ? t(`connections.type.${ref.type}`) : ref.type;
    const config = isLinkableType(ref.type) ? ENTITY_CATEGORIES[ref.type] : undefined;
    if (config === undefined || result?.data === undefined) {
      const loading = result?.isPending === true && result.fetchStatus !== 'idle';
      titles.set(linkedKey(ref), { title: label, href: null, loading });
      return;
    }
    titles.set(linkedKey(ref), {
      title: config.title_of(result.data, { locale, time_zone }) ?? label,
      href: config.route(ref.id, result.data),
      loading: false,
    });
  });
  return titles;
}
