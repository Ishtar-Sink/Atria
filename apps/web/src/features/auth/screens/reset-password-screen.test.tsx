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

const PASSWORD = 'outra-senha-longa';

async function openReset(routes: Record<string, MockHandler> = {}) {
  const server = mockApi({
    'PUT /auth/password-resets/tok-1': { status: 204 },
    'GET /setup': { status: 200, body: { required: false } },
    ...routes,
  });
  const view = renderAuthRoute('/reset-password/tok-1');
  await screen.findByRole('heading', { level: 1, name: 'Nova senha' });
  return { ...view, server };
}

async function fill(confirmation = PASSWORD) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Senha'), PASSWORD);
  await user.type(screen.getByLabelText('Repita a senha'), confirmation);
  return user;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ResetPasswordScreen', () => {
  it('renders the heading and the subtitle', async () => {
    await openReset();
    expect(screen.getByRole('heading', { level: 1 })).toHaveAttribute('data-page-heading');
    expect(screen.getByText(/O link vale uma vez só/)).toBeInTheDocument();
  });

  it('renders the form inside the narrow auth card', async () => {
    await openReset();
    const form = screen.getByRole('form', { name: 'Nova senha' });
    expectInNarrowCard(form);
    expectPrimaryLast(form);
  });

  it('shows a validation error inside the form', async () => {
    await openReset();
    const user = await fill('diferente-da-outra');
    await user.click(screen.getByRole('button', { name: 'Redefinir senha' }));
    const form = screen.getByRole('form');
    expect(await within(form).findByText('As senhas não são iguais.')).toHaveAttribute(
      'role',
      'alert',
    );
  });

  it('keeps the focus order through fields and buttons', async () => {
    await openReset();
    const user = userEvent.setup();
    await user.tab();
    expect(screen.getByLabelText('Senha')).toHaveFocus();
    await user.tab();
    expect(screen.getByLabelText('Repita a senha')).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Redefinir senha' })).toHaveFocus();
  });

  it('disables the button and shows the loading text while sending', async () => {
    await openReset({ 'PUT /auth/password-resets/tok-1': { status: 204, hang: true } });
    const user = await fill();
    await user.click(screen.getByRole('button', { name: 'Redefinir senha' }));
    expect(await screen.findByRole('button', { name: 'Redefinindo…' })).toBeDisabled();
  });

  it('resets the password once', async () => {
    const { server, router } = await openReset();
    const user = await fill();
    await user.click(screen.getByRole('button', { name: 'Redefinir senha' }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/sign-in');
    });
    expect(server.calls.find((call) => call.method === 'PUT')?.body).toEqual({
      password: PASSWORD,
    });
    expect(
      await screen.findByText('Senha redefinida. Entre com a nova senha.'),
    ).toBeInTheDocument();
  });

  it('refuses a used token', async () => {
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    const { router } = await openReset({
      'PUT /auth/password-resets/tok-1': problem(400, 'reset_token_invalid'),
    });
    const user = await fill();
    await user.click(screen.getByRole('button', { name: 'Redefinir senha' }));
    expect(await screen.findByText(/Este link não vale mais/)).toHaveAttribute('role', 'alert');
    expect(screen.getByRole('link', { name: 'Pedir outro link' })).toHaveAttribute(
      'href',
      '/forgot-password',
    );
    expect(router.state.location.pathname).toBe('/reset-password/tok-1');
    expect(alert).not.toHaveBeenCalled();
    alert.mockRestore();
  });

  it('has no axe violations', async () => {
    const { container } = await openReset();
    expect(await axe(container)).toHaveNoViolations();
  });
});
