import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  useCreateTask,
  useDeleteTask,
  useTaskRows,
  useTasks,
  useUpdateTask,
  type Task,
  type TaskFilters,
} from './use-tasks';

const TODAY_FILTERS: TaskFilters = {
  status: 'open',
  recurring: 'any',
  label: '',
  range: 'today',
  q: '',
};

function task(overrides: Partial<Task> & Pick<Task, 'id' | 'title'>): Task {
  return {
    created_at: '2026-11-01T10:00:00Z',
    updated_at: '2026-11-01T10:00:00Z',
    is_recurring: false,
    labels: [],
    owner_id: 'u1',
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

function mockApi(handler: (call: Call) => unknown) {
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
      const result = handler(call);
      if (result instanceof Promise) return result.then((value: unknown) => json(value));
      return Promise.resolve(
        result === undefined ? json({ code: 'not_found', title: 'x' }, 404) : json(result),
      );
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
  // Só o `Date` é fixado, para o React Query seguir com os timers reais.
  vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-11-05T12:00:00Z') });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('useTaskRows', () => {
  it('lists today tasks in the user timezone', async () => {
    // 01:30 UTC de 6/11 ainda é 5/11 em São Paulo.
    vi.setSystemTime(new Date('2026-11-06T01:30:00Z'));
    const calls = mockApi(({ url }) => {
      if (url.pathname === '/api/v1/tasks') {
        return {
          items: [
            task({ id: 'a', title: 'Hoje no fuso', due_on: '2026-11-05' }),
            task({ id: 'b', title: 'Amanhã', due_on: '2026-11-06' }),
          ],
        };
      }
      return { items: [] };
    });
    const { wrapper } = setup();
    const { result } = renderHook(() => useTaskRows(TODAY_FILTERS), { wrapper });

    await waitFor(() => {
      expect(result.current.rows.map((row) => row.task.title)).toEqual(['Hoje no fuso']);
    });
    const occurrences = calls.find((call) => call.url.pathname === '/api/v1/tasks/occurrences');
    expect(occurrences?.url.searchParams.get('from')).toBe('2026-11-05');
    expect(occurrences?.url.searchParams.get('to')).toBe('2026-11-05');
  });

  it('dec006 sends the label filter to the server', async () => {
    const calls = mockApi(() => ({ items: [] }));
    const { wrapper } = setup();
    const { result } = renderHook(() => useTasks({ ...TODAY_FILTERS, label: 'casa' }), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(calls[0]?.url.searchParams.get('label')).toBe('casa');
  });

  it('merges recurring occurrences by task id', async () => {
    mockApi(({ url }) => {
      if (url.pathname === '/api/v1/tasks/occurrences') {
        return {
          items: [
            { task_id: 'r1', occurrence_date: '2026-11-05', completed: true },
            { task_id: 'r1', occurrence_date: '2026-11-06', completed: false },
            { task_id: 'gone', occurrence_date: '2026-11-05', completed: false },
          ],
        };
      }
      return {
        items: [
          task({ id: 'r1', title: 'Alongamento', is_recurring: true }),
          task({ id: 's1', title: 'Pagar luz', due_on: '2026-11-04' }),
        ],
      };
    });
    const { wrapper } = setup();
    const { result } = renderHook(
      () => useTaskRows({ ...TODAY_FILTERS, status: 'all', range: 'week' }),
      {
        wrapper,
      },
    );

    await waitFor(() => {
      expect(result.current.rows).toHaveLength(3);
    });
    const keys = result.current.rows.map(
      (row) => `${row.task.title}|${row.occurrence_date ?? '-'}|${String(row.done)}`,
    );
    // A pontual vencida segue aberta na lista; na lista as abertas vêm antes das feitas.
    expect(keys).toEqual([
      'Pagar luz|-|false',
      'Alongamento|2026-11-06|false',
      'Alongamento|2026-11-05|true',
    ]);
  });

  it('recurring occurrences start today', async () => {
    const calls = mockApi(() => ({ items: [] }));
    const { wrapper } = setup();
    const { result } = renderHook(() => useTaskRows({ ...TODAY_FILTERS, range: 'week' }), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.is_loading).toBe(false);
    });
    const occurrences = calls.find((call) => call.url.pathname === '/api/v1/tasks/occurrences');
    expect(occurrences?.url.searchParams.get('from')).toBe('2026-11-05');
    expect(occurrences?.url.searchParams.get('to')).toBe('2026-11-11');
  });
});

describe('task mutations', () => {
  it('creates a daily recurring task', async () => {
    const calls = mockApi(() => task({ id: 'n1', title: 'Alongamento', is_recurring: true }));
    const { wrapper } = setup();
    const { result } = renderHook(() => useCreateTask(), { wrapper });
    const recurrence = {
      frequency: 'daily' as const,
      interval: 1,
      timezone: 'America/Sao_Paulo',
      starts_on: '2026-11-05',
      time: '08:00',
    };

    await act(() => result.current.mutateAsync({ title: 'Alongamento', recurrence }));

    expect(calls[0]?.method).toBe('POST');
    expect(calls[0]?.body).toMatchObject({ title: 'Alongamento', recurrence });
  });

  it('updates a recurrence only from this occurrence on', async () => {
    const calls = mockApi(() => task({ id: 'r1', title: 'Alongamento', is_recurring: true }));
    const { wrapper } = setup();
    const { result } = renderHook(() => useUpdateTask(), { wrapper });

    await act(() =>
      result.current.mutateAsync({
        id: 'r1',
        body: {
          effective_from: '2026-11-07',
          recurrence: {
            frequency: 'weekly',
            interval: 1,
            weekdays: ['mon'],
            timezone: 'America/Sao_Paulo',
            starts_on: '2026-11-07',
            time: '08:00',
          },
        },
      }),
    );

    expect(calls[0]?.method).toBe('PATCH');
    expect(calls[0]?.url.pathname).toBe('/api/v1/tasks/r1');
    expect(calls[0]?.body).toMatchObject({ effective_from: '2026-11-07' });
  });

  it('deletes a task optimistically', async () => {
    let release: (value: unknown) => void = () => undefined;
    const pending = new Promise<unknown>((resolve) => {
      release = resolve;
    });
    mockApi(({ method }) => {
      if (method === 'DELETE') return pending;
      return { items: [task({ id: 'a', title: 'Pagar luz' })] };
    });
    const { wrapper } = setup();
    const { result } = renderHook(
      () => ({
        rows: useTaskRows({ ...TODAY_FILTERS, recurring: 'single' }),
        del: useDeleteTask(),
      }),
      { wrapper },
    );
    await waitFor(() => {
      expect(result.current.rows.rows).toHaveLength(1);
    });

    act(() => {
      result.current.del.mutate('a');
    });

    // O servidor ainda não respondeu e a tarefa já saiu da lista.
    await waitFor(() => {
      expect(result.current.rows.rows).toHaveLength(0);
    });
    release(null);
  });
});
