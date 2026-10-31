import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearToasts, getToasts } from '../../../shared/toast/toast-store';
import { dashboardFixtures, installFakeApi, NOW, problem } from './fake-api';
import {
  useCompleteTask,
  useMoneyBlock,
  useTodayReminders,
  useTodayTasks,
  useUpcomingDays,
} from './use-dashboard-data';

function wrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(NOW));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  clearToasts();
});

describe('useTodayTasks', () => {
  it('asks for today tasks with the overdue ones in the user timezone', async () => {
    const api = installFakeApi(dashboardFixtures());
    const { result } = renderHook(() => useTodayTasks(true), { wrapper: wrapper() });
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    const occurrences = api.to('GET', '/tasks/occurrences')[0];
    expect(occurrences?.query.get('from')).toBe('2026-11-05');
    expect(occurrences?.query.get('to')).toBe('2026-11-05');
    const open = api.to('GET', '/tasks').find((call) => call.query.get('due_to') !== null);
    expect(open?.query.get('status')).toBe('open');
    // Vencidas primeiro, depois as de hoje, depois a ocorrência da recorrente.
    expect(result.current.data?.items.map((item) => item.title)).toEqual([
      'Pagar o IPTU',
      'Ligar para a escola',
      'Beber água',
    ]);
    expect(result.current.data?.items[0]?.overdue).toBe(true);
  });

  it('counts the tasks of the day including the completed ones', async () => {
    installFakeApi(dashboardFixtures());
    const { result } = renderHook(() => useTodayTasks(true), { wrapper: wrapper() });
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    // daily + done + today1 + late
    expect(result.current.data?.total_today).toBe(4);
  });

  it('completes a task optimistically and removes it from the block', async () => {
    const api = installFakeApi(dashboardFixtures());
    const { result } = renderHook(() => ({ tasks: useTodayTasks(true), done: useCompleteTask() }), {
      wrapper: wrapper(),
    });
    await waitFor(() => {
      expect(result.current.tasks.isSuccess).toBe(true);
    });
    const late = result.current.tasks.data?.items[0];
    expect(late).toBeDefined();
    api.set('POST /tasks/late/completion', () => new Promise(() => undefined));
    act(() => {
      if (late) result.current.done.mutate(late);
    });
    await waitFor(() => {
      expect(result.current.tasks.data?.items.map((item) => item.task_id)).not.toContain('late');
    });
    expect(result.current.tasks.data?.total_today).toBe(4);
    // Regressão (TASK-35): sem corpo JSON o servidor responde 422 e a tarefa voltava.
    const post = api.to('POST', '/tasks/late/completion')[0];
    expect(post?.body).toEqual({});
  });

  it('sends today as the occurrence date of a daily task', async () => {
    const api = installFakeApi(dashboardFixtures());
    const { result } = renderHook(() => ({ tasks: useTodayTasks(true), done: useCompleteTask() }), {
      wrapper: wrapper(),
    });
    await waitFor(() => {
      expect(result.current.tasks.isSuccess).toBe(true);
    });
    const daily = result.current.tasks.data?.items.find((item) => item.recurring);
    act(() => {
      if (daily) result.current.done.mutate(daily);
    });
    await waitFor(() => {
      expect(api.to('POST', '/tasks/daily/completion')).toHaveLength(1);
    });
    expect(api.to('POST', '/tasks/daily/completion')[0]?.body).toEqual({
      occurrence_date: '2026-11-05',
    });
  });

  it('brings the task back and warns when the completion is refused', async () => {
    const fixtures = dashboardFixtures();
    fixtures['POST /tasks/late/completion'] = () => problem(500, 'generic');
    installFakeApi(fixtures);
    const { result } = renderHook(() => ({ tasks: useTodayTasks(true), done: useCompleteTask() }), {
      wrapper: wrapper(),
    });
    await waitFor(() => {
      expect(result.current.tasks.isSuccess).toBe(true);
    });
    const late = result.current.tasks.data?.items[0];
    act(() => {
      if (late) result.current.done.mutate(late);
    });
    await waitFor(() => {
      expect(getToasts()).toHaveLength(1);
    });
    await waitFor(() => {
      expect(result.current.tasks.data?.items.map((item) => item.task_id)).toContain('late');
    });
  });
});

