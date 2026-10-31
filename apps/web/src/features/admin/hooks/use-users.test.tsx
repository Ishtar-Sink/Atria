import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearToasts, getToasts } from '../../../shared/toast/toast-store';
import { useChangeRole, useMe, useToggleActive, useUsers, type AdminUser } from './use-users';

const ana: AdminUser = {
  id: 'u1',
  email: 'ana@casa.test',
  role: 'user',
  is_active: true,
  totp_enabled: false,
  created_at: '2026-10-01T12:00:00Z',
};

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

const filters = { role: 'all', q: '' } as const;

describe('admin users hooks', () => {
  let fetcher: ReturnType<typeof vi.fn<(input: string, init?: RequestInit) => Promise<Response>>>;

  beforeEach(() => {
    fetcher = vi.fn<(input: string, init?: RequestInit) => Promise<Response>>();
    vi.stubGlobal('fetch', fetcher);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearToasts();
  });

  it('reads the role of the viewer from /me', async () => {
    fetcher.mockResolvedValue(json({ id: 'a', email: 'a@x', role: 'elevated' }));
    const { result } = renderHook(() => useMe(), { wrapper: wrapper() });
    await waitFor(() => {
      expect(result.current.data?.role).toBe('elevated');
    });
    expect(fetcher.mock.calls[0]?.[0] ?? '').toBe('/api/v1/me');
  });

  it('lists users with filters from the url', async () => {
    fetcher.mockResolvedValue(json({ items: [ana], next_cursor: null }));
    const { result } = renderHook(() => useUsers({ role: 'elevated', q: ' ana ' }), {
      wrapper: wrapper(),
    });
    await waitFor(() => {
      expect(result.current.data?.pages[0]?.items[0]?.email).toBe('ana@casa.test');
    });
    const url = new URL(fetcher.mock.calls[0]?.[0] ?? '', 'http://x');
    expect(url.pathname).toBe('/api/v1/admin/users');
    expect(url.searchParams.get('role')).toBe('elevated');
    expect(url.searchParams.get('q')).toBe('ana');
    expect(url.searchParams.get('limit')).toBe('20');
    expect(url.searchParams.has('cursor')).toBe(false);
  });

  it('asks for the next page with the cursor', async () => {
    fetcher
      .mockResolvedValueOnce(json({ items: [ana], next_cursor: 'c2' }))
      .mockResolvedValueOnce(json({ items: [], next_cursor: null }));
    const { result } = renderHook(() => useUsers(filters), { wrapper: wrapper() });
    await waitFor(() => {
      expect(result.current.hasNextPage).toBe(true);
    });
    await act(async () => {
      await result.current.fetchNextPage();
    });
    const url = new URL(fetcher.mock.calls[1]?.[0] ?? '', 'http://x');
    expect(url.searchParams.get('cursor')).toBe('c2');
    expect(url.searchParams.has('role')).toBe(false);
  });

  it('grants elevated optimistically', async () => {
    let release: (value: Response) => void = () => undefined;
    fetcher.mockImplementation((_input, init) => {
      if (init?.method === 'PATCH') {
        return new Promise<Response>((resolve) => {
          release = resolve;
        });
      }
      return Promise.resolve(json({ items: [ana], next_cursor: null }));
    });
    const { result } = renderHook(
      () => ({ list: useUsers(filters), role: useChangeRole(filters) }),
      {
        wrapper: wrapper(),
      },
    );
    await waitFor(() => {
      expect(result.current.list.data).toBeDefined();
    });
    act(() => {
      result.current.role.mutate({ id: 'u1', role: 'elevated' });
    });
    await waitFor(() => {
      expect(result.current.list.data?.pages[0]?.items[0]?.role).toBe('elevated');
    });
    const patch = fetcher.mock.calls.find((call) => (call[1] as RequestInit).method === 'PATCH');
    expect(patch?.[0]).toBe('/api/v1/admin/users/u1');
    expect(bodyOf(patch?.[1])).toEqual({ role: 'elevated' });
    act(() => {
      release(json({ ...ana, role: 'elevated' }));
    });
  });

  it('rolls back the toggle when the server refuses', async () => {
    fetcher.mockImplementation((_input, init) =>
      Promise.resolve(
        init?.method === 'PATCH'
          ? json({ code: 'forbidden', title: 'Forbidden' }, 403)
          : json({ items: [ana], next_cursor: null }),
      ),
    );
    const { result } = renderHook(
      () => ({ list: useUsers(filters), toggle: useToggleActive(filters) }),
      { wrapper: wrapper() },
    );
    await waitFor(() => {
      expect(result.current.list.data).toBeDefined();
    });
    act(() => {
      result.current.toggle.mutate({ id: 'u1', is_active: false });
    });
    await waitFor(() => {
      expect(getToasts()).toHaveLength(1);
    });
    await waitFor(() => {
      expect(result.current.list.data?.pages[0]?.items[0]?.is_active).toBe(true);
    });
  });
});
