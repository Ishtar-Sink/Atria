import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import {
  expectInNarrowCard,
  expectPrimaryLast,
  mockApi,
  problem,
  renderAuthRoute,
  type MockHandler,
} from '../test-server';

const ME = {
  id: 'u1',
  email: 'ana@exemplo.com',
  role: 'member',
  totp_enabled: false,
  account_complete: true,
};

async function openSignIn(routes: Record<string, MockHandler> = {}) {
  const server = mockApi({ 'GET /setup': { status: 200, body: { required: false } }, ...routes });
  const view = renderAuthRoute('/sign-in');
  await screen.findByRole('heading', { level: 1, name: 'Entrar' });
  return { ...view, server };
}

async function typeCredentials() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('E-mail'), ME.email);
  await user.type(screen.getByLabelText('Senha'), 'qualquer-senha');
  return user;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('SignInScreen', () => {
  it('renders the heading and the subtitle', async () => {
    await openSignIn();
    expect(screen.getByRole('heading', { level: 1 })).toHaveAttribute('data-page-heading');
    expect(screen.getByText('Que bom ter você de volta.')).toBeInTheDocument();
  });

  it('renders the form inside the narrow auth card', async () => {
    await openSignIn();
    const form = screen.getByRole('form', { name: 'Entrar' });
    expectInNarrowCard(form);
    expectPrimaryLast(form);
  });

  it('redirects to setup while the instance has no users', async () => {
    mockApi({ 'GET /setup': { status: 200, body: { required: true } } });
    const { router } = renderAuthRoute('/sign-in');
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/setup');
    });
  });

  it('shows a validation error inside the form', async () => {
    await openSignIn();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Entrar' }));
    const form = screen.getByRole('form');
    expect(await within(form).findByText('Informe um e-mail válido.')).toHaveAttribute(
      'role',
      'alert',
    );
  });

  it('keeps the focus order through fields, link and buttons', async () => {
    await openSignIn();
    const user = userEvent.setup();
    for (const name of [/E-mail/, /Senha/]) {
      await user.tab();
      expect(screen.getByLabelText(name)).toHaveFocus();
    }
    await user.tab();
    expect(screen.getByRole('link', { name: 'Esqueci a senha' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Criar conta' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Entrar' })).toHaveFocus();
  });

  it('disables the button and shows the loading text while sending', async () => {
    await openSignIn({ 'POST /auth/sign-in': { status: 200, hang: true } });
    const user = await typeCredentials();
    await user.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(await screen.findByRole('button', { name: 'Entrando…' })).toBeDisabled();
  });

  it('shows a calm error for wrong credentials and for too many attempts', async () => {
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    let reply = problem(401, 'invalid_credentials');
    await openSignIn({ 'POST /auth/sign-in': () => reply });
    const user = await typeCredentials();
    await user.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(
      await screen.findByText('E-mail ou senha não conferem. Confira e tente de novo.'),
    ).toHaveAttribute('role', 'alert');
    reply = problem(429, 'too_many_attempts');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(await screen.findByText(/Muitas tentativas por agora/)).toHaveAttribute('role', 'alert');
    expect(alert).not.toHaveBeenCalled();
    alert.mockRestore();
  });

  it('signs in without two-factor', async () => {
    const { router, server } = await openSignIn({
      'POST /auth/sign-in': { status: 200, body: ME },
    });
    const user = await typeCredentials();
    await user.click(screen.getByRole('button', { name: 'Entrar' }));
    await waitFor(() => {
      expect(server.calls.some((call) => call.path === '/auth/sign-in')).toBe(true);
    });
    expect(screen.queryByLabelText('Código de 6 números')).not.toBeInTheDocument();
    expect(server.calls.find((call) => call.path === '/auth/sign-in')?.body).toEqual({
      email: ME.email,
      password: 'qualquer-senha',
    });
    await waitFor(() => {
      expect(router.state.location.pathname).not.toBe('/sign-in');
    });
  });

  it('asks for the totp code and signs in with it', async () => {
    const { server, router } = await openSignIn({
      'POST /auth/sign-in': (call) =>
        (call.body as { totp_code?: string }).totp_code === '123456'
          ? { status: 200, body: { ...ME, totp_enabled: true } }
          : problem(401, 'totp_required'),
    });
    const user = await typeCredentials();
    await user.click(screen.getByRole('button', { name: 'Entrar' }));
    const code = await screen.findByLabelText('Código de 6 números');
    await waitFor(() => {
      expect(code).toHaveFocus();
    });
    expect(code).toHaveAttribute('inputmode', 'numeric');
    expect(code).toHaveAttribute('autocomplete', 'one-time-code');
    expect(code).toHaveAttribute('maxlength', '6');
    expect(code).not.toHaveAttribute('type', 'number');
    await user.type(code, '123456');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));
    await waitFor(() => {
      expect(server.calls.at(-1)?.body).toMatchObject({ totp_code: '123456' });
    });
    await waitFor(() => {
      expect(router.state.location.pathname).not.toBe('/sign-in');
    });
  });

  it('shows an error for a wrong totp code', async () => {
    await openSignIn({
      'POST /auth/sign-in': (call) =>
        (call.body as { totp_code?: string }).totp_code === undefined
          ? problem(401, 'totp_required')
          : problem(401, 'invalid_totp_code'),
    });
    const user = await typeCredentials();
    await user.click(screen.getByRole('button', { name: 'Entrar' }));
    await user.type(await screen.findByLabelText('Código de 6 números'), '000000');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(await screen.findByText(/Este código não confere/)).toHaveAttribute('role', 'alert');
  });

  it('sends the admin without two-factor to activation', async () => {
    const { router } = await openSignIn({
      'POST /auth/sign-in': {
        status: 200,
        body: { ...ME, role: 'admin', account_complete: false },
      },
      'POST /auth/totp': {
        status: 201,
        body: {
          secret: 'JBSWY3DPEHPK3PXP',
          otpauth_uri: 'otpauth://totp/Atria:a?secret=JBSWY3DPEHPK3PXP',
        },
      },
    });
    const user = await typeCredentials();
    await user.click(screen.getByRole('button', { name: 'Entrar' }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/two-factor');
    });
  });

  it('links to the password reset', async () => {
    await openSignIn();
    expect(screen.getByRole('link', { name: 'Esqueci a senha' })).toHaveAttribute(
      'href',
      '/forgot-password',
    );
  });

  it('has no axe violations', async () => {
    const { container } = await openSignIn();
    expect(await axe(container)).toHaveNoViolations();
  });
});
