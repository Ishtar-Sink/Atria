import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, screen } from '@testing-library/react';
import type userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { expect, vi } from 'vitest';
import { rootRoute } from '../../app/router';
import { renderWithProviders } from '../../shared/test/render';
import type { Account, Category, Transaction, TransactionItem } from './hooks/finance-cache';
import { createFinanceRoutes } from './routes';

export interface ApiCall {
  method: string;
  path: string;
  url: URL;
  body: unknown;
  headers: Record<string, string>;
}

export interface ApiReply {
  status?: number;
  body?: unknown;
  /** A resposta nunca chega: mantém a tela carregando ou enviando. */
  hang?: boolean;
}

export type ApiHandler =
  ApiReply | ((call: ApiCall, params: Record<string, string>) => ApiReply | Promise<ApiReply>);

function matchPath(pattern: string, path: string): Record<string, string> | null {
  const left = pattern.split('/');
  const right = path.split('/');
  if (left.length !== right.length) return null;
  const params: Record<string, string> = {};
  for (const [index, part] of left.entries()) {
    const actual = right[index] ?? '';
    if (part.startsWith(':')) params[part.slice(1)] = decodeURIComponent(actual);
    else if (part !== actual) return null;
  }
  return params;
}

/** Servidor simulado: troca o `fetch` global, casa `MÉTODO /caminho/:param` e grava as chamadas. */
export function mockApi(routes: Record<string, ApiHandler>) {
  const calls: ApiCall[] = [];
  const fetch_mock = vi.fn(async (input: string, init?: RequestInit) => {
    const url = new URL(input, 'http://localhost');
    const method = init?.method ?? 'GET';
    const path = url.pathname.replace(/^\/api\/v1/, '');
    const body: unknown = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
    const headers = { ...(init?.headers as Record<string, string> | undefined) };
    const call: ApiCall = { method, path, url, body, headers };
    calls.push(call);
    let reply: ApiReply = { status: 404, body: { code: 'not_found', title: 'not found' } };
    for (const [key, handler] of Object.entries(routes)) {
      const [route_method, pattern = ''] = key.split(' ');
      if (route_method !== method) continue;
      const params = matchPath(pattern, path);
      if (params === null) continue;
      reply = typeof handler === 'function' ? await handler(call, params) : handler;
      break;
    }
    if (reply.hang) return new Promise<Response>(() => undefined);
    const status = reply.status ?? 200;
    return new Response(
      status === 204 || reply.body === undefined ? null : JSON.stringify(reply.body),
      { status, headers: { 'Content-Type': 'application/json' } },
    );
  });
  vi.stubGlobal('fetch', fetch_mock);
  return { calls, fetch_mock };
}

export function problem(status: number, code: string): ApiReply {
  return { status, body: { code, title: code } };
}

export function newClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } },
  });
}

export function renderFinanceHook<T>(hook: () => T, client = newClient()) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { ...renderHook(hook, { wrapper }), client };
}

const STAMP = { created_at: '2026-11-01T10:00:00Z', updated_at: '2026-11-02T10:00:00Z' };

export function account(overrides: Partial<Account> & Pick<Account, 'id' | 'name'>): Account {
  return {
    kind: 'standard',
    balance_amount: 0,
    currency: 'BRL',
    is_default: false,
    owner_id: 'u1',
    visibility: 'personal',
    credit_limit_amount: null,
    closing_day: null,
    due_day: null,
    ...STAMP,
    ...overrides,
  };
}

export function category(overrides: Partial<Category> & Pick<Category, 'id' | 'name'>): Category {
  return {
    kind: 'expense',
    color: 'primary',
    owner_id: 'u1',
    visibility: 'personal',
    ...STAMP,
    ...overrides,
  };
}

export function transaction(
  overrides: Partial<Transaction> & Pick<Transaction, 'id'>,
): Transaction {
  return {
    account_id: 'a1',
    category_id: 'c1',
    currency: 'BRL',
    description: 'Mercado',
    kind: 'expense',
    expected_amount: 10000,
    expected_date: '2026-11-10',
    effective_date: '2026-11-10',
    status: 'open',
    owner_id: 'u1',
    visibility: 'personal',
    settled_amount: null,
    settled_at: null,
    difference_amount: null,
    difference_kind: null,
    generated_from: null,
    recurrence_id: null,
    occurrence_date: null,
    installment: null,
    statement_period: null,
    ...STAMP,
    ...overrides,
  };
}

export function item(overrides: Partial<TransactionItem>): TransactionItem {
  return { ...transaction({ id: 't-item' }), ...overrides };
}

export interface FinanceWorld {
  accounts: Account[];
  categories: Category[];
  transactions: TransactionItem[];
  transfers: Record<string, unknown>[];
  recurring: Record<string, unknown>[];
  copies: Record<string, TransactionItem[]>;
  statements: Record<string, Record<string, unknown>[]>;
  summary?: unknown;
  /** Resposta pronta para uma chamada: força recusa, atraso ou erro. */
  override?: (call: ApiCall) => ApiReply | undefined;
}