describe('useTodayReminders', () => {
  it('groups today reminders into morning, afternoon and night', async () => {
    const api = installFakeApi(dashboardFixtures());
    const { result } = renderHook(() => useTodayReminders(true), { wrapper: wrapper() });
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    const call = api.to('GET', '/reminders/upcoming')[0];
    // O dia local de São Paulo (UTC-3) em UTC.
    expect(call?.query.get('from')).toBe('2026-11-05T03:00:00.000Z');
    expect(call?.query.get('to')).toBe('2026-11-06T02:59:59.999Z');
    expect(result.current.data?.items.map((item) => [item.title, item.period])).toEqual([
      ['Remédio', 'morning'],
      ['Reunião', 'afternoon'],
      ['Alongar', 'night'],
      ['Dormir cedo', 'night'],
    ]);
    expect(result.current.data?.total).toBe(4);
  });
});

describe('useUpcomingDays', () => {
  it('joins upcoming transactions and reminders of the next seven days up to five', async () => {
    const fixtures = dashboardFixtures();
    fixtures['GET /reminders/upcoming'] = () => ({
      items: Array.from({ length: 5 }, (_, index) => ({
        reminder_id: `x${String(index)}`,
        title: `Lembrete ${String(index)}`,
        fire_at: `2026-11-09T1${String(index)}:00:00Z`,
      })),
    });
    const api = installFakeApi(fixtures);
    const { result } = renderHook(() => useUpcomingDays(true), { wrapper: wrapper() });
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    const tx = api.to('GET', '/transactions')[0];
    expect(tx?.query.get('settled')).toBe('false');
    expect(tx?.query.get('from')).toBe('2026-11-06');
    expect(tx?.query.get('to')).toBe('2026-11-12');
    expect(result.current.data).toHaveLength(5);
    expect(result.current.data?.map((item) => item.title).slice(0, 2)).toEqual([
      'Streaming',
      'Internet',
    ]);
  });

  it('links forecast items to their recurrence', async () => {
    installFakeApi(dashboardFixtures());
    const { result } = renderHook(() => useUpcomingDays(true), { wrapper: wrapper() });
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    const hrefs = result.current.data?.map((item) => item.href) ?? [];
    expect(hrefs).toContain('/finance/recurring-transactions/rec2');
    expect(hrefs).toContain('/finance/transactions/tx1');
    expect(hrefs).toContain('/reminders/r9');
  });
});

describe('useMoneyBlock', () => {
  it('reads the money block from the financial summary', async () => {
    const api = installFakeApi(dashboardFixtures());
    const { result } = renderHook(() => useMoneyBlock(true), { wrapper: wrapper() });
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    const summaries = api.to('GET', '/financial-summaries');
    expect(summaries.map((call) => [call.query.get('from'), call.query.get('to')])).toEqual([
      ['2026-11-01', '2026-11-30'],
      ['2026-12-01', '2026-12-31'],
    ]);
    const data = result.current;
    expect(data.data?.total).toBe(1234500);
    expect(data.data?.accounts.map((account) => account.amount)).toEqual([1000000, 234500]);
    expect(data.data?.month_left).toEqual({ income: 500000, expense: 200000 });
    expect(data.data?.next_month).toMatchObject({
      income: 800000,
      expense: 450000,
      surplus: 350000,
    });
  });

  it('asks for the next month bills with the recurring forecasts', async () => {
    const api = installFakeApi(dashboardFixtures());
    const { result } = renderHook(() => useMoneyBlock(true), { wrapper: wrapper() });
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    const bills = api.to('GET', '/transactions')[0];
    expect(bills?.query.get('kind')).toBe('expense');
    expect(bills?.query.get('settled')).toBe('false');
    expect(bills?.query.get('from')).toBe('2026-12-01');
    expect(bills?.query.get('to')).toBe('2026-12-31');
    expect(bills?.query.get('limit')).toBe('5');
    expect(result.current.data?.bills[0]?.title).toBe('Aluguel');
    expect(result.current.data?.has_more_bills).toBe(true);
  });
});

describe('hidden blocks', () => {
  it('does not fetch hidden blocks', () => {
    const api = installFakeApi(dashboardFixtures());
    renderHook(
      () => ({
        a: useTodayTasks(false),
        b: useTodayReminders(false),
        c: useUpcomingDays(false),
        d: useMoneyBlock(false),
      }),
      { wrapper: wrapper() },
    );
    expect(api.calls).toHaveLength(0);
  });
});
