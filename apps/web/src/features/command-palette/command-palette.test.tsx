import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { closeCommandPalette } from '../../shared/command-palette/palette-store';
import { renderWithProviders } from '../../shared/test/render';
import { CommandPaletteProvider } from './command-palette-provider';
import { PaletteTrigger } from './palette-trigger';
import palette_css from './command-palette.css?raw';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

interface Call {
  url: URL;
}

interface ApiOptions {
  search_contexts?: string[];
  search?: (call: Call) => Response | Promise<Response>;
}

const NOTES_RESULT = {
  groups: [
    {
      context: 'notes',
      items: [
        { entity_type: 'note', id: 'n-1', title: 'Ideias de viagem' },
        { entity_type: 'note', id: 'n-2', title: 'Ideias de livro' },
      ],
    },
    {
      context: 'tasks',
      items: [{ entity_type: 'task', id: 't-1', title: 'Ideias para a casa' }],
    },
  ],
};

function stubApi(options: ApiOptions = {}) {
  const searches: Call[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((input: string | URL | Request) => {
      const url = new URL(input instanceof Request ? input.url : input, 'http://localhost');
      if (url.pathname === '/api/v1/me/preferences')
        return Promise.resolve(
          json({
            currency: 'BRL',
            locale: 'pt-BR',
            palette_shortcut: 'mod+k',
            search_contexts: options.search_contexts ?? [],
            theme: 'system',
            timezone: 'America/Sao_Paulo',
          }),
        );
      if (url.pathname === '/api/v1/me')
        return Promise.resolve(json({ id: 'u-1', email: 'a@b.c' }));
      if (url.pathname === '/api/v1/search') {
        const call = { url };
        searches.push(call);
        return Promise.resolve((options.search ?? (() => json(NOTES_RESULT)))(call));
      }
      return Promise.resolve(json({}, 404));
    }),
  );
  return searches;
}

async function setup() {
  const view = renderWithProviders(
    <CommandPaletteProvider>
      <PaletteTrigger />
    </CommandPaletteProvider>,
  );
  await screen.findByText('Ctrl K', { selector: '.command-palette-kbd' });
  return view;
}

async function openFromTrigger() {
  await userEvent.click(trigger());
  return screen.findByRole('dialog');
}

/** O gatilho da feature; o layout do app tem o seu, com o mesmo texto. */
const trigger = () => {
  const el = document.querySelector<HTMLElement>('.command-palette-trigger');
  if (el === null) throw new Error('palette trigger not rendered');
  return el;
};
const input = () => screen.getByRole('combobox');

