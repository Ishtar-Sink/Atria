import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearToasts, getToasts } from '../../../shared/toast/toast-store';
import { useCompleteTask, useReopenTask } from './use-task-completion';
import { useTaskRows, type Task, type TaskFilters } from './use-tasks';

const FILTERS: TaskFilters = {
  status: 'all',
  recurring: 'any',
  label: '',
  range: 'week',
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

/** O servidor de mentira: `respond` decide a resposta das mutações; a lista vem de `state`. */
function mockServer(
  state: { single_done: boolean; today_done: boolean },
  respond: (call: Call) => Promise<Response> | Response,
) {
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
      if (call.method !== 'GET') return Promise.resolve(respond(call));
      if (call.url.pathname === '/api/v1/tasks/occurrences') {
        return Promise.resolve(
          json({
            items: [
              { task_id: 'r1', occurrence_date: '2026-11-05', completed: state.today_done },
              { task_id: 'r1', occurrence_date: '2026-11-06', completed: false },
            ],
          }),
        );
      }
      return Promise.resolve(
        json({
          items: [
            task({
              id: 's1',
              title: 'Pagar luz',
              completed_at: state.single_done ? '2026-11-05T12:00:00Z' : null,
            }),
            task({ id: 'r1', title: 'Alongamento', is_recurring: true }),
          ],
        }),
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
  return renderHook(
    () => ({ list: useTaskRows(FILTERS), complete: useCompleteTask(), reopen: useReopenTask() }),
    { wrapper },
  );
}

const row = (rows: ReturnType<typeof useTaskRows>['rows'], key: string) =>
  rows.find((item) => item.key === key);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-11-05T12:00:00Z') });
  clearToasts();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('task completion', () => {
  it('completes and reopens a single task', async () => {
    const state = { single_done: false, today_done: false };
    const calls = mockServer(state, (call) => {
      state.single_done = call.method === 'POST';
      return json({ task_id: 's1', completed: state.single_done });
    });
    const { result } = setup();
    await waitFor(() => {
      expect(row(result.current.list.rows, 's1')?.done).toBe(false);
    });

    act(() => {
      result.current.complete.mutate({ task: { id: 's1', is_recurring: false } });
    });
    await waitFor(() => {
      expect(row(result.current.list.rows, 's1')?.done).toBe(true);
    });
    expect(calls.find((call) => call.method === 'POST')?.url.pathname).toBe(
      '/api/v1/tasks/s1/completion',
    );

    act(() => {
      result.current.reopen.mutate({ task: { id: 's1', is_recurring: false } });
    });
    await waitFor(() => {
      expect(row(result.current.list.rows, 's1')?.done).toBe(false);
    });
    expect(calls.some((call) => call.method === 'DELETE')).toBe(true);
  });

  it('completes only today occurrence of a daily task', async () => {
    const state = { single_done: false, today_done: false };
    const calls = mockServer(state, () => {
      state.today_done = true;
      return json({ task_id: 'r1', completed: true, occurrence_date: '2026-11-05' });
    });
    const { result } = setup();
    await waitFor(() => {
      expect(row(result.current.list.rows, 'r1:2026-11-05')).toBeDefined();
    });

    act(() => {
      result.current.complete.mutate({
        task: { id: 'r1', is_recurring: true },
        occurrence_date: '2026-11-05',
      });
    });

    await waitFor(() => {
      expect(row(result.current.list.rows, 'r1:2026-11-05')?.done).toBe(true);
    });
    const own = result.current.list.rows.filter((item) => item.task.id === 'r1');
    expect(own).toHaveLength(1);
    expect(own[0]?.done).toBe(true);
    expect(calls.find((call) => call.method === 'POST')?.body).toEqual({
      occurrence_date: '2026-11-05',
    });
  });

  it('rolls back the completion and warns when refused', async () => {
    const state = { single_done: false, today_done: false };
    mockServer(state, () =>
      json({ code: 'occurrence_in_past', title: 'Ocorrência no passado' }, 422),
    );
    const { result } = setup();
    await waitFor(() => {
      expect(row(result.current.list.rows, 'r1:2026-11-05')).toBeDefined();
    });

    act(() => {
      result.current.complete.mutate({
        task: { id: 'r1', is_recurring: true },
        occurrence_date: '2026-11-05',
      });
    });

    await waitFor(() => {
      expect(getToasts().map((toast) => toast.message_key)).toContain(
        'tasks.completion.occurrence_in_past',
      );
    });
    await waitFor(() => {
      expect(row(result.current.list.rows, 'r1:2026-11-05')?.done).toBe(false);
    });
  });
});
