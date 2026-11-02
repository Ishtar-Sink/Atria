import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, screen } from '@testing-library/react';
import type userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { expect, vi } from 'vitest';
import { rootRoute } from '../../app/router';
import { renderWithProviders } from '../../shared/test/render';
import type { Account, Category, Transaction, TransactionItem } from './hooks/finance-cache';
import { adjustmentInputs, type AdjustmentDto } from './hooks/use-transactions';
import { computeNet, grossForNet, type Adjustment } from './lib/adjustments';
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
    balance_amount: 0,
    currency: 'BRL',
    is_default: false,
    owner_id: 'u1',
    visibility: 'personal',
    ...STAMP,
    ...overrides,
  };
}

export function category(overrides: Partial<Category> & Pick<Category, 'id' | 'name'>): Category {
  return {
    kind: 'expense',
    color: '#6d28d9',
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
    gross_amount: overrides.expected_amount ?? 10000,
    adjustments: [],
    settled_gross_amount: null,
    settled_adjustments: [],
    ...STAMP,
    ...overrides,
  };
}

/** Salário dos casos ct02 e ct05 da tabela comum (lib/adjustments.test.ts). */
export const SALARY_ADJUSTMENTS: AdjustmentDto[] = [
  { name: 'INSS', direction: 'deduction', mode: 'percent', rate_bp: 1100, computed_amount: 88000 },
  {
    name: 'IRPF',
    direction: 'deduction',
    mode: 'percent',
    rate_bp: 1500,
    base_amount: 712000,
    computed_amount: 106800,
  },
];

export const SALARY_SETTLED_ADJUSTMENTS: AdjustmentDto[] = [
  { name: 'INSS', direction: 'deduction', mode: 'percent', rate_bp: 1100, computed_amount: 94514 },
  {
    name: 'IRPF',
    direction: 'deduction',
    mode: 'percent',
    rate_bp: 1500,
    base_amount: 764706,
    computed_amount: 114706,
  },
];

export function salary(overrides: Partial<Transaction> = {}): Transaction {
  return transaction({
    id: 't20',
    kind: 'income',
    description: 'Salário',
    category_id: 'c3',
    gross_amount: 800000,
    expected_amount: 605200,
    adjustments: SALARY_ADJUSTMENTS,
    expected_date: '2026-11-05',
    effective_date: '2026-11-05',
    ...overrides,
  });
}

export function settledSalary(): Transaction {
  return salary({
    id: 't21',
    status: 'settled',
    settled_amount: 650000,
    settled_at: '2026-11-05',
    settled_gross_amount: 859220,
    settled_adjustments: SALARY_SETTLED_ADJUSTMENTS,
    difference_amount: 44800,
    difference_kind: 'gain',
  });
}

function refusal(issue: { field: string; code: string }): ApiReply {
  return {
    status: 422,
    body: { code: 'validation_failed', title: 'validation_failed', errors: [issue] },
  };
}

/**
 * Bruto e itens do corpo, como o servidor: com itens, o líquido sai do `computeNet`; sem itens,
 * o bruto é o próprio valor previsto.
 */
function plannedAmounts(body: Record<string, unknown>): Record<string, unknown> | ApiReply {
  const items = (body.adjustments as Adjustment[] | undefined) ?? [];
  if (items.length === 0) {
    const amount = (body.expected_amount ?? body.gross_amount) as number;
    return { expected_amount: amount, gross_amount: amount, adjustments: [] };
  }
  const result = computeNet(body.gross_amount as number, items);
  if (!result.ok) return refusal(result.issue);
  return {
    gross_amount: result.breakdown.gross_amount,
    expected_amount: result.breakdown.net_amount,
    adjustments: result.breakdown.adjustments,
  };
}

function isReply(value: Record<string, unknown> | ApiReply): value is ApiReply {
  return 'status' in value;
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
      const body = call.body as Record<string, unknown>;
      const amounts = plannedAmounts(body);
      if (isReply(amounts)) return amounts;
      const created = transaction({
        id: `t-new-${String(state.transactions.length + 1)}`,
        ...(body as Partial<Transaction>),
        ...(amounts as Partial<Transaction>),
        effective_date: String(body.expected_date),
      });
      state.transactions.push(created);
      return { status: 201, body: { items: [created] } };
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
    'POST /transactions/settlement-preview': intercept((call) => {
      const body = call.body as {
        settled_amount: number;
        adjustments: Adjustment[];
        expected_gross_amount: number;
      };
      const result = grossForNet(body.settled_amount, body.adjustments, body.expected_gross_amount);
      return result.ok ? { body: result.breakdown } : refusal(result.issue);
    }),
    'POST /transactions/:id/settlement': intercept((call, { id = '' }) => {
      const found = find(state.transactions, id);
      if (!found) return problem(404, 'not_found');
      const { settled_amount, settled_at, adjustments } = call.body as {
        settled_amount: number;
        settled_at: string;
        adjustments?: Adjustment[];
      };
      // Com itens, o bruto e os itens liquidados saem do cálculo reverso; a diferença continua
      // sobre o líquido (RN-08).
      const items = adjustments ?? adjustmentInputs(found.adjustments);
      if (items.length > 0) {
        const result = grossForNet(settled_amount, items, found.gross_amount);
        if (!result.ok) return refusal(result.issue);
        Object.assign(found, {
          settled_gross_amount: result.breakdown.gross_amount,
          settled_adjustments: result.breakdown.adjustments,
        });
      }
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
      const amounts = plannedAmounts(call.body as Record<string, unknown>);
      if (isReply(amounts)) return amounts;
      const created = {
        id: `r${String(state.recurring.length + 1)}`,
        currency: 'BRL',
        owner_id: 'u1',
        visibility: 'personal',
        open_occurrence: null,
        created_at: '2026-11-05T10:00:00Z',
        updated_at: '2026-11-05T10:00:00Z',
        ...(call.body as object),
        ...amounts,
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
    // Sem resposta pronta, a liquidação, o pulo e a exclusão dependem do `override` de cada teste.
    'POST /recurring-transactions/:id/settlement': intercept(() => problem(404, 'not_found')),
    'POST /recurring-transactions/:id/skip': intercept(() => problem(404, 'not_found')),
    'DELETE /recurring-transactions/:id': intercept(() => problem(404, 'not_found')),
    'GET /recurring-transactions/:id/settled-transactions': intercept((_call, { id = '' }) =>
      page(state.copies[id] ?? []),
    ),
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

/**
 * Texto de cada linha de um detalhamento (`dl`): o nome, a dica e o valor separados por espaço,
 * com os espaços especiais do Intl trocados por espaço comum.
 */
export function breakdownRows(list: Element): string[] {
  return Array.from(list.children).map((row) =>
    Array.from(row.children)
      .map((cell) =>
        Array.from(cell.childNodes)
          .map((node) => node.textContent)
          .join(' '),
      )
      .join(' ')
      .replace(/[\u00a0\u202f]/g, ' '),
  );
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
