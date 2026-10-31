import type { Schemas } from '@atria/contracts';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../shared/api/client';
import { ApiProblem } from '../../shared/api/problem';
import { projectKeys } from './use-projects';

type LinkPage = Schemas['LinkPage'];
type LinkResponse = Schemas['LinkResponse'];
type Task = Schemas['TaskResponse'];
type TaskPage = Schemas['TaskPageResponse'];

/** A tarefa ligada a um cartão: vem de `/links`, nunca de um campo do cartão (DEC-003). */
export interface CardTask {
  link_id: string;
  task_id: string;
  title: string;
  completed: boolean;
}

const CARD_TYPE = 'project_card';
const TASK_TYPE = 'task';

function listLinks(card_id: string, signal?: AbortSignal): Promise<LinkPage> {
  return api.get<LinkPage>('/links', {
    query: { entity_type: CARD_TYPE, entity_id: card_id, linked_type: TASK_TYPE },
    ...(signal ? { signal } : {}),
  });
}

async function readCardTask(card_id: string, signal?: AbortSignal): Promise<CardTask | null> {
  const page = await listLinks(card_id, signal);
  const link = page.items.find((item) => item.linked_type === TASK_TYPE && item.linked_id);
  if (!link?.linked_id) return null;
  const task = await api.get<Task>(`/tasks/${encodeURIComponent(link.linked_id)}`, {
    ...(signal ? { signal } : {}),
  });
  return {
    link_id: link.id,
    task_id: task.id,
    title: task.title,
    completed: task.completed_at != null,
  };
}

export function useCardTask(card_id: string | undefined) {
  return useQuery({
    queryKey: projectKeys.card_task(card_id ?? ''),
    enabled: card_id !== undefined,
    queryFn: ({ signal }) => readCardTask(card_id ?? '', signal),
  });
}

/** A tarefa ligada de cada cartão do quadro e da Visão geral, por id do cartão. */
export function useCardTasks(card_ids: readonly string[]): Map<string, CardTask> {
  const results = useQueries({
    queries: card_ids.map((card_id) => ({
      queryKey: projectKeys.card_task(card_id),
      queryFn: ({ signal }: { signal: AbortSignal }) => readCardTask(card_id, signal),
    })),
  });
  const found = new Map<string, CardTask>();
  results.forEach((result, index) => {
    const id = card_ids[index];
    if (id !== undefined && result.data) found.set(id, result.data);
  });
  return found;
}

/** Tarefas abertas para o campo "Ligar a uma tarefa" do formulário. */
export function useOpenTasks() {
  return useQuery({
    queryKey: ['projects', 'open-tasks'],
    queryFn: ({ signal }) =>
      api.get<TaskPage>('/tasks', { query: { status: 'open', limit: 100 }, signal }),
    select: (page) => page.items,
  });
}

/**
 * Liga o cartão a uma tarefa, troca a ligação ou a remove (`task_id` nulo). Um 409
 * `link_already_exists` conta como já ligada.
 */
export function useSetCardTask() {
  const client = useQueryClient();
  return useMutation<undefined, Error, { card_id: string; task_id: string | null }>({
    mutationFn: async ({ card_id, task_id }) => {
      const current: LinkResponse[] = (await listLinks(card_id)).items.filter(
        (item) => item.linked_type === TASK_TYPE,
      );
      for (const link of current) {
        if (link.linked_id !== task_id) {
          await api.delete(`/links/${encodeURIComponent(link.id)}`);
        }
      }
      if (task_id === null || current.some((link) => link.linked_id === task_id)) return;
      try {
        await api.post('/links', {
          source_type: CARD_TYPE,
          source_id: card_id,
          target_type: TASK_TYPE,
          target_id: task_id,
        });
      } catch (error) {
        if (!(error instanceof ApiProblem && error.code === 'link_already_exists')) throw error;
      }
    },
    onSettled: (_data, _error, { card_id }) =>
      client.invalidateQueries({ queryKey: projectKeys.card_task(card_id) }),
  });
}
