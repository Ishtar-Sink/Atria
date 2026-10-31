import { vi } from 'vitest';

export interface FakeCall {
  method: string;
  path: string;
  query: URLSearchParams;
  body: unknown;
}

export type FakeHandler = (call: FakeCall) => unknown;

export interface FakeApi {
  calls: FakeCall[];
  /** Chamadas de um método e caminho (sem `/api/v1`). */
  to: (method: string, path: string) => FakeCall[];
  set: (key: string, handler: FakeHandler) => void;
}

/** Troca o `fetch` por um servidor falso: a chave é `MÉTODO /caminho`. */
export function installFakeApi(handlers: Record<string, FakeHandler>): FakeApi {
  const table = new Map(Object.entries(handlers));
  const calls: FakeCall[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(input instanceof Request ? input.url : String(input), 'http://localhost');
      const call: FakeCall = {
        method: init?.method ?? 'GET',
        path: url.pathname.replace('/api/v1', ''),
        query: url.searchParams,
        body: typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : undefined,
      };
      calls.push(call);
      const handler = table.get(`${call.method} ${call.path}`);
      if (handler === undefined) {
        return Promise.resolve(
          new Response(JSON.stringify({ code: 'not_found' }), { status: 404 }),
        );
      }
      try {
        const result = handler(call);
        if (result instanceof Response) return Promise.resolve(result);
        if (result instanceof Promise) return result as Promise<Response>;
        return Promise.resolve(
          new Response(JSON.stringify(result), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        );
      } catch (error) {
        return Promise.reject(error instanceof Error ? error : new Error('fake api'));
      }
    }),
  );
  return {
    calls,
    to: (method, path) => calls.filter((call) => call.method === method && call.path === path),
    set: (key, handler) => {
      table.set(key, handler);
    },
  };
}

export function problem(status: number, code: string): Response {
  return new Response(JSON.stringify({ code, title: code }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** 2026-11-05T12:00 em America/Sao_Paulo. */
export const NOW = '2026-11-05T15:00:00Z';

const flow = (realized: number, forecast: number) => ({ realized, forecast });

/** Dados de um dia cheio: o servidor falso padrão dos testes do dashboard. */
export function dashboardFixtures(): Record<string, FakeHandler> {
  return {
    'GET /me': () => ({ id: 'u1', email: 'ana@exemplo.com', display_name: 'Ana Maria Souza' }),
    'GET /tasks/occurrences': () => ({
      items: [
        { task_id: 'daily', occurrence_date: '2026-11-05', completed: false },
        { task_id: 'done', occurrence_date: '2026-11-05', completed: true },
        { task_id: 'today1', occurrence_date: '2026-11-05', completed: false },
      ],
    }),
    'GET /tasks': (call) =>
      call.query.get('recurring') === 'true'
        ? { items: [{ id: 'daily', title: 'Beber água', is_recurring: true }] }
        : {
            items: [
              { id: 'late', title: 'Pagar o IPTU', is_recurring: false, due_on: '2026-11-03' },
              {
                id: 'today1',
                title: 'Ligar para a escola',
                is_recurring: false,
                due_on: '2026-11-05',
              },
            ],
          },
    'POST /tasks/late/completion': () => ({ task_id: 'late', completed: true }),
    'POST /tasks/daily/completion': () => ({ task_id: 'daily', completed: true }),
    'GET /reminders/upcoming': (call) =>
      call.query.get('from')?.startsWith('2026-11-05')
        ? {
            items: [
              { reminder_id: 'r3', title: 'Dormir cedo', fire_at: '2026-11-06T01:30:00Z' },
              { reminder_id: 'r1', title: 'Remédio', fire_at: '2026-11-05T11:00:00Z' },
              { reminder_id: 'r2', title: 'Reunião', fire_at: '2026-11-05T17:00:00Z' },
              { reminder_id: 'r4', title: 'Alongar', fire_at: '2026-11-05T22:00:00Z' },
            ],
          }
        : { items: [{ reminder_id: 'r9', title: 'Aniversário', fire_at: '2026-11-07T13:00:00Z' }] },
    'GET /transactions': (call) =>
      call.query.get('kind') === 'expense'
        ? {
            items: [
              {
                id: null,
                recurrence_id: 'rec1',
                occurrence_date: '2026-12-05',
                kind: 'expense',
                description: 'Aluguel',
                expected_amount: 150000,
                expected_date: '2026-12-05',
                currency: 'BRL',
              },
            ],
            next_cursor: 'more',
          }
        : {
            items: [
              {
                id: 'tx1',
                kind: 'expense',
                description: 'Internet',
                expected_amount: 9990,
                expected_date: '2026-11-08',
                currency: 'BRL',
              },
              {
                id: null,
                recurrence_id: 'rec2',
                occurrence_date: '2026-11-06',
                kind: 'expense',
                description: 'Streaming',
                expected_amount: 3990,
                expected_date: '2026-11-06',
                currency: 'BRL',
              },
            ],
          },
    'GET /financial-summaries': (call) =>
      call.query.get('from') === '2026-11-01'
        ? {
            currency: 'BRL',
            balance: {
              current: 1234500,
              accounts: [
                { id: 'a1', name: 'Conta corrente', balance_amount: 1000000 },
                { id: 'a2', name: 'Poupança', balance_amount: 234500 },
              ],
            },
            totals: { income: flow(0, 500000), expense: flow(100000, 300000), surplus: flow(0, 0) },
          }
        : {
            currency: 'BRL',
            balance: { current: 0, accounts: [] },
            totals: {
              income: flow(0, 800000),
              expense: flow(0, 450000),
              surplus: flow(0, 350000),
            },
          },
    'GET /journal-entries': () => ({
      items: [
        {
          id: 'j1',
          occurred_at: '2026-11-04T23:30:00Z',
          text: 'Hoje foi um dia calmo.\nSegunda linha.',
          emotions: [{ emotion_id: 'e1', name: 'Calma' }],
        },
      ],
    }),
    'GET /books': () => ({
      items: [{ id: 'b1', title: 'Dom Casmurro', progress_percent: 42 }],
    }),
  };
}
