import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { renderSettings, stubApi } from './test-support';
import { DASHBOARD_BLOCK_OPTIONS } from './use-dashboard-blocks';

const KEY = 'atria.dashboard.hidden_blocks.u1';

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('DashboardSettingsPage', () => {
  it('pd30 matches the dashboard block ids', () => {
    expect(DASHBOARD_BLOCK_OPTIONS.map((option) => option.id)).toEqual([
      'today',
      'reminders',
      'upcoming',
      'journal',
      'balance',
      'reading',
    ]);
  });

  it('pd30 lists the dashboard blocks with a visibility toggle', async () => {
    stubApi();
    renderSettings('/settings/dashboard');
    for (const name of [
      'Tarefas de hoje',
      'Lembretes de hoje',
      'Próximos dias',
      'Diário',
      'Dinheiro',
      'Leituras',
    ]) {
      expect(await screen.findByRole('checkbox', { name })).toBeChecked();
    }
  });

  it('pd30 hides a block and saves it in the dashboard key', async () => {
    stubApi();
    renderSettings('/settings/dashboard');
    const reading = await screen.findByRole('checkbox', { name: 'Leituras' });
    await waitFor(() => {
      expect(reading).toBeEnabled();
    });
    await userEvent.click(reading);
    expect(reading).not.toBeChecked();
    await waitFor(() => {
      expect(localStorage.getItem(KEY)).toBe('["reading"]');
    });
    await userEvent.click(reading);
    expect(reading).toBeChecked();
    expect(localStorage.getItem(KEY)).toBe('[]');
  });

  it('pd30 ignores storage errors', async () => {
    stubApi();
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    renderSettings('/settings/dashboard');
    const journal = await screen.findByRole('checkbox', { name: 'Diário' });
    expect(journal).toBeChecked();
    await userEvent.click(journal);
    expect(journal).not.toBeChecked();
  });

  it('pd30 waits for the person before showing the toggles', async () => {
    stubApi({ me: 'loading' });
    renderSettings('/settings/dashboard');
    expect(await screen.findByRole('status')).toHaveTextContent('Carregando as configurações…');
    expect(screen.queryByRole('checkbox')).toBeNull();
  });

  it('pd30 shows the saved hidden block as off from the start', async () => {
    localStorage.setItem(KEY, '["reading"]');
    stubApi();
    renderSettings('/settings/dashboard');
    expect(await screen.findByRole('checkbox', { name: 'Leituras' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Diário' })).toBeChecked();
  });

  it('pd15 explains the eye of the sensitive blocks', async () => {
    stubApi();
    renderSettings('/settings/dashboard');
    expect(
      await screen.findByText(
        /Nos blocos com informação sensível \(Diário e Dinheiro\), o olho esconde o conteúdo sem tirar o bloco\./,
      ),
    ).toBeInTheDocument();
  });

  it('has no axe violations', async () => {
    stubApi();
    const { container } = renderSettings('/settings/dashboard');
    await screen.findByRole('checkbox', { name: 'Leituras' });
    expect(await axe(container)).toHaveNoViolations();
  });
});
