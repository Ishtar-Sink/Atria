import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { ApiProblem } from '../api/problem';
import { hasMessage } from '../i18n/i18n';
import { pushToast } from '../toast/toast-store';

export interface OptimisticMutationOptions<TData, TVariables, TCache> {
  mutation_fn: (variables: TVariables) => Promise<TData>;
  query_key: QueryKey;
  /** Calcula o valor da consulta já com a mudança, antes de o servidor responder. */
  apply: (current: TCache | undefined, variables: TVariables) => TCache;
  error_message_key?: string;
}

function errorMessageKey(error: unknown, fallback: string): string {
  if (error instanceof ApiProblem) {
    const key = `common.errors.${error.code}`;
    if (hasMessage(key)) return key;
  }
  return fallback;
}

/** Mutação otimista: aplica na hora e desfaz com aviso na recusa ([project/frontend-18]). */
export function useOptimisticMutation<TData, TVariables, TCache>(
  options: OptimisticMutationOptions<TData, TVariables, TCache>,
) {
  const client = useQueryClient();
  const { mutation_fn, query_key, apply } = options;
  const fallback = options.error_message_key ?? 'common.errors.generic';

  return useMutation<TData, Error, TVariables, { previous: TCache | undefined }>({
    mutationFn: mutation_fn,
    onMutate: async (variables) => {
      await client.cancelQueries({ queryKey: query_key });
      const previous = client.getQueryData<TCache>(query_key);
      client.setQueryData<TCache>(query_key, apply(previous, variables));
      return { previous };
    },
    onError: (error, _variables, context) => {
      client.setQueryData(query_key, context?.previous);
      pushToast({ tone: 'danger', message_key: errorMessageKey(error, fallback) });
    },
    onSettled: () => client.invalidateQueries({ queryKey: query_key }),
  });
}
