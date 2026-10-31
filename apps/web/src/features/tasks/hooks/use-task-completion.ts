import type { Schemas } from '@atria/contracts';
import type { QueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { api } from '../../../shared/api/client';
import { mapOccurrences, mapTask, useTasksOptimistic, type Task } from './use-tasks';

type Completion = Schemas['CompletionResponse'];

export interface CompletionVariables {
  task: Pick<Task, 'id' | 'is_recurring'>;
  /** Obrigatória na recorrente (RN-09); a pontual não leva. */
  occurrence_date?: string | undefined;
}

function setCompleted(
  client: QueryClient,
  { task, occurrence_date }: CompletionVariables,
  completed: boolean,
) {
  if (task.is_recurring) {
    // Só a ocorrência daquele dia muda (RN-09).
    mapOccurrences(client, (items) =>
      items.map((item) =>
        item.task_id === task.id && item.occurrence_date === occurrence_date
          ? { ...item, completed }
          : item,
      ),
    );
    return;
  }
  mapTask(client, task.id, (current) => ({
    ...current,
    completed_at: completed ? new Date().toISOString() : null,
  }));
}

/** Conclui a tarefa pontual ou uma ocorrência da recorrente, com a mudança na hora (RNF-09). */
export function useCompleteTask() {
  return useTasksOptimistic<Completion, CompletionVariables>({
    mutation_fn: ({ task, occurrence_date }) =>
      api.post<Completion>(
        `/tasks/${task.id}/completion`,
        task.is_recurring ? { occurrence_date } : {},
      ),
    apply: (client, variables) => {
      setCompleted(client, variables, true);
    },
  });
}

export function useReopenTask() {
  return useTasksOptimistic<Completion, CompletionVariables>({
    mutation_fn: ({ task, occurrence_date }) => {
      const query =
        task.is_recurring && occurrence_date !== undefined
          ? `?occurrence_date=${encodeURIComponent(occurrence_date)}`
          : '';
      return api.delete<Completion>(`/tasks/${task.id}/completion${query}`);
    },
    apply: (client, variables) => {
      setCompleted(client, variables, false);
    },
  });
}

/** Alterna a conclusão: reabre o que está feito e conclui o que está aberto. */
export function useToggleCompletion() {
  const { mutate: complete } = useCompleteTask();
  const { mutate: reopen } = useReopenTask();
  return useCallback(
    (variables: CompletionVariables, done: boolean) => {
      (done ? reopen : complete)(variables);
    },
    [complete, reopen],
  );
}
