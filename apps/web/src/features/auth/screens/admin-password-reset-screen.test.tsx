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

const LINK = 'https://atria.exemplo.com/reset-password/tok-unico';
const USER_ID = '0190c8d0-0000-7000-8000-000000000002';

async function openAdmin(routes: Record<string, MockHandler> = {}) {
  const server = mockApi({
    'POST /admin/password-resets': {
      status: 201,
      body: { link: LINK, expires_at: '2026-11-01T00:00:00Z' },
    },
    ...routes,
  });
  const view = renderAuthRoute(`/admin/users/${USER_ID}/password-reset`);
  await screen.findByRole('heading', { level: 1, name: 'Link de redefinição de senha' });
  return { ...view, server };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('AdminPasswordResetScreen', () => {
  it('renders the heading and the subtitle', async () => {
    await openAdmin();
    expect(screen.getByRole('heading', { level: 1 })).toHaveAttribute('data-page-heading');
    expect(screen.getByText(/Gere um link de uso único/)).toBeInTheDocument();
  });

  it('renders the form inside the narrow auth card', async () => {
    await openAdmin();
    const form = screen.getByRole('form', { name: 'Link de redefinição de senha' });
    expectInNarrowCard(form);
    expectPrimaryLast(form);
    const buttons = within(form)
      .getAllByRole('button')
      .map((button) => button.textContent);
    expect(buttons.indexOf('Cancelar')).toBeLessThan(buttons.indexOf('Gerar link'));
  });

  it('keeps the focus order through the buttons', async () => {
    await openAdmin();
    const user = userEvent.setup();
    // O layout do app tem a navegação antes do cartão: a ordem vale a partir do título.
    screen.getByRole('heading', { level: 1, name: 'Link de redefinição de senha' }).focus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Gerar link' })).toHaveFocus();
  });

  it('disables the button and shows the loading text while sending', async () => {
    await openAdmin({ 'POST /admin/password-resets': { status: 201, hang: true } });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Gerar link' }));
    expect(await screen.findByRole('button', { name: 'Gerando…' })).toBeDisabled();
  });

  it('shows a server error in an alert without window.alert', async () => {
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    await openAdmin({ 'POST /admin/password-resets': problem(404, 'user_not_found') });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Gerar link' }));
    expect(await screen.findByText(/Não encontramos esta pessoa/)).toHaveAttribute('role', 'alert');
    expect(alert).not.toHaveBeenCalled();
    alert.mockRestore();
  });

  it('generates and copies a single-use reset link', async () => {
    const { server } = await openAdmin();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Gerar link' }));
    const field = await screen.findByLabelText('Link de redefinição');
    expect(field).toHaveValue(LINK);
    expect(field).toHaveAttribute('readonly');
    expect(server.calls.at(-1)).toMatchObject({
      path: '/admin/password-resets',
      body: { user_id: USER_ID },
    });
    const write = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
    await user.click(screen.getByRole('button', { name: 'Copiar link' }));
    expect(write).toHaveBeenCalledWith(LINK);
    const notice = await screen.findByText('Link copiado.');
    expect(notice).toHaveAttribute('aria-live', 'polite');
  });

  it('goes back to the user list on cancel', async () => {
    const { router } = await openAdmin();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/admin/users');
    });
  });

  it('has no axe violations', async () => {
    const { container } = await openAdmin();
    expect(await axe(container)).toHaveNoViolations();
  });
});
