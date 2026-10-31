import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { clearToasts, getToasts } from '../../shared/toast/toast-store';
import { json, patches, PREFERENCES, renderSettings, stubApi } from './test-support';

vi.mock('./settings-options', async (original) => ({
  ...(await original<typeof import('./settings-options')>()),
  availableLocales: () => [
    { value: 'pt-BR', label: 'Português (Brasil)' },
    { value: 'en-US', label: 'English (US)' },
  ],
}));

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  clearToasts();
});

async function choose(trigger: RegExp, option: RegExp) {
  await userEvent.click(await screen.findByRole('button', { name: trigger }));
  await userEvent.click(screen.getByRole('option', { name: option }));
}

describe('UserPreferencesPage', () => {
  it('changes the theme at once and keeps it after reload', async () => {
    const calls = stubApi();
    const view = renderSettings();
    await userEvent.click(await screen.findByRole('radio', { name: 'Escuro' }));
    expect(document.documentElement.dataset['theme']).toBe('dark');
    await waitFor(() => {
      expect(patches(calls, '/me/preferences')).toEqual([{ theme: 'dark' }]);
    });
    expect(localStorage.getItem('atria_theme')).toBe('dark');
    view.unmount();

    stubApi({ preferences: { ...PREFERENCES, theme: 'dark' } });
    renderSettings();
    expect(await screen.findByRole('radio', { name: 'Escuro' })).toBeChecked();
    expect(document.documentElement.dataset['theme']).toBe('dark');
  });

  it('changes the language at once', async () => {
    const calls = stubApi();
    renderSettings();
    await choose(/^Idioma/, /English/);
    expect(await screen.findByRole('button', { name: /^Idioma.*English/ })).toBeInTheDocument();
    await waitFor(() => {
      expect(patches(calls, '/me/preferences')).toEqual([{ locale: 'en-US' }]);
    });
  });

  it('lists time zones and currencies from Intl', async () => {
    stubApi();
    renderSettings();
    await userEvent.click(await screen.findByRole('button', { name: /^Fuso horário/ }));
    expect(screen.getByRole('option', { name: 'America/Sao Paulo' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Europe/Lisbon' })).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    await userEvent.click(screen.getByRole('button', { name: /^Moeda/ }));
    expect(screen.getByRole('option', { name: /\(USD\)$/ })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /\(EUR\)$/ })).toBeInTheDocument();
  });

  it('uses BRL as the default currency', async () => {
    stubApi();
    renderSettings();
    expect(await screen.findByRole('button', { name: /^Moeda.*\(BRL\)/ })).toBeInTheDocument();
  });

  it('saves the timezone and currency', async () => {
    const calls = stubApi();
    renderSettings();
    await choose(/^Fuso horário/, /^Europe\/Lisbon$/);
    await choose(/^Moeda/, /\(USD\)$/);
    await waitFor(() => {
      expect(patches(calls, '/me/preferences')).toEqual([
        { timezone: 'Europe/Lisbon' },
        { currency: 'USD' },
      ]);
    });
    expect(getToasts().some((toast) => toast.message_key === 'settings.saved')).toBe(true);
  });

  it('rolls back and shows the undo notice when the server rejects', async () => {
    stubApi({ patch_preferences: json({ code: 'internal_error', title: 'x' }, 500) });
    renderSettings();
    await userEvent.click(await screen.findByRole('radio', { name: 'Escuro' }));
    await waitFor(() => {
      expect(getToasts().some((toast) => toast.message_key === 'settings.undo_notice')).toBe(true);
    });
    await waitFor(() => {
      expect(screen.getByRole('radio', { name: 'Seguir o sistema' })).toBeChecked();
    });
  });

  it('shows the validation error inside the form with role alert', async () => {
    stubApi({
      patch_preferences: json({ code: 'validation_failed', title: 'x', errors: [] }, 422),
    });
    renderSettings();
    await choose(/^Moeda/, /\(USD\)$/);
    const form = await screen.findByRole('form', { name: 'Suas preferências' });
    expect(await within(form).findByRole('alert')).toHaveTextContent('Algum valor não é válido');
  });

  it('has no axe violations', async () => {
    stubApi();
    const { container } = renderSettings();
    await screen.findByRole('radio', { name: 'Escuro' });
    expect(await axe(container)).toHaveNoViolations();
  });

  it('pd10 switches the create options between grid and list', async () => {
    const calls = stubApi();
    renderSettings();
    const group = await screen.findByRole('radiogroup', { name: 'Opções do botão de criar' });
    await userEvent.click(within(group).getByRole('radio', { name: 'Em lista' }));
    expect(within(group).getByRole('radio', { name: 'Em lista' })).toBeChecked();
    expect(patches(calls, '/me/preferences')).toEqual([]);
  });

  it('pd10 defaults to grid without a saved choice', async () => {
    stubApi();
    renderSettings();
    const group = await screen.findByRole('radiogroup', { name: 'Opções do botão de criar' });
    expect(within(group).getByRole('radio', { name: 'Em grade' })).toBeChecked();
  });

  it('pd10 saves the layout per user and reads it after remount', async () => {
    stubApi({ user_id: 'u1' });
    const first = renderSettings();
    await userEvent.click(await screen.findByRole('radio', { name: 'Em lista' }));
    first.unmount();

    stubApi({ user_id: 'u1' });
    const second = renderSettings();
    await waitFor(() => {
      expect(screen.getByRole('radio', { name: 'Em lista' })).toBeChecked();
    });
    second.unmount();

    stubApi({ user_id: 'u2' });
    renderSettings();
    await waitFor(() => {
      expect(screen.getByRole('radio', { name: 'Em grade' })).toBeChecked();
    });
  });

  it('pd10 ignores storage errors', async () => {
    stubApi();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    renderSettings();
    await userEvent.click(await screen.findByRole('radio', { name: 'Em lista' }));
    expect(screen.getByRole('radio', { name: 'Em lista' })).toBeChecked();
  });

  it('pd62 uses the custom select and the segmented theme', async () => {
    stubApi();
    const { container } = renderSettings();
    const theme = await screen.findByRole('radiogroup', { name: 'Tema' });
    expect(
      within(theme)
        .getAllByRole('radio')
        .map((radio) => radio.parentElement?.textContent),
    ).toEqual(['Seguir o sistema', 'Claro', 'Escuro']);
    for (const name of [/^Idioma/, /^Fuso horário/, /^Moeda/]) {
      expect(screen.getByRole('button', { name })).toHaveAttribute('aria-haspopup', 'listbox');
    }
    expect(container.querySelector('select')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: /^Fuso horário/ }));
    await userEvent.keyboard('E');
    expect(await screen.findAllByRole('option')).not.toHaveLength(0);
  });

  it('pd19 centers the header and the form in the form column', async () => {
    stubApi();
    renderSettings();
    const form = await screen.findByRole('form', { name: 'Suas preferências' });
    const heading = screen.getByRole('heading', { level: 1, name: 'Configurações' });
    const column = heading.closest('header')?.parentElement?.parentElement;
    expect(column).toBeTruthy();
    expect(column?.contains(form)).toBe(true);
  });

  it('pd23 lists Suas preferências, Busca, Dashboard and Instância in the settings sections', async () => {
    stubApi({ role: 'admin' });
    const admin = renderSettings();
    const nav = await screen.findByRole('navigation', { name: 'Seções de Configurações' });
    await waitFor(() => {
      expect(
        within(nav)
          .getAllByRole('link')
          .map((link) => link.textContent),
      ).toEqual(['Suas preferências', 'Busca', 'Dashboard', 'Instância']);
    });
    admin.unmount();

    stubApi({ role: 'user' });
    renderSettings();
    const user_nav = await screen.findByRole('navigation', { name: 'Seções de Configurações' });
    await waitFor(() => {
      expect(
        within(user_nav)
          .getAllByRole('link')
          .map((link) => link.textContent),
      ).toEqual(['Suas preferências', 'Busca', 'Dashboard']);
    });
  });
});
