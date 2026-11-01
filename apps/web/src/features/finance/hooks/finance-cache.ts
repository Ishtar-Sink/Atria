import type { Schemas } from '@atria/contracts';
import type { InfiniteData, QueryClient, QueryKey } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { ApiProblem } from '../../../shared/api/problem';
import { hasMessage, registerMessages } from '../../../shared/i18n/i18n';
import { pushToast } from '../../../shared/toast/toast-store';
import messages from '../i18n/pt-br.json';

registerMessages('finance', messages);

export type Account = Schemas['AccountResponse'];
export type Category = Schemas['CategoryResponse'];
export type Transaction = Schemas['TransactionResponse'];
export type TransactionItem = Schemas['TransactionItemResponse'];
export type TransactionKind = Schemas['TransactionKindDto'];
export type Visibility = Schemas['Visibility'];
export type CategoryColor = Schemas['CategoryColorDto'];
export type ItemStatus = Schemas['ItemStatusDto'];

/** Chaves das consultas do Financeiro: o prefixo comum permite invalidar por grupo. */
export const financeKeys = {
  all: ['finance'] as const,
  accounts: ['finance', 'accounts'] as const,
  account: (id: string) => ['finance', 'account', id] as const,
  categories: ['finance', 'categories'] as const,
  category: (id: string) => ['finance', 'category', id] as const,
  transactions: ['finance', 'transactions'] as const,
  transaction: (id: string) => ['finance', 'transaction', id] as const,
  recurring: (id: string) => ['finance', 'recurring', id] as const,
  copies: (id: string) => ['finance', 'recurring', id, 'copies'] as const,
  summary: ['finance', 'summary'] as const,
  transfers: ['finance', 'transfers'] as const,
  transfer: (id: string) => ['finance', 'transfer', id] as const,
};

export function problemCode(error: unknown): string | undefined {
  return error instanceof ApiProblem ? error.code : undefined;
}

/** Aviso da recusa do servidor: a mensagem do código no Financeiro, depois a comum. */
export function warnRefusal(error: unknown) {
  const code = problemCode(error);
  const own = code ? `finance.errors.${code}` : undefined;
  const common = code ? `common.errors.${code}` : undefined;
  const message_key =
    own && hasMessage(own) ? own : common && hasMessage(common) ? common : 'common.errors.generic';
  pushToast({ tone: 'danger', message_key });
}

/** Mensagem do erro para o formulário (`role="alert"`). */
export function errorMessageKey(error: unknown): string {
  const code = problemCode(error);
  if (code && hasMessage(`finance.errors.${code}`)) return `finance.errors.${code}`;
  if (code && hasMessage(`common.errors.${code}`)) return `common.errors.${code}`;
  return 'finance.errors.generic';
}

export type Snapshot = [QueryKey, unknown][];

export function snapshot(client: QueryClient, prefixes: readonly QueryKey[]): Snapshot {
  return prefixes.flatMap((queryKey) => client.getQueriesData({ queryKey }));
}

export function restore(client: QueryClient, saved: Snapshot | undefined) {
  saved?.forEach(([key, data]) => {
    client.setQueryData(key, data);
  });
}

export async function cancel(client: QueryClient, prefixes: readonly QueryKey[]) {
  await Promise.all(prefixes.map((queryKey) => client.cancelQueries({ queryKey })));
}

export interface Page<T> {
  items: T[];
  next_cursor?: string | null;
}

/** Aplica `fn` a cada item das listas paginadas que casam com o prefixo. */
export function mapPages<T>(client: QueryClient, prefix: QueryKey, fn: (items: T[]) => T[]) {
  client.setQueriesData<InfiniteData<Page<T>>>({ queryKey: prefix }, (data) =>
    data && 'pages' in data
      ? { ...data, pages: data.pages.map((page) => ({ ...page, items: fn(page.items) })) }
      : data,
  );
}

/** Entrada soma ao saldo; saída subtrai (o saldo só muda na liquidação, RN-01). */
export function balanceDelta(kind: TransactionKind, amount: number): number {
  return kind === 'income' ? amount : -amount;
}

export function adjustBalance(client: QueryClient, account_id: string, delta: number) {
  if (delta === 0) return;
  client.setQueryData<Account[]>(financeKeys.accounts, (list) =>
    list?.map((account) =>
      account.id === account_id
        ? { ...account, balance_amount: account.balance_amount + delta }
        : account,
    ),
  );
  client.setQueryData<Account>(financeKeys.account(account_id), (account) =>
    account ? { ...account, balance_amount: account.balance_amount + delta } : account,
  );
}

/**
 * Chave de idempotência de um envio (CB-09): nasce quando o formulário abre, vai em todas as
 * tentativas do mesmo envio e só é trocada depois de um sucesso.
 */
export function useIdempotencyKey() {
  const [key, setKey] = useState(() => crypto.randomUUID());
  const renew = useCallback(() => {
    setKey(crypto.randomUUID());
  }, []);
  return { key, renew };
}

/** Lê todas as páginas de uma listagem curta (contas, categorias). */
export async function readAll<T>(
  fetch_page: (cursor: string | undefined) => Promise<Page<T>>,
): Promise<T[]> {
  const items: T[] = [];
  let cursor: string | undefined;
  for (;;) {
    const page = await fetch_page(cursor);
    items.push(...page.items);
    if (!page.next_cursor) return items;
    cursor = page.next_cursor;
  }
}
