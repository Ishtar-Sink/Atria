import { useQuery } from '@tanstack/react-query';
import type { Schemas } from '@atria/contracts';
import { api } from '../../../shared/api/client';

export type InstanceStatus = Schemas['InstanceStateResponse'];

export function useInstanceStatus() {
  return useQuery({
    queryKey: ['admin', 'instance'],
    queryFn: ({ signal }) => api.get<InstanceStatus>('/admin/instance', { signal }),
  });
}
