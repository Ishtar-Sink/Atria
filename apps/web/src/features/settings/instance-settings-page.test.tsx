import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { clearToasts } from '../../shared/toast/toast-store';
import { INSTANCE, patches, renderSettings, stubApi } from './test-support';

afterEach(() => {
  vi.unstubAllGlobals();
  clearToasts();
});

const PATH = '/admin/instance/settings';

describe('InstanceSettingsPage', () => {
  it('pd62 types the smtp port without the browser arrows', async () => {
    stubApi();
    renderSettings('/settings/instance');
    const port = await screen.findByLabelText('Porta SMTP');
    expect(port).not.toHaveAttribute('type', 'number');
    expect(port).toHaveAttribute('inputmode', 'numeric');
    expect(port).toHaveValue('587');
  });

  it('turns off the required invite', async () => {
    const calls = stubApi();
    renderSettings('/settings/instance');
    const invite = await screen.findByRole('checkbox', { name: 'Cadastro só com convite' });
    expect(invite).toBeChecked();
    await userEvent.click(invite);
    expect(invite).not.toBeChecked();
    await waitFor(() => {
      expect(patches(calls, PATH)).toEqual([{ invite_required: false }]);
    });
  });

  it('turns on web push when the vapid key is configured', async () => {
    const calls = stubApi({ vapid_key: true });
    renderSettings('/settings/instance');
    const push = await screen.findByRole('checkbox', { name: 'Notificações Web Push' });
    await waitFor(() => {
      expect(push).toBeEnabled();
    });
    await userEvent.click(push);
    await waitFor(() => {
      expect(patches(calls, PATH)).toEqual([{ web_push_enabled: true }]);
    });
  });

  it('disables web push with an explanation when the key is missing', async () => {
    const calls = stubApi({ vapid_key: false });
    renderSettings('/settings/instance');
    const push = await screen.findByRole('checkbox', { name: 'Notificações Web Push' });
    await waitFor(() => {
      expect(push).toBeDisabled();
    });
    expect(screen.getByText(/ATRIA_WEB_PUSH_VAPID_KEY_FILE/)).toBeInTheDocument();
    expect(patches(calls, PATH)).toEqual([]);
  });

  it('saves smtp host, port, user and sender without a password field', async () => {
    const calls = stubApi();
    const { container } = renderSettings('/settings/instance');
    const host = await screen.findByLabelText('Servidor SMTP');
    await userEvent.clear(host);
    await userEvent.type(host, 'smtp.novo.test');
    const port = screen.getByLabelText('Porta SMTP');
    await userEvent.clear(port);
    await userEvent.type(port, '2525');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => {
      expect(patches(calls, PATH)).toEqual([
        {
          smtp_host: 'smtp.novo.test',
          smtp_port: 2525,
          smtp_user: INSTANCE.smtp_user,
          smtp_from: INSTANCE.smtp_from,
        },
      ]);
    });
    expect(container.querySelector('input[type="password"]')).toBeNull();
    expect(screen.queryByLabelText(/senha/i)).toBeNull();
    expect(screen.getByText(/ATRIA_SMTP_PASSWORD_FILE/)).toBeInTheDocument();
  });

  it('rejects an invalid smtp port without sending', async () => {
    const calls = stubApi();
    renderSettings('/settings/instance');
    const port = await screen.findByLabelText('Porta SMTP');
    await userEvent.clear(port);
    await userEvent.type(port, '99999');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Informe uma porta de 1 a 65535.');
    expect(patches(calls, PATH)).toEqual([]);
  });

  it('links roles to the admin users screen', async () => {
    stubApi();
    renderSettings('/settings/instance');
    const section = (await screen.findByRole('heading', { name: 'Papéis' })).closest('section');
    expect(section).not.toBeNull();
    const link = within(section as HTMLElement).getByRole('link', {
      name: 'Gerenciar usuários e papéis',
    });
    expect(link).toHaveAttribute('href', '/admin/users');
    expect(within(section as HTMLElement).getByText('Administrador')).toBeInTheDocument();
  });

  it('shows the forbidden state for non admin users', async () => {
    const calls = stubApi({ role: 'elevated' });
    renderSettings('/settings/instance');
    expect(
      await screen.findByText('Só o administrador altera as configurações da instância.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Salvar' })).toBeNull();
    expect(calls.filter((call) => call.path === PATH)).toEqual([]);
  });

  it('shows the loading and error states', async () => {
    stubApi({ instance: 'loading' });
    const first = renderSettings('/settings/instance');
    expect(await screen.findByRole('status')).toHaveTextContent('Carregando as configurações…');
    first.unmount();

    stubApi({ instance: 'error' });
    renderSettings('/settings/instance');
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível carregar as configurações.',
    );
  });

  it('has no axe violations', async () => {
    stubApi();
    const { container } = renderSettings('/settings/instance');
    await screen.findByLabelText('Servidor SMTP');
    expect(await axe(container)).toHaveNoViolations();
  });
});
