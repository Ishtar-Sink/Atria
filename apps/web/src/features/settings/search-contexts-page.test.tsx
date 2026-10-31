import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { clearToasts } from '../../shared/toast/toast-store';
import { patches, PREFERENCES, renderSettings, stubApi } from './test-support';

afterEach(() => {
  vi.unstubAllGlobals();
  clearToasts();
});

describe('SearchContextsPage', () => {
  it('saves the default search contexts', async () => {
    const calls = stubApi();
    renderSettings('/settings/search');
    const notes = await screen.findByRole('button', { name: 'Notas' });
    expect(notes).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(notes);
    expect(notes).toHaveAttribute('aria-pressed', 'false');
    await waitFor(() => {
      expect(patches(calls, '/me/preferences')).toEqual([
        { search_contexts: PREFERENCES.search_contexts.filter((item) => item !== 'notes') },
      ]);
    });
    await userEvent.click(notes);
    await waitFor(() => {
      expect(patches(calls, '/me/preferences')).toHaveLength(2);
    });
    expect(patches(calls, '/me/preferences')[1]).toEqual({
      search_contexts: PREFERENCES.search_contexts,
    });
  });

  it('requires at least one context', async () => {
    const calls = stubApi({ preferences: { ...PREFERENCES, search_contexts: ['tasks'] } });
    renderSettings('/settings/search');
    await userEvent.click(await screen.findByRole('button', { name: 'Tarefas' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Escolha ao menos um contexto.');
    expect(screen.getByRole('button', { name: 'Tarefas' })).toHaveAttribute('aria-pressed', 'true');
    expect(patches(calls, '/me/preferences')).toEqual([]);
  });

  it('has no axe violations', async () => {
    stubApi();
    const { container } = renderSettings('/settings/search');
    await screen.findByRole('button', { name: 'Notas' });
    expect(await axe(container)).toHaveNoViolations();
  });
});
