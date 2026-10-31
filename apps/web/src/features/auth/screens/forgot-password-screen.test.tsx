import { screen, within } from '@testing-library/react';
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

const NEUTRAL =
  'Se houver uma conta com este e-mail, enviamos o link. Sem e-mail configurado, peça o link a quem administra o Atria.';

async function openForgot(routes: Record<string, MockHandler> = {}) {
  const server = mockApi({ 'POST /auth/password-resets': { status: 202, body: {} }, ...routes });
  const view = renderAuthRoute('/forgot-password');
  await screen.findByRole('heading', { level: 1, name: 'Esqueci a senha' });
  return { ...view, server };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ForgotPasswordScreen', () => {
  it('renders the heading and the subtitle', async () => {
    await openForgot();
    expect(screen.getByRole('heading', { level: 1 })).toHaveAttribute('data-page-heading');
    expect(screen.getByText(/Digite o e-mail da sua conta/)).toBeInTheDocument();
  });

  it('renders the form inside the narrow auth card', async () => {
    await openForgot();
    const form = screen.getByRole('form', { name: 'Esqueci a senha' });
    expectInNarrowCard(form);
    expectPrimaryLast(form);
  });

  it('shows a validation error inside the form', async () => {
    await openForgot();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('E-mail'), 'sem-arroba');
    await user.click(screen.getByRole('button', { name: 'Enviar link' }));
    const form = screen.getByRole('form');
    expect(await within(form).findByText('Informe um e-mail válido.')).toHaveAttribute(
      'role',
      'alert',
    );
  });

  it('keeps the focus order through the field and buttons', async () => {
    await openForgot();
    const user = userEvent.setup();
    await user.tab();
    expect(screen.getByRole('link', { name: 'Voltar para entrar' })).toHaveFocus();
    await user.tab();
    expect(screen.getByLabelText('E-mail')).toHaveFocus();
    await user.tab();
    expect(screen.getAllByRole('button', { name: 'Voltar para entrar' })[0]).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Enviar link' })).toHaveFocus();
  });

  it('disables the button and shows the loading text while sending', async () => {
    await openForgot({ 'POST /auth/password-resets': { status: 202, hang: true } });
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('E-mail'), 'ana@exemplo.com');
    await user.click(screen.getByRole('button', { name: 'Enviar link' }));
    expect(await screen.findByRole('button', { name: 'Enviando…' })).toBeDisabled();
  });

  it('shows the same message for existing and unknown emails', async () => {
    await openForgot();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('E-mail'), 'ana@exemplo.com');
    await user.click(screen.getByRole('button', { name: 'Enviar link' }));
    const first = (await screen.findByRole('status')).textContent;
    expect(first).toBe(NEUTRAL);
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
    await openForgot();
    await userEvent.setup().type(screen.getByLabelText('E-mail'), 'ninguem@exemplo.com');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Enviar link' }));
    expect((await screen.findByRole('status')).textContent).toBe(first);
  });

  it('shows a calm error when there are too many requests', async () => {
    await openForgot({ 'POST /auth/password-resets': problem(429, 'too_many_attempts') });
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('E-mail'), 'ana@exemplo.com');
    await user.click(screen.getByRole('button', { name: 'Enviar link' }));
    expect(await screen.findByText(/Muitas tentativas por agora/)).toHaveAttribute('role', 'alert');
  });

  it('has no axe violations', async () => {
    const { container } = await openForgot();
    expect(await axe(container)).toHaveNoViolations();
  });
});
