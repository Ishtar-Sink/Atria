import { QueryClient, QueryClientProvider, type InfiniteData } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearToasts, getToasts } from '../../shared/toast/toast-store';
import { EMOTIONS_KEY, type EmotionList } from './use-emotions';
import { JOURNAL_KEY, type JournalEntry, type JournalEntryPage } from './use-journal-entries';
import { useCreateJournalEntry } from './use-journal-entry-mutations';

const LIST_KEY = [...JOURNAL_KEY, 'list', null, null, null];

const existing: JournalEntry = {
  id: 'e1',
  owner_id: 'u1',
  occurred_at: '2026-11-04T23:30:00Z',
  text: 'Já existia.',
  emotions: [],
  visibility: 'personal',
  created_at: '2026-11-04T23:31:00Z',
  updated_at: '2026-11-04T23:31:00Z',
};

const emotions: EmotionList = {
  items: [
    {
      id: 'em-joy',
      owner_id: 'u1',
      name: null,
      system_key: 'joy',
      visibility: 'personal',
      created_at: '2026-10-01T10:00:00Z',
      updated_at: '2026-10-01T10:00:00Z',
    },
  ],
};

function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const seed: InfiniteData<JournalEntryPage> = {
    pages: [{ items: [existing] }],
    pageParams: [undefined],
  };
  client.setQueryData(LIST_KEY, seed);
  client.setQueryData(EMOTIONS_KEY, emotions);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const items = () =>
    client.getQueryData<InfiniteData<JournalEntryPage>>(LIST_KEY)?.pages[0]?.items;
  return { client, wrapper, items };
}

const BODY = {
  occurred_at: '2026-11-05T09:00:00-03:00',
  text: 'Nova entrada.',
  emotions: [{ emotion_id: 'em-joy', intensity: 3 }],
};

beforeEach(() => {
  clearToasts();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('journal entry mutations', () => {
  it('adds the entry to the list before the server answers', async () => {
    let answer: (response: Response) => void = () => undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise<Response>((resolve) => (answer = resolve))),
    );
    const { wrapper, items } = setup();
    const { result } = renderHook(() => useCreateJournalEntry(), { wrapper });

    act(() => {
      result.current.mutate(BODY);
    });

    await waitFor(() => {
      expect(items()).toHaveLength(2);
    });
    expect(items()?.[0]).toMatchObject({
      text: 'Nova entrada.',
      emotions: [{ emotion_id: 'em-joy', intensity: 3, system_key: 'joy' }],
    });
    expect(result.current.isSuccess).toBe(false);
    act(() => {
      answer(new Response(JSON.stringify({ ...existing, id: 'e2' }), { status: 201 }));
    });
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
  });

  it('rolls back and shows the undo notice when the server rejects', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ code: 'validation_failed', title: 'x' }), {
            status: 422,
            headers: { 'Content-Type': 'application/json' },
          }),
        ),
      ),
    );
    const { wrapper, items, client } = setup();
    const { result } = renderHook(() => useCreateJournalEntry(), { wrapper });

    act(() => {
      result.current.mutate(BODY);
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    // Sem observadores ativos a consulta não é refeita: o que sobra é o desfazer.
    expect(client.getQueryData(LIST_KEY)).toBeDefined();
    expect(getToasts().map((toast) => toast.message_key)).toContain('journal.undo_notice');
    await waitFor(() => {
      expect(items()?.map((entry) => entry.id)).toEqual(['e1']);
    });
  });
});
