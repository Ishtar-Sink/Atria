import type { Schemas } from '@atria/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../shared/api/client';
import { ApiProblem } from '../../../shared/api/problem';

export type Me = Schemas['MeResponse'];
export type TotpEnrollment = Schemas['TotpEnrollmentResponse'];
export type PasswordResetLink = Schemas['PasswordResetLinkResponse'];
type SetupStatus = Schemas['SetupStatus'];
export type Credentials = Schemas['SetupRequest'];

export type SignInResult = { status: 'signed_in'; me: Me } | { status: 'totp_required' };

/** Chave de tradução da mensagem calma para o erro da API; códigos desconhecidos viram a genérica. */
export function authErrorKey(error: unknown): string {
  if (!(error instanceof ApiProblem)) return 'auth.errors.generic';
  if (error.code === 'network_error') return 'common.errors.network_error';
  const key = `auth.errors.${error.code}`;
  return KNOWN_ERRORS.has(error.code) ? key : 'auth.errors.generic';
}

const KNOWN_ERRORS = new Set([
  'invalid_credentials',
  'invalid_totp_code',
  'invite_invalid',
  'invite_required',
  'reset_token_invalid',
  'too_many_attempts',
  'validation_failed',
  'user_not_found',
]);

export function isProblem(error: unknown, code: string): boolean {
  return error instanceof ApiProblem && error.code === code;
}

export function useSetupStatus() {
  return useQuery({
    queryKey: ['setup'],
    queryFn: ({ signal }) => api.get<SetupStatus>('/setup', { signal }),
  });
}

function useStoreMe() {
  const client = useQueryClient();
  return (me: Me) => {
    client.setQueryData(['me'], me);
  };
}

export function useSetup() {
  const store = useStoreMe();
  return useMutation({
    mutationFn: (values: Credentials) => api.post<Me>('/setup', values),
    onSuccess: store,
  });
}

export function useSignIn() {
  const store = useStoreMe();
  return useMutation({
    mutationFn: async (values: Credentials & { totp_code?: string }): Promise<SignInResult> => {
      try {
        const me = await api.post<Me>('/auth/sign-in', values);
        return { status: 'signed_in', me };
      } catch (error) {
        if (isProblem(error, 'totp_required')) return { status: 'totp_required' };
        throw error;
      }
    },
    onSuccess: (result) => {
      if (result.status === 'signed_in') store(result.me);
    },
  });
}

export function useStartTotp() {
  return useMutation({ mutationFn: () => api.post<TotpEnrollment>('/auth/totp') });
}

export function useActivateTotp() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => api.post<undefined>('/auth/totp/activation', { code }),
    onSuccess: () => client.invalidateQueries({ queryKey: ['me'] }),
  });
}

export function useSignUp() {
  const store = useStoreMe();
  return useMutation({
    mutationFn: (values: Credentials & { invite_token?: string }) =>
      api.post<Me>('/auth/sign-up', values),
    onSuccess: store,
  });
}

/** O servidor responde 202 igual para e-mail existente ou não; a tela nunca distingue (CB-11). */
export function useForgotPassword() {
  return useMutation({
    mutationFn: (email: string) => api.post<unknown>('/auth/password-resets', { email }),
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: (values: { token: string; password: string }) =>
      api.put<undefined>(`/auth/password-resets/${encodeURIComponent(values.token)}`, {
        password: values.password,
      }),
  });
}

export function useAdminPasswordReset() {
  return useMutation({
    mutationFn: (user_id: string) =>
      api.post<PasswordResetLink>('/admin/password-resets', { user_id }),
  });
}
