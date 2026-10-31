import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mockApi, problem } from '../test-server';
import {
  useActivateTotp,
  useAdminPasswordReset,
  useForgotPassword,
  useResetPassword,
  useSetup,
  useSetupStatus,
  useSignIn,
  useSignUp,
  useStartTotp,
} from './use-auth-mutations';

const ME = {
  id: '0190c8d0-0000-7000-8000-000000000001',
  email: 'ana@exemplo.com',
  role: 'member',
  totp_enabled: false,
  account_complete: true,
};

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('auth hooks', () => {
  it('useSetupStatus reads GET /setup', async () => {
    const server = mockApi({ 'GET /setup': { status: 200, body: { required: true } } });
    const { result } = renderHook(() => useSetupStatus(), { wrapper });
    await waitFor(() => {
      expect(result.current.data).toEqual({ required: true });
    });
    expect(server.calls[0]).toMatchObject({ method: 'GET', path: '/setup' });
  });

  it('useSetup posts to /setup', async () => {
    const server = mockApi({ 'POST /setup': { status: 201, body: ME } });
    const { result } = renderHook(() => useSetup(), { wrapper });
    await act(() =>
      result.current.mutateAsync({ email: ME.email, password: 'senha-de-12-letras' }),
    );
    expect(server.calls[0]).toMatchObject({
      method: 'POST',
      path: '/setup',
      body: { email: ME.email, password: 'senha-de-12-letras' },
    });
  });

  it('useSignIn returns totp_required when the server asks for the code', async () => {
    mockApi({ 'POST /auth/sign-in': problem(401, 'totp_required') });
    const { result } = renderHook(() => useSignIn(), { wrapper });
    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.mutateAsync({ email: ME.email, password: 'x' });
    });
    expect(outcome).toEqual({ status: 'totp_required' });
  });

  it('useSignIn rethrows other problems', async () => {
    mockApi({ 'POST /auth/sign-in': problem(401, 'invalid_credentials') });
    const { result } = renderHook(() => useSignIn(), { wrapper });
    await act(async () => {
      await expect(
        result.current.mutateAsync({ email: ME.email, password: 'x' }),
      ).rejects.toMatchObject({ code: 'invalid_credentials' });
    });
  });

  it('useStartTotp posts to /auth/totp and returns the otpauth uri', async () => {
    const enrollment = {
      secret: 'JBSWY3DPEHPK3PXP',
      otpauth_uri: 'otpauth://totp/Atria:a?secret=J',
    };
    const server = mockApi({ 'POST /auth/totp': { status: 201, body: enrollment } });
    const { result } = renderHook(() => useStartTotp(), { wrapper });
    await act(async () => {
      expect(await result.current.mutateAsync()).toEqual(enrollment);
    });
    expect(server.calls[0]).toMatchObject({ method: 'POST', path: '/auth/totp' });
  });

  it('useActivateTotp posts the code to /auth/totp/activation', async () => {
    const server = mockApi({ 'POST /auth/totp/activation': { status: 204 } });
    const { result } = renderHook(() => useActivateTotp(), { wrapper });
    await act(() => result.current.mutateAsync('123456'));
    expect(server.calls[0]).toMatchObject({
      path: '/auth/totp/activation',
      body: { code: '123456' },
    });
  });

  it('useSignUp sends the invite token', async () => {
    const server = mockApi({ 'POST /auth/sign-up': { status: 201, body: ME } });
    const { result } = renderHook(() => useSignUp(), { wrapper });
    await act(() =>
      result.current.mutateAsync({
        email: ME.email,
        password: 'senha-de-12-letras',
        invite_token: 'abc',
      }),
    );
    expect(server.calls[0]?.body).toMatchObject({ invite_token: 'abc' });
  });

  it('useForgotPassword resolves the same for existing and unknown emails', async () => {
    mockApi({ 'POST /auth/password-resets': { status: 202, body: {} } });
    const { result } = renderHook(() => useForgotPassword(), { wrapper });
    await act(async () => {
      const known: unknown = await result.current.mutateAsync('ana@exemplo.com');
      const unknown: unknown = await result.current.mutateAsync('ninguem@exemplo.com');
      expect(known).toEqual(unknown);
    });
  });

  it('useResetPassword puts the new password on the token path', async () => {
    const server = mockApi({ 'PUT /auth/password-resets/tok-1': { status: 204 } });
    const { result } = renderHook(() => useResetPassword(), { wrapper });
    await act(() => result.current.mutateAsync({ token: 'tok-1', password: 'outra-senha-longa' }));
    expect(server.calls[0]).toMatchObject({
      method: 'PUT',
      path: '/auth/password-resets/tok-1',
      body: { password: 'outra-senha-longa' },
    });
  });

  it('useAdminPasswordReset posts the user id and returns the link', async () => {
    const link = {
      link: 'https://atria.test/reset-password/tok',
      expires_at: '2026-11-01T00:00:00Z',
    };
    const server = mockApi({ 'POST /admin/password-resets': { status: 201, body: link } });
    const { result } = renderHook(() => useAdminPasswordReset(), { wrapper });
    await act(async () => {
      expect(await result.current.mutateAsync(ME.id)).toEqual(link);
    });
    expect(server.calls[0]).toMatchObject({
      path: '/admin/password-resets',
      body: { user_id: ME.id },
    });
  });
});
