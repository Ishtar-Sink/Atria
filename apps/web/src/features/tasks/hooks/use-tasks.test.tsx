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

function rowsApi(items: Task[], occurrences: unknown[]) {
  return ({ url }: Call) =>
    url.pathname === '/api/v1/tasks/occurrences' ? { items: occurrences } : { items };
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

  it('rf38 shows one row per recurring task with the next open occurrence', async () => {
    mockApi(
      rowsApi(
        [
          task({
            id: 'r1',
            title: 'Alongamento',
            is_recurring: true,
            next_occurrence: '2026-11-06',
          }),
        ],
        [
          { task_id: 'r1', occurrence_date: '2026-11-05', completed: true },
          { task_id: 'r1', occurrence_date: '2026-11-06', completed: false },
          { task_id: 'r1', occurrence_date: '2026-11-07', completed: false },
        ],
      ),
    );
    const { wrapper } = setup();
    const { result } = renderHook(() => useTaskRows({ ...TODAY_FILTERS, range: 'week' }), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.rows).toHaveLength(1);
    });
    const [row] = result.current.rows;
    expect(row?.task.id).toBe('r1');
    expect(row?.occurrence_date).toBe('2026-11-06');
    expect(row?.date).toBe('2026-11-06');
    expect(row?.done).toBe(false);
  });

  it('rf38 never duplicates a single task that also comes from the occurrences', async () => {
    mockApi(
      rowsApi(
        [
          task({
            id: 's1',
            title: 'Pagar luz',
            due_on: '2026-11-05',
            next_occurrence: '2026-11-05',
          }),
        ],
        [{ task_id: 's1', occurrence_date: '2026-11-05', completed: false }],
      ),
    );
    const { wrapper } = setup();
    const { result } = renderHook(() => useTaskRows(TODAY_FILTERS), { wrapper });

    await waitFor(() => {
      expect(result.current.is_loading).toBe(false);
    });
    expect(result.current.rows).toHaveLength(1);
    expect(result.current.rows[0]?.task.id).toBe('s1');
    expect(result.current.rows[0]?.occurrence_date).toBeNull();
  });

  it('rf38 keeps today occurrence of a recurring task when the status is all', async () => {
    mockApi(
      rowsApi(
        [
          task({
            id: 'r1',
            title: 'Alongamento',
            is_recurring: true,
            next_occurrence: '2026-11-06',
          }),
        ],
        [{ task_id: 'r1', occurrence_date: '2026-11-05', completed: true }],
      ),
    );
    const { wrapper } = setup();
    const { result } = renderHook(
      () => useTaskRows({ ...TODAY_FILTERS, status: 'all', range: 'week' }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.rows).toHaveLength(1);
    });
    expect(result.current.rows[0]?.done).toBe(true);
    expect(result.current.rows[0]?.date).toBe('2026-11-05');
  });

  it('cb05 uses next_occurrence when there is no occurrence in the window', async () => {
    const api = rowsApi(
      [
        task({
          id: 'r2',
          title: 'Revisão semanal',
          is_recurring: true,
          next_occurrence: '2026-11-20',
        }),
      ],
      [],
    );
    mockApi(api);
    const all = setup();
    const in_all = renderHook(() => useTaskRows({ ...TODAY_FILTERS, range: 'all' }), {
      wrapper: all.wrapper,
    });
    await waitFor(() => {
      expect(in_all.result.current.rows).toHaveLength(1);
    });
    expect(in_all.result.current.rows[0]?.date).toBe('2026-11-20');

    const today = setup();
    const in_today = renderHook(() => useTaskRows(TODAY_FILTERS), { wrapper: today.wrapper });
    await waitFor(() => {
      expect(in_today.result.current.is_loading).toBe(false);
    });
    expect(in_today.result.current.rows).toHaveLength(0);
  });

  it('cb06 hides an ended recurring task from the open ones', async () => {
    mockApi(
      rowsApi(
        [task({ id: 'r3', title: 'Terminada', is_recurring: true, next_occurrence: null })],
        [],
      ),
    );
    const { wrapper } = setup();
    const { result } = renderHook(() => useTaskRows({ ...TODAY_FILTERS, range: 'all' }), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.is_loading).toBe(false);
    });
    expect(result.current.rows).toHaveLength(0);
  });

  it('rf37 counts the open tasks outside the period', async () => {
    const items = [
      task({ id: 's2', title: 'Amanhã', due_on: '2026-11-06', next_occurrence: '2026-11-06' }),
      task({
        id: 'r2',
        title: 'Revisão semanal',
        is_recurring: true,
        next_occurrence: '2026-11-20',
      }),
    ];
    mockApi(rowsApi(items, []));
    const today = setup();
    const in_today = renderHook(() => useTaskRows(TODAY_FILTERS), { wrapper: today.wrapper });
    await waitFor(() => {
      expect(in_today.result.current.hidden_open).toBe(2);
    });

    const all = setup();
    const in_all = renderHook(() => useTaskRows({ ...TODAY_FILTERS, range: 'all' }), {
      wrapper: all.wrapper,
    });
    await waitFor(() => {
      expect(in_all.result.current.is_loading).toBe(false);
    });
    expect(in_all.result.current.hidden_open).toBe(0);

    const done = setup();
    const completed = renderHook(() => useTaskRows({ ...TODAY_FILTERS, status: 'completed' }), {
      wrapper: done.wrapper,
    });
    await waitFor(() => {
      expect(completed.result.current.is_loading).toBe(false);
    });
    expect(completed.result.current.hidden_open).toBe(0);
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
