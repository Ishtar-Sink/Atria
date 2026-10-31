import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearToasts, getToasts } from '../../../shared/toast/toast-store';
import { useCreateInvite, useInviteRequired } from './use-invites';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': status >= 400 ? 'application/problem+json' : 'application/json' },
  });
}

function bodyOf(init: RequestInit | undefined): unknown {
  return JSON.parse(init?.body as string);
}

function wrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

describe('invite hooks', () => {
  let fetcher: ReturnType<typeof vi.fn<(input: string, init?: RequestInit) => Promise<Response>>>;

  beforeEach(() => {
    fetcher = vi.fn<(input: string, init?: RequestInit) => Promise<Response>>();
    vi.stubGlobal('fetch', fetcher);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearToasts();
  });

  it('creates an invite link', async () => {
    fetcher.mockResolvedValue(
      json(
        { id: 'i1', link: 'https://atria.test/convite/abc', expires_at: '2026-11-07T00:00:00Z' },
        201,
      ),
    );
    const { result } = renderHook(() => useCreateInvite(), { wrapper: wrapper() });
    let invite: { link: string } | undefined;
    await act(async () => {
      invite = await result.current.mutateAsync();
    });
    expect(invite?.link).toBe('https://atria.test/convite/abc');
    expect(fetcher.mock.calls[0]?.[0]).toBe('/api/v1/admin/invites');
    expect((fetcher.mock.calls[0]?.[1] as RequestInit).method).toBe('POST');
  });

  it('turns off the invite requirement optimistically', async () => {
    let release: (value: Response) => void = () => undefined;
    fetcher.mockImplementation((_input, init) => {
      if (init?.method === 'PATCH') {
        return new Promise<Response>((resolve) => {
          release = resolve;
        });
      }
      return Promise.resolve(json({ invite_required: true, web_push_enabled: false }));
    });
    const { result } = renderHook(() => useInviteRequired(true), { wrapper: wrapper() });
    await waitFor(() => {
      expect(result.current.query.data?.invite_required).toBe(true);
    });
    act(() => {
      result.current.mutation.mutate(false);
    });
    await waitFor(() => {
      expect(result.current.query.data?.invite_required).toBe(false);
    });
    const patch = fetcher.mock.calls.find((call) => (call[1] as RequestInit).method === 'PATCH');
    expect(bodyOf(patch?.[1])).toEqual({
      invite_required: false,
    });
    act(() => {
      release(json({ invite_required: false, web_push_enabled: false }));
    });
  });

  it('puts the requirement back with a notice when the server refuses', async () => {
    fetcher.mockImplementation((_input, init) =>
      Promise.resolve(
        init?.method === 'PATCH'
          ? json({ code: 'forbidden', title: 'Forbidden' }, 403)
          : json({ invite_required: true, web_push_enabled: false }),
      ),
    );
    const { result } = renderHook(() => useInviteRequired(true), { wrapper: wrapper() });
    await waitFor(() => {
      expect(result.current.query.data?.invite_required).toBe(true);
    });
    act(() => {
      result.current.mutation.mutate(false);
    });
    await waitFor(() => {
      expect(getToasts()).toHaveLength(1);
    });
    await waitFor(() => {
      expect(result.current.query.data?.invite_required).toBe(true);
    });
  });

  it('does not read the settings when disabled', () => {
    renderHook(() => useInviteRequired(false), { wrapper: wrapper() });
    expect(fetcher).not.toHaveBeenCalled();
  });
});
