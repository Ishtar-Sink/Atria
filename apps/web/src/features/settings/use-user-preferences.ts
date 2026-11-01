import type { Schemas } from '@atria/contracts';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect } from 'react';
import { useTheme } from '../../app/theme/theme-provider';
import { api } from '../../shared/api/client';
import { useCurrentUser } from '../../shared/session/current-user';
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

export function useUserPreferences(enabled = true) {
  return useQuery({
    queryKey: PREFERENCES_KEY,
    enabled,
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
 * Devolve a função que aplica o modo de tema já, sem esperar o servidor. "Seguir o sistema"
 * (`system`) acompanha o sistema em tempo real, sem gravar um tema fixo.
 */
export function useApplyTheme() {
  const { setMode } = useTheme();
  return useCallback(
    (value: string | undefined) => {
      if (value === 'light' || value === 'dark' || value === 'system') setMode(value);
    },
    [setMode],
  );
}

/**
 * Fonte única do tema (RF-17): aplica a preferência do servidor ao abrir o app. Se uma mutação é
 * recusada, o cache volta ao valor anterior e o efeito devolve o tema.
 */
export function useServerTheme() {
  const { data: user } = useCurrentUser();
  const { data } = useUserPreferences(Boolean(user));
  const apply = useApplyTheme();
  const theme = data?.theme;
  useEffect(() => {
    apply(theme);
  }, [theme, apply]);
}

/** O botão "Alternar tema": troca o tema na hora e grava a preferência no servidor. */
export function useToggleThemePreference() {
  const { toggleTheme } = useTheme();
  const update = useUpdatePreferences();
  return useCallback(() => {
    const next = toggleTheme();
    update.mutate({ theme: next });
  }, [toggleTheme, update]);
}
