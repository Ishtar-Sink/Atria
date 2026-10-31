import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearToasts, getToasts } from '../../../shared/toast/toast-store';
import {
  localToUtc,
  toRequestRule,
  useCreateReminder,
  useDeleteReminder,
  useReminderRows,
  useReminders,
  useUpdateReminder,
  utcToLocal,
  type Reminder,
} from './use-reminders';

function reminder(overrides: Partial<Reminder> & Pick<Reminder, 'id' | 'title'>): Reminder {
  return {
    created_at: '2026-11-01T10:00:00Z',
    updated_at: '2026-11-01T10:00:00Z',
    kind: 'one_off',
    owner_id: 'u1',
    timezone: 'America/Sao_Paulo',
    visibility: 'personal',
    ...overrides,
  };
}

interface Call {
  method: string;
  url: URL;
  body: unknown;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function mockApi(handler: (call: Call) => Response | undefined) {
  const calls: Call[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((input: string, init?: RequestInit) => {
      const call: Call = {
        method: init?.method ?? 'GET',
        url: new URL(input, 'http://localhost'),
        body: typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : undefined,
      };
      calls.push(call);
      return Promise.resolve(handler(call) ?? json({ code: 'not_found', title: 'x' }, 404));
    }),
  );
  return calls;
}

function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-11-05T12:00:00Z') });
  clearToasts();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('useReminders', () => {
  it('lists reminders with filters from the url', async () => {
    const calls = mockApi(() => json({ items: [reminder({ id: 'a', title: 'Beber água' })] }));
    const { wrapper } = setup();
    const { result } = renderHook(() => useReminders({ kind: 'recurring', q: 'água' }), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.data?.pages[0]?.items).toHaveLength(1);
    });
    const params = calls[0]?.url.searchParams;
    expect(params?.get('kind')).toBe('recurring');
    expect(params?.get('q')).toBe('água');
    expect(params?.get('limit')).toBe('100');
  });

  it('sorts rows by next fire and puts the ones without a next fire last', async () => {
    mockApi(() =>
      json({
        items: [
          reminder({ id: 'z', title: 'Sem próximo' }),
          reminder({ id: 'b', title: 'Depois', next_fire_at: '2026-11-07T12:00:00Z' }),
          reminder({ id: 'a', title: 'Antes', next_fire_at: '2026-11-06T12:00:00Z' }),
        ],
      }),
    );
    const { wrapper } = setup();
    const { result } = renderHook(() => useReminderRows({ kind: 'any', q: '' }), { wrapper });

    await waitFor(() => {
      expect(result.current.rows.map((row) => row.id)).toEqual(['a', 'b', 'z']);
    });
  });
});

describe('zoned time', () => {
  it('converts the user wall clock to UTC and back', () => {
    // São Paulo está em UTC-3 em novembro de 2026 (sem horário de verão).
    expect(localToUtc('2026-11-05T09:30', 'America/Sao_Paulo')).toBe('2026-11-05T12:30:00.000Z');
    expect(utcToLocal('2026-11-05T12:30:00Z', 'America/Sao_Paulo')).toBe('2026-11-05T09:30');
    expect(localToUtc('2026-11-05T09:30', 'UTC')).toBe('2026-11-05T09:30:00.000Z');
  });

  it('keeps the rule time as sent when building the request rule', () => {
    const rule = toRequestRule({
      frequency: 'daily',
      interval: 1,
      weekdays: [],
      month_day: null,
      time: '09:30',
      timezone: 'America/Sao_Paulo',
      starts_on: '2026-11-05',
      ends_on: null,
    });
    expect(rule.time).toBe('09:30');
    expect('month_day' in rule).toBe(false);
    expect('ends_on' in rule).toBe(false);
  });
});

describe('reminder mutations', () => {
  it('creates a recurring reminder with time and timezone', async () => {
    const calls = mockApi((call) =>
      call.method === 'POST' ? json(reminder({ id: 'new', title: 'Beber água' }), 201) : undefined,
    );
    const { wrapper } = setup();
    const { result } = renderHook(() => useCreateReminder(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        title: 'Beber água',
        timezone: 'America/Sao_Paulo',
        rule: toRequestRule({
          frequency: 'daily',
          interval: 1,
          weekdays: [],
          month_day: null,
          time: '09:30',
          timezone: 'America/Sao_Paulo',
          starts_on: '2026-11-05',
          ends_on: null,
        }),
      });
    });

    const body = calls[0]?.body as { timezone: string; rule: { time: string; timezone: string } };
    expect(calls[0]?.method).toBe('POST');
    expect(calls[0]?.url.pathname).toBe('/api/v1/reminders');
    expect(body.timezone).toBe('America/Sao_Paulo');
    expect(body.rule.time).toBe('09:30');
    expect(body.rule.timezone).toBe('America/Sao_Paulo');
  });

  it('deletes a reminder optimistically', async () => {
    let release: (value: Response) => void = () => undefined;
    mockApi((call) => {
      if (call.method === 'DELETE') return undefined;
      return json({ items: [reminder({ id: 'a', title: 'Beber água' })] });
    });
    // O DELETE fica preso até a liberação, para ver a lista antes da resposta.
    const base = globalThis.fetch;
    vi.stubGlobal(
      'fetch',
      vi.fn((input: string, init?: RequestInit) =>
        init?.method === 'DELETE'
          ? new Promise<Response>((resolve) => {
              release = resolve;
            })
          : base(input, init),
      ),
    );
    const { wrapper } = setup();
    const list = renderHook(
      () => ({ rows: useReminders({ kind: 'any', q: '' }), remove: useDeleteReminder() }),
      {
        wrapper,
      },
    );
    await waitFor(() => {
      expect(list.result.current.rows.data?.pages[0]?.items).toHaveLength(1);
    });

    act(() => {
      list.result.current.remove.mutate('a');
    });

    await waitFor(() => {
      expect(list.result.current.rows.data?.pages[0]?.items).toHaveLength(0);
    });
    release(new Response(null, { status: 204 }));
  });

  it('rolls back a reminder update when refused', async () => {
    mockApi((call) =>
      call.method === 'PATCH'
        ? json({ code: 'validation_failed', title: 'x' }, 422)
        : json({ items: [reminder({ id: 'a', title: 'Beber água' })] }),
    );
    const { wrapper } = setup();
    const view = renderHook(
      () => ({ rows: useReminders({ kind: 'any', q: '' }), update: useUpdateReminder() }),
      { wrapper },
    );
    await waitFor(() => {
      expect(view.result.current.rows.data?.pages[0]?.items[0]?.title).toBe('Beber água');
    });

    act(() => {
      view.result.current.update.mutate({ id: 'a', body: { title: 'Outro título' } });
    });

    await waitFor(() => {
      expect(getToasts()).toHaveLength(1);
    });
    await waitFor(() => {
      expect(view.result.current.rows.data?.pages[0]?.items[0]?.title).toBe('Beber água');
    });
    expect(getToasts()[0]?.tone).toBe('danger');
  });
});
