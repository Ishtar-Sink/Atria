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

const PASSWORD = 'senha-bem-longa-1';
const ME = {
  id: 'u2',
  email: 'bia@exemplo.com',
  role: 'member',
  totp_enabled: false,
  account_complete: true,
};

async function openSignUp(path = '/sign-up', routes: Record<string, MockHandler> = {}) {
  const server = mockApi({ 'POST /auth/sign-up': { status: 201, body: ME }, ...routes });
  const view = renderAuthRoute(path);
  await screen.findByRole('heading', { level: 1, name: 'Criar conta' });
  return { ...view, server };
}

async function fill() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('E-mail'), ME.email);
  await user.type(screen.getByLabelText('Senha'), PASSWORD);
  await user.type(screen.getByLabelText('Repita a senha'), PASSWORD);
  return user;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('SignUpScreen', () => {
  it('renders the heading and the subtitle', async () => {
    await openSignUp();
    expect(screen.getByRole('heading', { level: 1 })).toHaveAttribute('data-page-heading');
    expect(screen.getByText(/Seus dados ficam só nesta instância/)).toBeInTheDocument();
  });

  it('renders the form inside the narrow auth card', async () => {
    await openSignUp();
    const form = screen.getByRole('form', { name: 'Criar conta' });
    expectInNarrowCard(form);
    expectPrimaryLast(form);
  });

  it('shows a validation error inside the form', async () => {
    await openSignUp();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('E-mail'), ME.email);
    await user.type(screen.getByLabelText('Senha'), PASSWORD);
    await user.type(screen.getByLabelText('Repita a senha'), 'outra-senha-longa');
    await user.click(screen.getByRole('button', { name: 'Criar conta' }));
    const form = screen.getByRole('form');
    expect(await within(form).findByText('As senhas não são iguais.')).toHaveAttribute(
      'role',
      'alert',
    );
  });

  it('keeps the focus order through fields and buttons', async () => {
    await openSignUp();
    const user = userEvent.setup();
    for (const name of ['E-mail', 'Senha', 'Repita a senha']) {
      await user.tab();
      expect(screen.getByLabelText(name)).toHaveFocus();
    }
    await user.tab();
    expect(screen.getByRole('button', { name: 'Já tenho conta' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Criar conta' })).toHaveFocus();
  });

  it('disables the button and shows the loading text while sending', async () => {
    await openSignUp('/sign-up', { 'POST /auth/sign-up': { status: 201, hang: true } });
    const user = await fill();
    await user.click(screen.getByRole('button', { name: 'Criar conta' }));
    expect(await screen.findByRole('button', { name: 'Criando…' })).toBeDisabled();
  });

  it('signs up with an invite from the url', async () => {
    const { server, router } = await openSignUp('/sign-up?invite=tok-123');
    const user = await fill();
    await user.click(screen.getByRole('button', { name: 'Criar conta' }));
    await waitFor(() => {
      expect(server.calls.at(-1)?.body).toEqual({
        email: ME.email,
        password: PASSWORD,
        invite_token: 'tok-123',
      });
    });
    await waitFor(() => {
      expect(router.state.location.pathname).not.toBe('/sign-up');
    });
  });

  it('signs up without invite when not required', async () => {
    const { server } = await openSignUp();
    const user = await fill();
    await user.click(screen.getByRole('button', { name: 'Criar conta' }));
    await waitFor(() => {
      expect(server.calls.at(-1)?.body).toEqual({ email: ME.email, password: PASSWORD });
    });
  });

  it('shows invalid invite for a used or expired invite', async () => {
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    await openSignUp('/sign-up?invite=velho', {
      'POST /auth/sign-up': problem(400, 'invite_invalid'),
    });
    const user = await fill();
    await user.click(screen.getByRole('button', { name: 'Criar conta' }));
    expect(
      await screen.findByText('Este convite não vale mais. Peça um novo a quem te convidou.'),
    ).toHaveAttribute('role', 'alert');
    expect(screen.getByLabelText('E-mail')).toHaveValue(ME.email);
    expect(screen.getByLabelText('Senha')).toHaveValue(PASSWORD);
    expect(alert).not.toHaveBeenCalled();
    alert.mockRestore();
  });

  it('asks for an invite when it is required', async () => {
    await openSignUp('/sign-up', { 'POST /auth/sign-up': problem(403, 'invite_required') });
    const user = await fill();
    await user.click(screen.getByRole('button', { name: 'Criar conta' }));
    expect(await screen.findByText(/só aceita cadastro por convite/)).toHaveAttribute(
      'role',
      'alert',
    );
  });

  it('has no axe violations', async () => {
    const { container } = await openSignUp();
    expect(await axe(container)).toHaveNoViolations();
  });
});
