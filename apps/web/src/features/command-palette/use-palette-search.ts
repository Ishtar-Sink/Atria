import type { Schemas } from '@atria/contracts';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { api } from '../../shared/api/client';
import { registerMessages } from '../../shared/i18n/i18n';
import messages from './i18n/pt-br.json';
import { parseQuery, type QueryMode } from './parse-query';

// Todas as peças da paleta passam por aqui; o registro é idempotente.
registerMessages('command_palette', messages);

export type SearchResponse = Schemas['SearchResponse'];
export type PreferencesResponse = Schemas['PreferencesResponse'];

const DEBOUNCE_MS = 200;
const PREFERENCES_STALE_MS = 5 * 60 * 1000;

/** Atalho e contextos padrão da busca, de `GET /me/preferences` (RF-59). */
export function usePaletteSettings() {
  const query = useQuery({
    queryKey: ['me', 'preferences'],
    queryFn: ({ signal }) => api.get<PreferencesResponse>('/me/preferences', { signal }),
    staleTime: PREFERENCES_STALE_MS,
  });
  return {
    palette_shortcut: query.data?.palette_shortcut,
    search_contexts: query.data?.search_contexts ?? [],
    /** Já se sabe os contextos padrão (ou a leitura falhou e vale "tudo"). */
    ready: query.isFetched,
  };
}

function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(value);
    }, delay);
    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);
  return debounced;
}

export interface PaletteSearchInput {
  text: string;
  /** Contextos escolhidos na hora; vazio busca em todos. */
  contexts: readonly string[];
  enabled: boolean;
}

/** Busca em `/search` com espera curta entre teclas; `>` não busca no servidor (RF-16). */
export function usePaletteSearch({ text, contexts, enabled }: PaletteSearchInput) {
  const debounced = useDebounced(text, DEBOUNCE_MS);
  const live = parseQuery(text);
  const settled = parseQuery(debounced);
  const mode: QueryMode = settled.mode;
  const q = mode === 'tags' ? `#${settled.term}` : settled.term;
  const wanted = enabled && mode !== 'actions' && settled.term !== '';
  const contexts_param = contexts.length > 0 ? contexts.join(',') : undefined;

  const query = useQuery({
    queryKey: ['command-palette', 'search', q, contexts_param ?? ''],
    queryFn: ({ signal }) =>
      api.get<SearchResponse>('/search', {
        query: { q, contexts: contexts_param },
        signal,
      }),
    enabled: wanted,
  });

  const waiting = live.mode !== 'actions' && live.term !== '' && live.term !== settled.term;
  return {
    groups: wanted ? (query.data?.groups ?? []) : [],
    loading: waiting || (wanted && query.isFetching),
    failed: wanted && query.isError && !waiting,
    searched: wanted && !waiting && !query.isFetching && query.isSuccess,
  };
}