export function world(partial: Partial<FinanceWorld> = {}): FinanceWorld {
  return {
    accounts: [],
    categories: [],
    transactions: [],
    transfers: [],
    recurring: [],
    copies: {},
    statements: {},
    ...partial,
  };
}

function page(items: unknown[]) {
  return { body: { items } };
}

/** Servidor do Financeiro em memória, com as rotas usadas pelas telas. */
export function financeServer(state: FinanceWorld) {
  const find = <T extends { id?: string | null }>(list: T[], id: string) =>
    list.find((entry) => entry.id === id);
  const intercept =
    (handler: (call: ApiCall, params: Record<string, string>) => ApiReply) =>
    (call: ApiCall, params: Record<string, string>) =>
      state.override?.(call) ?? handler(call, params);
  const routes: Record<string, ApiHandler> = {
    'GET /me': { status: 401, body: { code: 'unauthenticated', title: 'x' } },
    'GET /accounts': intercept(() => page(state.accounts)),
    'GET /accounts/:id': intercept((_call, { id = '' }) => {
      const found = find(state.accounts, id);
      return found ? { body: found } : problem(404, 'not_found');
    }),
    'POST /accounts': intercept((call) => {
      const created = account({
        id: `a${String(state.accounts.length + 1)}`,
        name: '',
        ...(call.body as Partial<Account>),
      });
      state.accounts.push(created);
      return { status: 201, body: created };
    }),
    'PATCH /accounts/:id': intercept((call, { id = '' }) => {
      const found = find(state.accounts, id);
      if (!found) return problem(404, 'not_found');
      Object.assign(found, call.body);
      return { body: found };
    }),
    'DELETE /accounts/:id': intercept((_call, { id = '' }) => {
      state.accounts = state.accounts.filter((entry) => entry.id !== id);
      return { status: 204 };
    }),
    'GET /categories': intercept((call) => {
      const kind = call.url.searchParams.get('kind');
      return page(state.categories.filter((entry) => kind === null || entry.kind === kind));
    }),
    'GET /categories/:id': intercept((_call, { id = '' }) => {
      const found = find(state.categories, id);
      return found ? { body: found } : problem(404, 'not_found');
    }),
    'POST /categories': intercept((call) => {
      const created = category({
        id: `c${String(state.categories.length + 1)}`,
        name: '',
        ...(call.body as Partial<Category>),
      });
      state.categories.push(created);
      return { status: 201, body: created };
    }),
    'PATCH /categories/:id': intercept((call, { id = '' }) => {
      const found = find(state.categories, id);
      if (!found) return problem(404, 'not_found');
      Object.assign(found, call.body);
      return { body: found };
    }),
    'DELETE /categories/:id': intercept((_call, { id = '' }) => {
      state.categories = state.categories.filter((entry) => entry.id !== id);
      return { status: 204 };
    }),
    'GET /transactions': intercept((call) => {
      const params = call.url.searchParams;
      const kind = params.get('kind');
      const account_id = params.get('account_id');
      const category_id = params.get('category_id');
      const q = params.get('q')?.toLocaleLowerCase();
      const from = params.get('from');
      const to = params.get('to');
      return page(
        state.transactions.filter(
          (entry) =>
            (kind === null || entry.kind === kind) &&
            (account_id === null || entry.account_id === account_id) &&
            (category_id === null || entry.category_id === category_id) &&
            (q === undefined || (entry.description ?? '').toLocaleLowerCase().includes(q)) &&
            (from === null || entry.effective_date >= from) &&
            (to === null || entry.effective_date <= to),
        ),
      );
    }),
    'GET /transactions/:id': intercept((_call, { id = '' }) => {
      const found = find(state.transactions, id);
      return found ? { body: found } : problem(404, 'not_found');
    }),
    'POST /transactions': intercept((call) => {
      const body = call.body as Record<string, unknown> & { installments?: number };
      const total = body.installments ?? 1;
      const items = Array.from({ length: total }, (_, index) =>
        transaction({
          id: `t-new-${String(state.transactions.length + index + 1)}`,
          ...(body as Partial<Transaction>),
          effective_date: String(body.expected_date),
          ...(total > 1
            ? {
                installment: { number: index + 1, total },
                statement_period: `2026-${String(11 + index).padStart(2, '0')}`,
              }
            : {}),
        }),
      );
      state.transactions.push(...items);
      return { status: 201, body: { items } };
    }),
    'PATCH /transactions/:id': intercept((call, { id = '' }) => {
      const found = find(state.transactions, id);
      if (!found) return problem(404, 'not_found');
      Object.assign(found, call.body);
      return { body: found };
    }),
    'DELETE /transactions/:id': intercept((_call, { id = '' }) => {
      state.transactions = state.transactions.filter((entry) => entry.id !== id);
      return { status: 204 };
    }),
    'POST /transactions/:id/settlement': intercept((call, { id = '' }) => {
      const found = find(state.transactions, id);
      if (!found) return problem(404, 'not_found');
      const { settled_amount, settled_at } = call.body as {
        settled_amount: number;
        settled_at: string;
      };
      const difference_amount = settled_amount - found.expected_amount;
      Object.assign(found, {
        status: 'settled',
        settled_amount,
        settled_at,
        effective_date: settled_at,
        difference_amount,
        difference_kind:
          difference_amount === 0
            ? null
            : found.kind === 'expense'
              ? difference_amount < 0
                ? 'saving'
                : 'loss'
              : difference_amount > 0
                ? 'gain'
                : 'loss',
      });
      return { body: found };
    }),
    'DELETE /transactions/:id/settlement': intercept((_call, { id = '' }) => {
      const found = find(state.transactions, id);
      if (!found) return problem(404, 'not_found');
      if (found.generated_from) {
        state.transactions = state.transactions.filter((entry) => entry.id !== id);
        return { status: 204 };
      }
      Object.assign(found, {
        status: 'open',
        settled_amount: null,
        settled_at: null,
        difference_amount: null,
        difference_kind: null,
        effective_date: found.expected_date,
      });
      return { body: found };
    }),
    'GET /transfers': intercept(() => page(state.transfers)),
    'GET /transfers/:id': intercept((_call, { id = '' }) => {
      const found = state.transfers.find((entry) => entry.id === id);
      return found ? { body: found } : problem(404, 'not_found');
    }),
    'POST /transfers': intercept((call) => {
      const created = {
        id: `tr${String(state.transfers.length + 1)}`,
        currency: 'BRL',
        owner_id: 'u1',
        visibility: 'personal',
        created_at: '2026-11-05T10:00:00Z',
        updated_at: '2026-11-05T10:00:00Z',
        ...(call.body as object),
      };
      state.transfers.push(created);
      return { status: 201, body: created };
    }),
    'DELETE /transfers/:id': intercept((_call, { id = '' }) => {
      state.transfers = state.transfers.filter((entry) => entry.id !== id);
      return { status: 204 };
    }),
    'GET /recurring-transactions/:id': intercept((_call, { id = '' }) => {
      const found = state.recurring.find((entry) => entry.id === id);
      return found ? { body: found } : problem(404, 'not_found');
    }),
    'POST /recurring-transactions': intercept((call) => {
      const created = {
        id: `r${String(state.recurring.length + 1)}`,
        currency: 'BRL',
        owner_id: 'u1',
        visibility: 'personal',
        open_occurrence: null,
        created_at: '2026-11-05T10:00:00Z',
        updated_at: '2026-11-05T10:00:00Z',
        ...(call.body as object),
      };
      state.recurring.push(created);
      return { status: 201, body: created };
    }),
    'PATCH /recurring-transactions/:id': intercept((call, { id = '' }) => {
      const found = state.recurring.find((entry) => entry.id === id);
      if (!found) return problem(404, 'not_found');
      Object.assign(found, call.body);
      return { body: found };
    }),
    // Sem resposta pronta, a liquidação e o pulo dependem do `override` de cada teste.
    'POST /recurring-transactions/:id/settlement': intercept(() => problem(404, 'not_found')),
    'POST /recurring-transactions/:id/skip': intercept(() => problem(404, 'not_found')),
    'GET /recurring-transactions/:id/settled-transactions': intercept((_call, { id = '' }) =>
      page(state.copies[id] ?? []),
    ),
    'GET /credit-cards/:id/statements': intercept((_call, { id = '' }) =>
      page(state.statements[id] ?? []),
    ),
    'POST /credit-cards/:id/statements/:period/payment': intercept((_call, { id = '', period }) => {
      const found = (state.statements[id] ?? []).find((entry) => entry.period === period);
      if (found) Object.assign(found, { paid: true, outstanding_amount: 0 });
      return { status: 201, body: { settled_transaction_ids: [], transfer: {} } };
    }),
    'GET /financial-summaries': intercept(() =>
      state.summary === undefined ? problem(500, 'internal_error') : { body: state.summary },
    ),
  };
  return mockApi(routes);
}

/** Monta o app com as rotas reais do Financeiro num roteador em memória. */
export function renderFinance(route: string) {
  return renderWithProviders(null, { routes: createFinanceRoutes(rootRoute), route });
}

/** O cabeçalho da página tem o `page-heading` ([project/frontend-07]). */
export async function pageHeading(name: string | RegExp) {
  const found = await screen.findByRole('heading', { level: 1, name });
  expect(found).toHaveAttribute('data-page-heading');
  return found;
}

/** Os formulários usam os controles próprios, nunca os nativos (PD-57, PD-62). */
export function expectNoNativeControls(container: HTMLElement) {
  expect(container.querySelector('select')).toBeNull();
  expect(container.querySelector('input[type=date]')).toBeNull();
  expect(container.querySelector('input[type=time]')).toBeNull();
  expect(container.querySelector('input[type=datetime-local]')).toBeNull();
}

/** Percorre a tela pelo teclado desde o topo: o foco sempre cai num elemento da página. */
export async function tabsThrough(user: ReturnType<typeof userEvent.setup>, steps = 6) {
  (document.activeElement as HTMLElement | null)?.blur();
  for (let index = 0; index < steps; index += 1) {
    await user.tab();
    expect(document.activeElement).not.toBe(document.body);
  }
}
