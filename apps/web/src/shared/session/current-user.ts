import type { Schemas } from '@atria/contracts';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../api/client';
import { ApiProblem } from '../api/problem';

/** Chave da consulta de `GET /me`: refeita, decide se a sessão continua aberta. */
export const SESSION_QUERY_KEY = ['me'] as const;
const RETURN_KEY = 'atria_return_to';

/** Tipo local de `GET /me` até as features passarem o tipo dos contratos compartilhados. */
export interface CurrentUser {
  id: string;
  email: string;
  display_name?: string | null;
  avatar_url?: string | null;
}

export function useCurrentUser() {
  return useQuery({
    queryKey: SESSION_QUERY_KEY,
    queryFn: ({ signal }) => api.get<CurrentUser>('/me', { signal }),
    staleTime: 5 * 60 * 1000,
  });
}

/** Sem resposta do servidor, a tela de entrada abre normalmente em vez de bloquear o acesso. */
export async function fetchSetupRequired(): Promise<boolean> {
  try {
    return (await api.get<Schemas['SetupStatus']>('/setup')).required;
  } catch {
    return false;
  }
}

export async function hasSession(): Promise<boolean> {
  try {
    await api.get('/me');
    return true;
  } catch {
    return false;
  }
}

/** Só o 401 `unauthenticated` indica sessão perdida; o login errado também responde 401. */
export function isSessionLost(error: unknown): boolean {
  return error instanceof ApiProblem && error.status === 401 && error.code === 'unauthenticated';
}

/** Guarda o endereço para voltar depois do login; a página inicial não precisa ser lembrada. */
export function rememberReturnTo(href: string): void {
  if (href === '/' || href.startsWith('/?')) return;
  try {
    sessionStorage.setItem(RETURN_KEY, href);
  } catch {
    // Sem armazenamento no navegador, o login volta para a página inicial.
  }
}

export function takeReturnTo(): string | undefined {
  try {
    const href = sessionStorage.getItem(RETURN_KEY) ?? undefined;
    sessionStorage.removeItem(RETURN_KEY);
    return href;
  } catch {
    return undefined;
  }
}

export type SessionState = 'checking' | 'authenticated' | 'needs_setup' | 'needs_sign_in';

/** Estado da sessão para a proteção das rotas autenticadas (RF-01, RF-02). */
export function useSessionState(): SessionState {
  const me = useCurrentUser();
  const lost = me.error instanceof ApiProblem && me.error.status === 401;
  // Chave própria: `['setup']` guarda o objeto `SetupStatus` de `useSetupStatus`.
  const setup = useQuery({
    queryKey: ['session', 'setup_required'],
    queryFn: fetchSetupRequired,
    enabled: lost,
  });
  const [opened, setOpened] = useState(false);
  const state = sessionStateOf(me.isPending, lost, setup.isPending, setup.data);
  // Depois de um erro sem dados, as telas montadas refazem `/me` e a consulta volta a
  // `pending`; o app já aberto continua aberto até a resposta, sem piscar.
  const refetching = state === 'checking' && me.isPending;
  const next = refetching ? opened : state === 'authenticated';
  if (next !== opened) setOpened(next);
  return refetching && opened ? 'authenticated' : state;
}

function sessionStateOf(
  me_pending: boolean,
  lost: boolean,
  setup_pending: boolean,
  setup_required: boolean | undefined,
): SessionState {
  if (me_pending) return 'checking';
  // Outro erro, como 500 ou falha de rede, abre o app: cada tela mostra o próprio erro.
  if (!lost) return 'authenticated';
  if (setup_pending) return 'checking';
  return setup_required ? 'needs_setup' : 'needs_sign_in';
}

/** Nome para exibir: o `display_name` ou, sem ele, o e-mail. */
export function displayName(user: CurrentUser): string {
  return user.display_name?.trim() || user.email;
}

/** Duas letras: iniciais do nome ou, sem nome, o começo do e-mail. */
export function initialsOf(user: CurrentUser): string {
  const name = user.display_name?.trim();
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean);
    const first = parts[0]?.[0] ?? '';
    const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : (parts[0]?.[1] ?? '');
    return (first + last).toUpperCase();
  }
  return (user.email.split('@')[0] ?? '')
    .replace(/[^\p{L}\p{N}]/gu, '')
    .slice(0, 2)
    .toUpperCase();
}
