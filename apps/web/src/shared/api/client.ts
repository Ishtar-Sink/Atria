import { ApiProblem, type ProblemFieldError } from './problem';

const CSRF_COOKIE = 'atria_csrf';
const CSRF_HEADER = 'X-CSRF-Token';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export type QueryValue = string | number | boolean | null | undefined;

export interface ClientOptions {
  base_url?: string;
  fetch?: typeof fetch;
}

export interface GetOptions {
  query?: Record<string, QueryValue | QueryValue[]>;
  signal?: AbortSignal;
}

export interface MutationOptions {
  idempotency_key?: string;
  signal?: AbortSignal;
}

interface ProblemBody {
  title?: unknown;
  code?: unknown;
  detail?: unknown;
  errors?: unknown;
}

function readCookie(name: string): string | undefined {
  const prefix = `${name}=`;
  const found = document.cookie.split('; ').find((part) => part.startsWith(prefix));
  return found === undefined ? undefined : decodeURIComponent(found.slice(prefix.length));
}

function buildQuery(query: GetOptions['query']): string {
  if (query === undefined) return '';
  const params = new URLSearchParams();
  for (const [key, raw] of Object.entries(query)) {
    for (const value of Array.isArray(raw) ? raw : [raw]) {
      if (value !== undefined && value !== null) params.append(key, String(value));
    }
  }
  const text = params.toString();
  return text === '' ? '' : `?${text}`;
}

function fieldErrors(value: unknown): ProblemFieldError[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item: unknown) => {
    if (typeof item !== 'object' || item === null) return [];
    const { field, code } = item as Record<string, unknown>;
    return typeof field === 'string' && typeof code === 'string' ? [{ field, code }] : [];
  });
}

async function toProblem(response: Response): Promise<ApiProblem> {
  const body = (await response.json().catch(() => ({}))) as ProblemBody;
  return new ApiProblem({
    status: response.status,
    code: typeof body.code === 'string' ? body.code : 'unknown_error',
    title: typeof body.title === 'string' ? body.title : response.statusText,
    detail: typeof body.detail === 'string' ? body.detail : undefined,
    errors: fieldErrors(body.errors),
  });
}

export function createApiClient(options: ClientOptions = {}) {
  const base_url = options.base_url ?? '/api/v1';

  async function request<TResponse>(
    method: string,
    path: string,
    init: { query?: GetOptions['query']; body?: unknown } & MutationOptions,
  ): Promise<TResponse> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (!SAFE_METHODS.has(method)) {
      const token = readCookie(CSRF_COOKIE);
      if (token !== undefined) headers[CSRF_HEADER] = token;
    }
    if (init.idempotency_key !== undefined) headers['Idempotency-Key'] = init.idempotency_key;
    if (init.body !== undefined) headers['Content-Type'] = 'application/json';

    const doFetch = options.fetch ?? fetch;
    let response: Response;
    try {
      response = await doFetch(`${base_url}${path}${buildQuery(init.query)}`, {
        method,
        headers,
        credentials: 'same-origin',
        ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
        ...(init.signal === undefined ? {} : { signal: init.signal }),
      });
    } catch {
      throw new ApiProblem({ status: 0, code: 'network_error', title: 'Network error' });
    }
    if (!response.ok) throw await toProblem(response);
    if (response.status === 204) return undefined as TResponse;
    return (await response.json()) as TResponse;
  }

  return {
    get: <TResponse>(path: string, opts: GetOptions = {}) => request<TResponse>('GET', path, opts),
    post: <TResponse>(path: string, body?: unknown, opts: MutationOptions = {}) =>
      request<TResponse>('POST', path, { ...opts, body }),
    put: <TResponse>(path: string, body?: unknown, opts: MutationOptions = {}) =>
      request<TResponse>('PUT', path, { ...opts, body }),
    patch: <TResponse>(path: string, body?: unknown, opts: MutationOptions = {}) =>
      request<TResponse>('PATCH', path, { ...opts, body }),
    delete: <TResponse = void>(path: string, opts: MutationOptions = {}) =>
      request<TResponse>('DELETE', path, opts),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;

export const api = createApiClient();
