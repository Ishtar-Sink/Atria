import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';

/** Tipo local de `GET /me` até as features passarem o tipo dos contratos compartilhados. */
export interface CurrentUser {
  id: string;
  email: string;
  display_name?: string | null;
  avatar_url?: string | null;
}

export function useCurrentUser() {
  return useQuery({
    queryKey: ['me'],
    queryFn: ({ signal }) => api.get<CurrentUser>('/me', { signal }),
    staleTime: 5 * 60 * 1000,
  });
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
