import type { Schemas } from '@atria/contracts';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect } from 'react';
import { useTheme } from '../../app/theme/theme-provider';
import { api } from '../../shared/api/client';
import { useOptimisticMutation } from '../../shared/optimistic/use-optimistic-mutation';
import { pushToast } from '../../shared/toast/toast-store';

export type UserPreferences = Schemas['PreferencesResponse'];
export type PreferencesChange = Schemas['UpdatePreferencesRequest'];

export const PREFERENCES_KEY = ['me', 'preferences'] as const;

export const DEFAULT_PREFERENCES: UserPreferences = {
  theme: 'system',
  locale: 'pt-BR',
  timezone: 'America/Sao_Paulo',
  currency: 'BRL',
  palette_shortcut: 'mod+k',
  search_contexts: [
    'finance',
    'goals',
    'tasks',
    'reminders',
    'notes',
    'journal',
    'library',
    'projects',
  ],
};

export function useUserPreferences() {
  return useQuery({
    queryKey: PREFERENCES_KEY,
    queryFn: ({ signal }) => api.get<UserPreferences>('/me/preferences', { signal }),
  });
}

/** `PATCH /me/preferences` com a mudança na tela antes de o servidor responder (RNF-09). */
export function useUpdatePreferences() {
  return useOptimisticMutation<UserPreferences, PreferencesChange, UserPreferences>({
    mutation_fn: (change) => api.patch<UserPreferences>('/me/preferences', change),
    query_key: PREFERENCES_KEY,
    apply: (current, change) => ({
      ...DEFAULT_PREFERENCES,
      ...current,
      ...Object.fromEntries(Object.entries(change).filter(([, value]) => value != null)),
    }),
    error_message_key: 'settings.undo_notice',
  });
}

/** Mostra o aviso de "salvo" quando o servidor confirma. */
export function notifySaved() {
  pushToast({ tone: 'success', message_key: 'settings.saved' });
}

/**
 * Mantém o tema do app igual ao da preferência no servidor: a mudança aparece na hora e, se o
 * servidor recusar, o valor volta e o tema também. "Seguir o sistema" usa o tema atual do sistema.
 * Devolve a função que aplica um tema já, sem esperar o servidor.
 */
export function useApplyTheme(theme: string | undefined) {
  const { setTheme } = useTheme();
  const apply = useCallback(
    (value: string | undefined) => {
      if (value === 'light' || value === 'dark') setTheme(value);
      else if (value === 'system') {
        setTheme(window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      }
    },
    [setTheme],
  );
  useEffect(() => {
    apply(theme);
  }, [theme, apply]);
  return apply;
}
