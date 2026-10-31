import { useQuery } from '@tanstack/react-query';
import { api } from '../../shared/api/client';
import { usePreferences } from '../../shared/preferences/preferences-context';
import { projectKeys, todayIn, type ProjectSummary } from './use-projects';

/** Resumo da Visão geral (PD-42): "hoje" segue o fuso da pessoa, não o do servidor. */
export function useProjectSummary(project_id: string) {
  const { time_zone } = usePreferences();
  const today = todayIn(time_zone);
  return useQuery({
    queryKey: projectKeys.summary(project_id, today),
    queryFn: ({ signal }) =>
      api.get<ProjectSummary>(`/projects/${encodeURIComponent(project_id)}/summary`, {
        query: { today },
        signal,
      }),
  });
}
