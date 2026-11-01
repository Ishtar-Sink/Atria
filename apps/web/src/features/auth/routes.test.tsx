import { waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mockApi, renderAuthRoute } from './test-server';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('auth routes', () => {
  it('takes a signed-in person out of the sign-in screen', async () => {
    mockApi({
      'GET /setup': { status: 200, body: { required: false } },
      'GET /me': { status: 200, body: { id: 'u1', email: 'a@b.c' } },
    });
    const { router } = renderAuthRoute('/sign-in');
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/');
    });
  });
});
