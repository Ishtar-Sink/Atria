import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { closeCommandPalette } from '../../shared/command-palette/palette-store';
import { clearToasts, getToasts } from '../../shared/toast/toast-store';
import { renderWithProviders } from '../../shared/test/render';
import { CommandPaletteProvider } from './command-palette-provider';
import { PaletteTrigger } from './palette-trigger';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

interface Call {
  method: string;
  path: string;
  body: unknown;
}

function stubApi(create: () => Response | Promise<Response>) {
  const calls: Call[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(input instanceof Request ? input.url : input, 'http://localhost');
      if (url.pathname === '/api/v1/me/preferences')
        return Promise.resolve(
          json({
            currency: 'BRL',
            locale: 'pt-BR',
            palette_shortcut: 'mod+k',
            search_contexts: [],
            theme: 'system',
            timezone: 'America/Sao_Paulo',
          }),
        );
      if (url.pathname === '/api/v1/me')
        return Promise.resolve(json({ id: 'u-1', email: 'a@b.c' }));
      const call: Call = {
        method: init?.method ?? 'GET',
        path: url.pathname,
        body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
      };
      calls.push(call);
      return Promise.resolve(call.method === 'POST' ? create() : json({}));
    }),
  );
  return calls;
}

async function startQuickNote() {
  const view = renderWithProviders(
    <CommandPaletteProvider>
      <PaletteTrigger />
    </CommandPaletteProvider>,
  );
  await screen.findByText(/^(Ctrl K|⌘ K)$/, { selector: '.command-palette-kbd' });
  const trigger = document.querySelector('.command-palette-trigger');
  if (trigger === null) throw new Error('palette trigger not rendered');
  await userEvent.click(trigger);
  await userEvent.click(await screen.findByRole('option', { name: /Criar nota/ }));
  return view;
}

afterEach(() => {
  closeCommandPalette();
  clearToasts();
  vi.unstubAllGlobals();
});

describe('quick create', () => {
  it('creates a note with only the title', async () => {
    const calls = stubApi(() => json({ id: 'n-1', title: 'Ideia' }, 201));
    await startQuickNote();
    await userEvent.type(screen.getByLabelText('Título'), 'Ideia solta');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(await screen.findByText('Criado: Ideia solta')).toBeInTheDocument();
    const post = calls.find((call) => call.method === 'POST');
    expect(post?.path).toBe('/api/v1/notes');
    expect(post?.body).toEqual({ title: 'Ideia solta', body: '' });
  });

  it('keeps the note saved with minimal fields when closed', async () => {
    const calls = stubApi(() => json({ id: 'n-1', title: 'Ideia' }, 201));
    await startQuickNote();
    await userEvent.type(screen.getByLabelText('Título'), 'Guardar{Enter}');
    expect(await screen.findByText('Criado: Guardar')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(calls.filter((call) => call.method === 'POST')).toHaveLength(1);
    expect(calls.some((call) => call.method === 'DELETE')).toBe(false);
  });

  it('opens the entity screen with open to complete', async () => {
    stubApi(() => json({ id: 'n-7', title: 'Ideia' }, 201));
    const { router } = await startQuickNote();
    await userEvent.type(screen.getByLabelText('Título'), 'Completar{Enter}');
    const open = await screen.findByRole('button', { name: 'Abrir para completar' });
    await waitFor(() => {
      expect(open).toBeEnabled();
    });
    await userEvent.click(open);
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/notes/n-7/edit');
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('rolls back and shows the undo notice when the server rejects', async () => {
    stubApi(() => json({ title: 'x', code: 'validation_failed', errors: [] }, 422));
    await startQuickNote();
    await userEvent.type(screen.getByLabelText('Título'), 'Recusada{Enter}');
    await waitFor(() => {
      expect(getToasts()).toHaveLength(1);
    });
    expect(screen.queryByText('Criado: Recusada')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Título')).toBeInTheDocument();
    expect(getToasts()[0]?.tone).toBe('danger');
  });
});