afterEach(() => {
  closeCommandPalette();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('CommandPalette', () => {
  it('opens from the topbar trigger', async () => {
    stubApi();
    await setup();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await openFromTrigger();
    expect(input()).toHaveFocus();
  });

  it('shows the shortcut hint on the trigger', async () => {
    stubApi();
    vi.spyOn(navigator, 'platform', 'get').mockReturnValue('Linux x86_64');
    await setup();
    await screen.findByText('Ctrl K', { selector: '.command-palette-kbd' });
    expect(within(trigger()).getByText('Ctrl K')).toBeInTheDocument();
  });

  it('is a dialog with a label and traps the focus', async () => {
    stubApi();
    await setup();
    const dialog = await openFromTrigger();
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByRole('dialog', { name: 'Paleta de comandos' })).toBe(dialog);
    const focusable = [input(), ...within(dialog).getAllByRole('button')];
    const last = focusable[focusable.length - 1];
    last?.focus();
    await userEvent.tab();
    expect(input()).toHaveFocus();
    await userEvent.tab({ shift: true });
    expect(last).toHaveFocus();
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it('navigates results with arrow keys and opens with enter', async () => {
    stubApi();
    const { router } = await setup();
    await openFromTrigger();
    await userEvent.type(input(), 'ideias');
    const options = await screen.findAllByRole('option');
    expect(options[0]).toHaveAttribute('aria-selected', 'true');
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getAllByRole('option')[1]).toHaveAttribute('aria-selected', 'true');
    expect(input()).toHaveAttribute('aria-activedescendant', options[1]?.id);
    await userEvent.keyboard('{Enter}');
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/notes/n-2');
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes with escape and returns the focus to the trigger', async () => {
    stubApi();
    await setup();
    await openFromTrigger();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger()).toHaveFocus();
  });

  it('shows recent items and create actions when empty', async () => {
    stubApi();
    localStorage.setItem(
      'atria.command_palette.recent',
      JSON.stringify([{ id: 'n-9', type: 'note', title: 'Nota recente' }]),
    );
    await setup();
    await openFromTrigger();
    expect(screen.getByText('Recentes')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Nota recente/ })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Criar nota/ })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Criar tarefa/ })).toBeInTheDocument();
  });

  it('searches every context by default', async () => {
    const searches = stubApi();
    await setup();
    await openFromTrigger();
    await userEvent.type(input(), 'ideias');
    await screen.findAllByRole('option');
    expect(searches.at(-1)?.url.searchParams.get('q')).toBe('ideias');
    expect(searches.at(-1)?.url.searchParams.has('contexts')).toBe(false);
    expect(screen.getByRole('button', { name: 'Tudo' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Tarefas', { selector: 'li' })).toBeInTheDocument();
  });

  it('searches only the chosen contexts', async () => {
    const searches = stubApi();
    await setup();
    await openFromTrigger();
    await userEvent.click(screen.getByRole('button', { name: 'Notas' }));
    await userEvent.click(screen.getByRole('button', { name: 'Tarefas' }));
    expect(screen.getByRole('button', { name: 'Notas' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.type(input(), 'ideias');
    await waitFor(() => {
      expect(searches.at(-1)?.url.searchParams.get('contexts')).toBe('notes,tasks');
    });
  });

  it('starts with the default contexts from the preferences', async () => {
    const searches = stubApi({ search_contexts: ['journal'] });
    await setup();
    await openFromTrigger();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Diário' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
    });
    await userEvent.type(input(), 'ideias');
    await waitFor(() => {
      expect(searches.at(-1)?.url.searchParams.get('contexts')).toBe('journal');
    });
  });

  it('searches tags with the hash prefix and skips the server for actions', async () => {
    const searches = stubApi();
    await setup();
    await openFromTrigger();
    await userEvent.type(input(), '#casa');
    await screen.findAllByRole('option');
    expect(searches.at(-1)?.url.searchParams.get('q')).toBe('#casa');
    const before = searches.length;
    await userEvent.clear(input());
    await userEvent.type(input(), '>meta');
    expect(await screen.findByRole('option', { name: /Criar meta/ })).toBeInTheDocument();
    expect(searches.length).toBe(before);
  });

  it('shows the loading, empty and error states', async () => {
    stubApi({ search: () => json({ groups: [] }) });
    await setup();
    await openFromTrigger();
    await userEvent.type(input(), 'nada');
    expect(await screen.findByText('Nada encontrado')).toBeInTheDocument();
    closeCommandPalette();

    vi.unstubAllGlobals();
    stubApi({ search: () => new Promise<Response>(() => undefined) });
    await openFromTrigger();
    await userEvent.type(input(), 'espera');
    expect(await screen.findByText('Buscando…')).toBeInTheDocument();
    closeCommandPalette();

    vi.unstubAllGlobals();
    stubApi({
      search: () => json({ title: 'x', code: 'internal_error', errors: [] }, 500),
    });
    await openFromTrigger();
    await userEvent.type(input(), 'falha');
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível buscar agora');
  });

  it('applies the blurred backdrop class', async () => {
    stubApi();
    await setup();
    await openFromTrigger();
    expect(document.querySelector('.command-palette-overlay')).not.toBeNull();
  });

  // Regressão (TASK-35): a `-webkit-backdrop-filter` escrita depois da forma sem prefixo fazia o
  // Lightning CSS do build apagar a `backdrop-filter`, e o Chrome mostrava o fundo sem desfoque.
  it('keeps the unprefixed backdrop blur for the build to prefix', () => {
    const overlay = /\.command-palette-overlay \{([^}]*)\}/.exec(palette_css)?.[1] ?? '';
    expect(overlay).toMatch(/(^|[^-])backdrop-filter: blur\(/);
    expect(overlay).not.toContain('-webkit-backdrop-filter');
  });

  it('has no axe violations', async () => {
    stubApi();
    const { container } = await setup();
    await openFromTrigger();
    await userEvent.type(input(), 'ideias');
    await screen.findAllByRole('option');
    expect(await axe(container)).toHaveNoViolations();
  });
});
