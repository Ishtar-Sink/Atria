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
} from '../test-server';

const PASSWORD = 'senha-bem-longa-1';
const ME = {
  id: 'u1',
  email: 'ana@exemplo.com',
  role: 'admin',
  totp_enabled: false,
  account_complete: false,
};

async function openSetup(extra: Record<string, Parameters<typeof mockApi>[0][string]> = {}) {
  const server = mockApi({
    'GET /setup': { status: 200, body: { required: true } },
    'POST /auth/totp': {
      status: 201,
      body: {
        secret: 'JBSWY3DPEHPK3PXP',
        otpauth_uri: 'otpauth://totp/Atria:a?secret=JBSWY3DPEHPK3PXP',
      },
    },
    ...extra,
  });
  const view = renderAuthRoute('/setup');
  await screen.findByRole('heading', { level: 1, name: 'Bem-vindo ao Atria' });
  return { ...view, server };
}

async function fill(email = ME.email, password = PASSWORD, confirmation = PASSWORD) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('E-mail'), email);
  await user.type(screen.getByLabelText('Senha'), password);
  await user.type(screen.getByLabelText('Repita a senha'), confirmation);
  return user;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('SetupScreen', () => {
  it('renders the heading and the subtitle', async () => {
    await openSetup();
    expect(screen.getByRole('heading', { level: 1 })).toHaveAttribute('data-page-heading');
    expect(screen.getByText(/Crie a conta de quem administra/)).toBeInTheDocument();
  });

  it('renders the form inside the narrow auth card', async () => {
    await openSetup();
    const form = screen.getByRole('form', { name: 'Bem-vindo ao Atria' });
    expectInNarrowCard(form);
    expectPrimaryLast(form);
  });

  it('shows a validation error inside the form', async () => {
    await openSetup();
    const user = await fill(ME.email, 'curta', 'curta');
    await user.click(screen.getByRole('button', { name: 'Criar conta' }));
    const form = screen.getByRole('form');
    expect(
      await within(form).findByText('A senha precisa ter pelo menos 12 caracteres.'),
    ).toHaveAttribute('role', 'alert');
  });

  it('keeps the focus order through fields and buttons', async () => {
    await openSetup();
    const user = userEvent.setup();
    await user.tab();
    expect(screen.getByLabelText('E-mail')).toHaveFocus();
    await user.tab();
    expect(screen.getByLabelText('Senha')).toHaveFocus();
    await user.tab();
    expect(screen.getByLabelText('Repita a senha')).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Criar conta' })).toHaveFocus();
  });

  it('disables the button and shows the loading text while sending', async () => {
    await openSetup({ 'POST /setup': { status: 201, hang: true } });
    const user = await fill();
    await user.click(screen.getByRole('button', { name: 'Criar conta' }));
    const button = await screen.findByRole('button', { name: 'Criando…' });
    expect(button).toBeDisabled();
  });

  it('shows a server error in an alert without window.alert', async () => {
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    await openSetup({ 'POST /setup': problem(422, 'validation_failed') });
    const user = await fill();
    await user.click(screen.getByRole('button', { name: 'Criar conta' }));
    expect(
      await screen.findByText('Alguns dados não são válidos. Confira e tente de novo.'),
    ).toHaveAttribute('role', 'alert');
    expect(alert).not.toHaveBeenCalled();
    alert.mockRestore();
  });

  it('creates the admin and asks for two-factor', async () => {
    const { server, router } = await openSetup({ 'POST /setup': { status: 201, body: ME } });
    const user = await fill();
    await user.click(screen.getByRole('button', { name: 'Criar conta' }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/two-factor');
    });
    expect(
      server.calls.find((call) => call.path === '/setup' && call.method === 'POST')?.body,
    ).toEqual({
      email: ME.email,
      password: PASSWORD,
    });
    expect(
      await screen.findByText('Conta criada. Falta ativar a verificação em duas etapas.'),
    ).toBeInTheDocument();
  });

  it('redirects to sign-in when the instance already has users', async () => {
    let done = false;
    const { router } = await openSetup({
      'GET /setup': () => ({ status: 200, body: { required: !done } }),
      'POST /setup': () => {
        done = true;
        return problem(409, 'setup_already_done');
      },
    });
    const user = await fill();
    await user.click(screen.getByRole('button', { name: 'Criar conta' }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/sign-in');
    });
  });

  it('has no axe violations', async () => {
    const { container } = await openSetup();
    expect(await axe(container)).toHaveNoViolations();
  });
});
