import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiProblem } from './problem';
import { createQueryClient } from './query-client';

function rejectWith(code: string) {
  return () => Promise.reject(new ApiProblem({ status: 401, code, title: 'x' }));
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('createQueryClient session handling', () => {
  it('invalidates the session when a query answers 401 unauthenticated', async () => {
    const client = createQueryClient();
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    await client
      .query({ queryKey: ['notes'], queryFn: rejectWith('unauthenticated') })
      .catch(() => undefined);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['me'], exact: true });
  });

  it('invalidates the session when a mutation answers 401 unauthenticated', async () => {
    const client = createQueryClient();
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    await client
      .getMutationCache()
      .build(client, { mutationFn: rejectWith('unauthenticated') })
      .execute(undefined)
      .catch(() => undefined);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['me'], exact: true });
  });

  it('ignores the 401 of the session query itself', async () => {
    const client = createQueryClient();
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    await client
      .query({ queryKey: ['me'], queryFn: rejectWith('unauthenticated') })
      .catch(() => undefined);
    expect(invalidate).not.toHaveBeenCalled();
  });

  it('ignores a 401 with another code', async () => {
    const client = createQueryClient();
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    await client
      .query({ queryKey: ['notes'], queryFn: rejectWith('invalid_credentials') })
      .catch(() => undefined);
    expect(invalidate).not.toHaveBeenCalled();
  });
});
