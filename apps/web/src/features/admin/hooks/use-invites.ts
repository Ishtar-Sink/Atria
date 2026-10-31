import { useMutation, useQuery } from '@tanstack/react-query';
import type { Schemas } from '@atria/contracts';
import { api } from '../../../shared/api/client';
import { useOptimisticMutation } from '../../../shared/optimistic/use-optimistic-mutation';

export type Invite = Schemas['InviteResponse'];

export type InstanceSettings = Schemas['InstanceSettingsResponse'];

export const SETTINGS_KEY = ['admin', 'instance', 'settings'] as const;

/** `POST /admin/invites`: o link só aparece nesta resposta. */
export function useCreateInvite() {
  return useMutation({ mutationFn: () => api.post<Invite>('/admin/invites') });
}

/**
 * Lê e altera "convite obrigatório". Só o admin lê as configurações: para os outros papéis,
 * `enabled` fica falso e nenhuma chamada sai.
 */
export function useInviteRequired(enabled: boolean) {
  const query = useQuery({
    queryKey: SETTINGS_KEY,
    queryFn: ({ signal }) => api.get<InstanceSettings>('/admin/instance/settings', { signal }),
    enabled,
  });
  const mutation = useOptimisticMutation<InstanceSettings, boolean, InstanceSettings>({
    query_key: SETTINGS_KEY,
    mutation_fn: (invite_required) =>
      api.patch<InstanceSettings>('/admin/instance/settings', { invite_required }),
    apply: (current, invite_required) => ({
      web_push_enabled: false,
      ...current,
      invite_required,
    }),
  });
  return { query, mutation };
}
