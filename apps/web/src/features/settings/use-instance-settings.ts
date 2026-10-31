import type { Schemas } from '@atria/contracts';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../shared/api/client';
import { useOptimisticMutation } from '../../shared/optimistic/use-optimistic-mutation';

export type InstanceSettings = Schemas['InstanceSettingsResponse'];
export type InstanceSettingsChange = Schemas['UpdateInstanceSettingsRequest'];

export const INSTANCE_SETTINGS_KEY = ['admin', 'instance', 'settings'] as const;

interface Viewer {
  id: string;
  role?: string;
}

/** Quem usa o app (`GET /me`): o papel decide se a seção da instância aparece (RN-12). */
export function useViewerRole() {
  const query = useQuery({
    queryKey: ['me'],
    queryFn: ({ signal }) => api.get<Viewer>('/me', { signal }),
    staleTime: 5 * 60 * 1000,
  });
  return {
    ...query,
    role: query.data?.role,
    is_admin: query.data?.role === 'admin',
  };
}

/** Só o admin lê as configurações; para os demais a consulta nem sai (RN-12). */
export function useInstanceSettings(enabled: boolean) {
  return useQuery({
    queryKey: INSTANCE_SETTINGS_KEY,
    queryFn: ({ signal }) => api.get<InstanceSettings>('/admin/instance/settings', { signal }),
    enabled,
  });
}

export function useUpdateInstanceSettings() {
  return useOptimisticMutation<InstanceSettings, InstanceSettingsChange, InstanceSettings>({
    mutation_fn: (change) => api.patch<InstanceSettings>('/admin/instance/settings', change),
    query_key: INSTANCE_SETTINGS_KEY,
    apply: (current, change) => ({
      ...current,
      ...change,
      invite_required: change.invite_required ?? current?.invite_required ?? true,
      web_push_enabled: change.web_push_enabled ?? current?.web_push_enabled ?? false,
      web_push_configured: current?.web_push_configured ?? false,
    }),
    error_message_key: 'settings.undo_notice',
  });
}
