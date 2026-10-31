import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, renderHook, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionOfferDialog } from './session-offer-dialog';
import { useReadingPosition } from './use-reading-position';
import { todayIn, useReadingSessionOffer, type SessionOffer } from './use-reading-session-offer';

interface Call {
  method: string;
  path: string;
  body: Record<string, unknown>;
}

function stubApi() {
  const calls: Call[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((input: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      const body =
        typeof init?.body === 'string' ? (JSON.parse(init.body) as Record<string, unknown>) : {};
      calls.push({ method, path: input, body });
      const payload = input.endsWith('/reading-sessions')
        ? { id: 's-1' }
        : { page: body.page ?? 40 };
      return Promise.resolve(
        new Response(JSON.stringify(payload), {
          status: method === 'POST' ? 201 : 200,
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

const OFFER: SessionOffer = { from_page: 40, to_page: 62, suggested_pages: 22 };

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-31T02:30:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('useReadingSessionOffer', () => {
  it('pd60 offers 22 pages read when advancing from page 40 to 62', () => {
    stubApi();
    const { result } = renderHook(() => useReadingSessionOffer('book', 'b-1', 40), { wrapper });
    expect(result.current.offer_for(62)).toEqual(OFFER);
  });

  it('pd60 lets the person correct the pages before confirming', async () => {
    const calls = stubApi();
    const { result } = renderHook(() => useReadingSessionOffer('book', 'b-1', 40), { wrapper });
    await result.current.register({ offer: OFFER, pages_read: 30 });
    const post = calls.find((call) => call.method === 'POST');
    expect(post?.body.pages_read).toBe(30);
  });

  it('pd60 sends pages_read and read_on with the range only when the pages were not corrected', async () => {
    const calls = stubApi();
    const { result } = renderHook(() => useReadingSessionOffer('book', 'b-1', 40), { wrapper });
    await result.current.register({ offer: OFFER, pages_read: 22 });
    await result.current.register({ offer: OFFER, pages_read: 30 });
    const posts = calls.filter((call) => call.method === 'POST');
    expect(posts[0]?.path).toBe('/api/v1/books/b-1/reading-sessions');
    // 02:30 UTC de 31/10 ainda é 30/10 em São Paulo.
    expect(posts[0]?.body).toEqual({
      pages_read: 22,
      read_on: '2026-10-30',
      from_page: 40,
      to_page: 62,
    });
    expect(posts[1]?.body).toEqual({ pages_read: 30, read_on: '2026-10-30' });
  });

  it('pd60 rejects zero pages inside the dialog with role alert', async () => {
    const user = userEvent.setup();
    const confirm = vi.fn();
    render(
      <SessionOfferDialog
        offer={OFFER}
        is_pending={false}
        has_error={false}
        onConfirm={confirm}
        onSkip={() => undefined}
      />,
    );
    expect(screen.getByText(/da página 40 até a 62/)).toBeInTheDocument();
    const field = screen.getByLabelText('Páginas lidas');
    expect(field).toHaveValue(22);
    await user.clear(field);
    await user.type(field, '0');
    await user.click(screen.getByRole('button', { name: 'Registrar sessão' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('maior que zero');
    expect(confirm).not.toHaveBeenCalled();
  });

  it('does not offer when the reader did not advance', () => {
    stubApi();
    const { result } = renderHook(() => useReadingSessionOffer('book', 'b-1', 40), { wrapper });
    expect(result.current.offer_for(40)).toBeNull();
  });

  it('does not offer when closing before the opening page', () => {
    stubApi();
    const { result } = renderHook(() => useReadingSessionOffer('book', 'b-1', 40), { wrapper });
    expect(result.current.offer_for(10)).toBeNull();
  });

  it('never offers for an article', () => {
    stubApi();
    const { result } = renderHook(() => useReadingSessionOffer('article', 'a-1', 1), { wrapper });
    expect(result.current.offer_for(30)).toBeNull();
  });

  it('registers the session only after confirmation', () => {
    const calls = stubApi();
    const { result } = renderHook(() => useReadingSessionOffer('book', 'b-1', 40), { wrapper });
    result.current.offer_for(62);
    expect(calls.filter((call) => call.method === 'POST')).toHaveLength(0);
  });

  it('dec004 saves the closing page whether the session is confirmed or skipped', async () => {
    const calls = stubApi();
    const { result } = renderHook(() => useReadingPosition('book', 'b-1'), { wrapper });
    await waitFor(() => {
      expect(result.current.initial_page).toBe(40);
    });
    await result.current.save_closing(62);
    const closing = calls.filter((call) => call.method === 'PUT');
    expect(closing).toHaveLength(1);
    expect(closing[0]?.body).toEqual({ page: 62 });
    // Recusar a sessão não muda nada: o fechamento já guardou a página 62.
    expect(calls.filter((call) => call.method === 'POST')).toHaveLength(0);
  });

  it('dec004 confirming the session does not change the resume page', async () => {
    const calls = stubApi();
    const { result } = renderHook(
      () => ({
        position: useReadingPosition('book', 'b-1'),
        session: useReadingSessionOffer('book', 'b-1', 40),
      }),
      { wrapper },
    );
    await waitFor(() => {
      expect(result.current.position.initial_page).toBe(40);
    });
    await result.current.position.save_closing(62);
    await result.current.session.register({ offer: OFFER, pages_read: 22 });
    const puts = calls.filter((call) => call.method === 'PUT');
    expect(puts).toHaveLength(1);
    const post = calls.find((call) => call.method === 'POST');
    expect(post?.body).not.toHaveProperty('page');
    expect(post?.body).not.toHaveProperty('last_read_page');
  });

  it('formats today in the time zone of the person', () => {
    expect(todayIn('Asia/Tokyo', new Date('2026-10-31T20:00:00Z'))).toBe('2026-11-01');
  });
});
