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

const ENROLLMENT = {
  secret: 'JBSWY3DPEHPK3PXP',
  otpauth_uri: 'otpauth://totp/Atria:ana@exemplo.com?secret=JBSWY3DPEHPK3PXP&issuer=Atria',
};

async function openTwoFactor(routes: Record<string, MockHandler> = {}) {
  const server = mockApi({
    'POST /auth/totp': { status: 201, body: ENROLLMENT },
    'POST /auth/totp/activation': { status: 204 },
    ...routes,
  });
  const view = renderAuthRoute('/two-factor');
  await screen.findByRole('heading', { level: 1, name: 'Verificação em duas etapas' });
  await screen.findByText(ENROLLMENT.secret);
  return { ...view, server };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('TwoFactorScreen', () => {
  it('renders the heading, the qr code and the secret as text', async () => {
    await openTwoFactor();
    expect(screen.getByRole('heading', { level: 1 })).toHaveAttribute('data-page-heading');
    expect(
      screen.getByRole('img', { name: 'QR code para o aplicativo de verificação' }),
    ).toBeInTheDocument();
    expect(screen.getByText(ENROLLMENT.secret)).toBeInTheDocument();
  });

  it('renders the form inside the narrow auth card', async () => {
    await openTwoFactor();
    const form = screen.getByRole('form', { name: 'Verificação em duas etapas' });
    expectInNarrowCard(form);
    expectPrimaryLast(form);
  });

  it('starts the enrollment only once', async () => {
    const { server } = await openTwoFactor();
    expect(server.calls.filter((call) => call.path === '/auth/totp')).toHaveLength(1);
  });

  it('copies the secret with an accessible button', async () => {
    await openTwoFactor();
    const user = userEvent.setup();
    const write = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
    await user.click(screen.getByRole('button', { name: 'Copiar segredo' }));
    expect(write).toHaveBeenCalledWith(ENROLLMENT.secret);
    expect(await screen.findByText('Segredo copiado.')).toBeInTheDocument();
  });

  it('shows a validation error inside the form', async () => {
    await openTwoFactor();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Código de 6 números'), '12');
    await user.click(screen.getByRole('button', { name: 'Ativar' }));
    const form = screen.getByRole('form');
    expect(await within(form).findByText('O código tem 6 números.')).toHaveAttribute(
      'role',
      'alert',
    );
  });

  it('keeps the focus order through the buttons and the field', async () => {
    await openTwoFactor();
    const user = userEvent.setup();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Copiar segredo' })).toHaveFocus();
    await user.tab();
    const code = screen.getByLabelText('Código de 6 números');
    expect(code).toHaveFocus();
    expect(code).toHaveAttribute('inputmode', 'numeric');
    expect(code).not.toHaveAttribute('type', 'number');
    await user.tab();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Ativar' })).toHaveFocus();
  });

  it('disables the button and shows the loading text while sending', async () => {
    await openTwoFactor({ 'POST /auth/totp/activation': { status: 204, hang: true } });
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Código de 6 números'), '123456');
    await user.click(screen.getByRole('button', { name: 'Ativar' }));
    expect(await screen.findByRole('button', { name: 'Ativando…' })).toBeDisabled();
  });

  it('activates two-factor with a valid code', async () => {
    const { server, router } = await openTwoFactor();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Código de 6 números'), '123456');
    await user.click(screen.getByRole('button', { name: 'Ativar' }));
    await waitFor(() => {
      expect(server.calls.find((call) => call.path === '/auth/totp/activation')).toMatchObject({
        path: '/auth/totp/activation',
        body: { code: '123456' },
      });
    });
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/');
    });
  });

  it('keeps the admin on the screen until two-factor is active', async () => {
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    const { router } = await openTwoFactor({
      'POST /auth/totp/activation': problem(401, 'invalid_totp_code'),
    });
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Código de 6 números'), '000000');
    await user.click(screen.getByRole('button', { name: 'Ativar' }));
    expect(await screen.findByText(/Este código não confere/)).toHaveAttribute('role', 'alert');
    expect(router.state.location.pathname).toBe('/two-factor');
    expect(alert).not.toHaveBeenCalled();
    alert.mockRestore();
  });

  it('has no axe violations', async () => {
    const { container } = await openTwoFactor();
    expect(await axe(container)).toHaveNoViolations();
  });
});
