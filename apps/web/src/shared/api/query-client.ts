import { QueryClient } from '@tanstack/react-query';
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

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: shouldRetry, staleTime: STALE_TIME_MS },
    },
  });
}
