import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { closeCommandPalette } from '../../shared/command-palette/palette-store';
import { renderWithProviders } from '../../shared/test/render';
import { CommandPaletteProvider } from './command-palette-provider';

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function stubApi(palette_shortcut = 'mod+k') {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: string | URL | Request) => {
      const url = new URL(input instanceof Request ? input.url : input, 'http://localhost');
      if (url.pathname === '/api/v1/me/preferences')
        return Promise.resolve(
          json({
            currency: 'BRL',
            locale: 'pt-BR',
            palette_shortcut,
            search_contexts: [],
            theme: 'system',
            timezone: 'America/Sao_Paulo',
          }),
        );
      if (url.pathname === '/api/v1/me')
        return Promise.resolve(json({ id: 'u-1', email: 'a@b.c' }));
      return Promise.resolve(json({ groups: [] }));
    }),
  );
}

async function setup() {
  const view = renderWithProviders(
    <CommandPaletteProvider>
      <label>
        campo
        <input type="text" />
      </label>
    </CommandPaletteProvider>,
  );
  await screen.findByLabelText('campo');
  return view;
}

afterEach(() => {
  closeCommandPalette();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('palette shortcut', () => {
  it('opens with ctrl k on windows and linux', async () => {
    stubApi();
    vi.spyOn(navigator, 'platform', 'get').mockReturnValue('Linux x86_64');
    await setup();
    await userEvent.keyboard('{Control>}k{/Control}');
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it('opens with cmd k on macos', async () => {
    stubApi();
    vi.spyOn(navigator, 'platform', 'get').mockReturnValue('MacIntel');
    await setup();
    await userEvent.keyboard('{Control>}k{/Control}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await userEvent.keyboard('{Meta>}k{/Meta}');
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it('opens even with the focus in a text field', async () => {
    stubApi();
    await setup();
    const field = screen.getByLabelText('campo');
    await userEvent.click(field);
    expect(field).toHaveFocus();
    await userEvent.keyboard('{Control>}k{/Control}');
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(field).not.toHaveValue('k');
  });

  it('uses the shortcut saved in the user preferences', async () => {
    stubApi('mod+j');
    await setup();
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    // Espera a leitura das preferências: só depois o atalho novo vale.
    await waitFor(async () => {
      await userEvent.keyboard('{Control>}j{/Control}');
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  it('prevents the browser default for the shortcut', async () => {
    stubApi();
    await setup();
    const field = screen.getByLabelText('campo');
    const not_prevented = fireEvent.keyDown(field, { key: 'k', ctrlKey: true });
    expect(not_prevented).toBe(false);
    const other = fireEvent.keyDown(field, { key: 'a', ctrlKey: true });
    expect(other).toBe(true);
  });
});
