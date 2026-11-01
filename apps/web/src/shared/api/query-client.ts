import { MutationCache, QueryCache, QueryClient, type QueryKey } from '@tanstack/react-query';
import { isSessionLost, SESSION_QUERY_KEY } from '../session/current-user';
import { ApiProblem } from './problem';

const MAX_NETWORK_RETRIES = 2;
const STALE_TIME_MS = 30_000;

/** Repete só falha de rede; resposta 4xx nunca é repetida. */
export function shouldRetry(failure_count: number, error: unknown): boolean {
  return (
    error instanceof ApiProblem &&
    error.code === 'network_error' &&
    failure_count < MAX_NETWORK_RETRIES
  );
}

function isSessionQuery(key: QueryKey): boolean {
  return key.length === 1 && key[0] === SESSION_QUERY_KEY[0];
}

export function createQueryClient(): QueryClient {
  // Um 401 no uso refaz a consulta da sessão: ela responde 401 e o `SessionGate` leva ao
  // login (RF-02). O 401 da própria sessão é ignorado, senão ele se repetiria sem fim.
  const invalidateSession = (error: unknown) => {
    if (isSessionLost(error)) {
      void client.invalidateQueries({ queryKey: SESSION_QUERY_KEY, exact: true });
    }
  };
  const client: QueryClient = new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => {
        if (!isSessionQuery(query.queryKey)) invalidateSession(error);
      },
    }),
    mutationCache: new MutationCache({ onError: invalidateSession }),
    defaultOptions: {
      queries: { retry: shouldRetry, staleTime: STALE_TIME_MS },
    },
  });
  return client;
}
