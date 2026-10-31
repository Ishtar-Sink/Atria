import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useReadingPosition } from './use-reading-position';

interface Call {
  method: string;
  path: string;
  body: Record<string, unknown>;
}

function stubApi(page: number | null) {
  const calls: Call[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((input: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      const body =
        typeof init?.body === 'string' ? (JSON.parse(init.body) as Record<string, unknown>) : {};
      calls.push({ method, path: input, body });
      const payload = method === 'PUT' ? { page: body.page } : { page };
      return Promise.resolve(
        new Response(JSON.stringify(payload), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    }),
  );
  return calls;
}

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useReadingPosition', () => {
  it('opens at the last read page of a book', async () => {
    const calls = stubApi(12);
    const { result } = renderHook(() => useReadingPosition('book', 'b-1'), { wrapper });
    await waitFor(() => {
      expect(result.current.initial_page).toBe(12);
    });
    expect(calls[0]?.path).toBe('/api/v1/books/b-1/reading-position');
  });

  it('opens at the last read page of an article', async () => {
    const calls = stubApi(7);
    const { result } = renderHook(() => useReadingPosition('article', 'a-1'), { wrapper });
    await waitFor(() => {
      expect(result.current.initial_page).toBe(7);
    });
    expect(calls[0]?.path).toBe('/api/v1/articles/a-1/reading-position');
  });

  it('opens at the first page when there is no saved position', async () => {
    stubApi(null);
    const { result } = renderHook(() => useReadingPosition('book', 'b-1'), { wrapper });
    await waitFor(() => {
      expect(result.current.initial_page).toBe(1);
    });
  });

  it('saves the closing page even when it is before the opening page', async () => {
    const calls = stubApi(12);
    const { result } = renderHook(() => useReadingPosition('book', 'b-1'), { wrapper });
    await waitFor(() => {
      expect(result.current.initial_page).toBe(12);
    });
    await result.current.save_closing(5);
    const puts = calls.filter((call) => call.method === 'PUT');
    expect(puts).toHaveLength(1);
    expect(puts[0]?.path).toBe('/api/v1/books/b-1/reading-position');
    expect(puts[0]?.body).toEqual({ page: 5 });
  });
});
