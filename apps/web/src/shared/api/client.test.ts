import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApiClient } from './client';
import { ApiProblem } from './problem';

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

afterEach(() => {
  document.cookie = 'atria_csrf=; expires=Thu, 01 Jan 1970 00:00:00 GMT';
});

describe('createApiClient', () => {
  it('sends the CSRF header from the atria_csrf cookie on mutations', async () => {
    document.cookie = 'atria_csrf=token-123';
    const fetch_mock = vi.fn(() => Promise.resolve(jsonResponse({ ok: true })));
    const client = createApiClient({ fetch: fetch_mock });

    await client.post('/things', { name: 'a' }, { idempotency_key: 'key-1' });

    const [, init] = fetch_mock.mock.calls[0] as unknown as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers['X-CSRF-Token']).toBe('token-123');
    expect(headers['Idempotency-Key']).toBe('key-1');
  });

  it('does not send the CSRF header on GET', async () => {
    document.cookie = 'atria_csrf=token-123';
    const fetch_mock = vi.fn(() => Promise.resolve(jsonResponse({})));
    await createApiClient({ fetch: fetch_mock }).get('/things');

    const [, init] = fetch_mock.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.headers).not.toHaveProperty('X-CSRF-Token');
  });

  it('prefixes paths with /api/v1 and sends same-origin credentials', async () => {
    const fetch_mock = vi.fn(() => Promise.resolve(jsonResponse({})));
    await createApiClient({ fetch: fetch_mock }).get('/things');

    const [url, init] = fetch_mock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/v1/things');
    expect(init.credentials).toBe('same-origin');
  });

  it('serializes query params and JSON bodies', async () => {
    const fetch_mock = vi.fn(() => Promise.resolve(jsonResponse({})));
    const client = createApiClient({ fetch: fetch_mock });

    await client.get('/things', { query: { q: 'a b', tag: ['x', 'y'], skip: undefined } });
    await client.post('/things', { name: 'a' });

    const calls = fetch_mock.mock.calls as unknown as [string, RequestInit][];
    expect(calls[0]?.[0]).toBe('/api/v1/things?q=a+b&tag=x&tag=y');
    expect(calls[1]?.[1].body).toBe('{"name":"a"}');
    expect((calls[1]?.[1].headers as Record<string, string>)['Content-Type']).toBe(
      'application/json',
    );
  });

  it('throws ApiProblem with the stable code on problem+json', async () => {
    const body = {
      title: 'Invalid',
      code: 'validation_failed',
      errors: [{ field: 'name', code: 'required' }],
    };
    const fetch_mock = vi.fn(() =>
      Promise.resolve(
        jsonResponse(body, {
          status: 422,
          headers: { 'Content-Type': 'application/problem+json' },
        }),
      ),
    );

    const failure = await createApiClient({ fetch: fetch_mock })
      .post('/things', {})
      .catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(ApiProblem);
    expect(failure).toMatchObject({
      status: 422,
      code: 'validation_failed',
      errors: [{ field: 'name', code: 'required' }],
    });
  });

  it('throws ApiProblem network_error when fetch fails', async () => {
    const fetch_mock = vi.fn(() => Promise.reject(new TypeError('offline')));
    const failure = await createApiClient({ fetch: fetch_mock })
      .get('/things')
      .catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(ApiProblem);
    expect(failure).toMatchObject({ code: 'network_error' });
  });
});
