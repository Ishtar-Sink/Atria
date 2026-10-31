import type { Schemas } from '@atria/contracts';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { rootRoute } from '../../../app/router';
import { renderWithProviders } from '../../../shared/test/render';
import { clearToasts, getToasts } from '../../../shared/toast/toast-store';
import { createNotesRoutes } from '../routes';

type Note = Schemas['NoteResponse'];

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function noteOf(overrides: Partial<Note> = {}): Note {
  return {
    id: 'n-1',
    owner_id: 'u-1',
    title: 'Ideias de viagem',
    body: 'Lisboa em março.\nPorto em abril.',
    visibility: 'personal',
    created_at: '2026-01-05T10:00:00Z',
    updated_at: '2026-02-06T10:00:00Z',
    ...overrides,
  };
}

interface Call {
  method: string;
  url: URL;
  body: Record<string, unknown>;
}

interface Server {
  notes: Note[];
  calls: Call[];
  mode: 'ok' | 'loading' | 'error';
  refuse_delete: boolean;
}

/** API falsa em memória: notas, busca e as recusas que os testes provocam. */
function stubServer(initial: Partial<Server> = {}): Server {
  const server: Server = { notes: [], calls: [], mode: 'ok', refuse_delete: false, ...initial };
  vi.stubGlobal(
    'fetch',
    vi.fn((input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(input instanceof Request ? input.url : input, 'http://localhost');
      const method = init?.method ?? 'GET';
      const body =
        typeof init?.body === 'string' ? (JSON.parse(init.body) as Record<string, unknown>) : {};
      if (url.pathname === '/api/v1/me')
        return Promise.resolve(json({ id: 'u-1', email: 'a@b.c' }));
      server.calls.push({ method, url, body });
      if (server.mode === 'loading') return new Promise<Response>(() => undefined);
      if (server.mode === 'error') return Promise.resolve(json({ code: 'boom', title: 'x' }, 500));
      if (url.pathname === '/api/v1/search') {
        const q = (url.searchParams.get('q') ?? '').toLowerCase();
        const items = server.notes
          .filter((note) => `${note.title} ${note.body}`.toLowerCase().includes(q))
          .map((note) => ({
            entity_type: 'note',
            id: note.id,
            title: note.title,
            snippet: note.body,
          }));
        return Promise.resolve(json({ groups: items.length ? [{ context: 'notes', items }] : [] }));
      }
      const [, id] = url.pathname.replace('/api/v1/notes', '').split('/');
      if (id === undefined) {
        if (method === 'POST') {
          const created = noteOf({ id: 'n-new', ...(body as Partial<Note>) });
          server.notes.push(created);
          return Promise.resolve(json(created, 201));
        }
        return Promise.resolve(json({ items: server.notes, next_cursor: null }));
      }
      const found = server.notes.find((note) => note.id === id);
      if (!found) return Promise.resolve(json({ code: 'note_not_found', title: 'x' }, 404));
      if (method === 'DELETE') {
        if (server.refuse_delete) return Promise.resolve(json({ code: 'boom', title: 'x' }, 500));
        server.notes = server.notes.filter((note) => note.id !== id);
        return Promise.resolve(new Response(null, { status: 204 }));
      }
      if (method === 'PATCH') {
        Object.assign(found, body);
        return Promise.resolve(json(found));
      }
      return Promise.resolve(json(found));
    }),
  );
  return server;
}

function renderAt(route: string) {
  return renderWithProviders(null, { routes: createNotesRoutes(rootRoute), route });
}

afterEach(() => {
  vi.unstubAllGlobals();
  clearToasts();
});

async function expectNoViolations(container: HTMLElement) {
  expect(await axe(container)).toHaveNoViolations();
}

describe('notes list', () => {
  it('filters, sorts and searches notes through the url', async () => {
    const server = stubServer({ notes: [noteOf()] });
    const { router, container } = renderAt('/notes?visibility=shared&sort=created_at');
    expect(await screen.findByRole('heading', { level: 1, name: 'Notas' })).toHaveAttribute(
      'data-page-heading',
    );
    expect(screen.getByText('O que vale guardar, escrito do seu jeito.')).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Ideias de viagem' })).toBeInTheDocument();
    const first = server.calls.find((call) => call.url.pathname === '/api/v1/notes');
    expect(first?.url.searchParams.get('visibility')).toBe('shared');
    expect(first?.url.searchParams.get('sort')).toBe('created_at');

    expect(screen.getByRole('group', { name: 'Filtros' })).toBeInTheDocument();
    expect(container.querySelector('select')).toBeNull();
    await userEvent.click(screen.getByLabelText('Ordem'));
    await userEvent.click(screen.getByRole('option', { name: 'Atualizadas por último' }));
    await waitFor(() => {
      expect(router.state.location.search).toMatchObject({ sort: 'updated_at' });
    });

    await userEvent.type(screen.getByRole('searchbox', { name: 'Busca' }), 'lis');
    await waitFor(() => {
      expect(router.state.location.search).toMatchObject({ q: 'lis' });
    });
    await waitFor(() => {
      expect(server.calls.some((call) => call.url.pathname === '/api/v1/search')).toBe(true);
    });
    expect(await screen.findByRole('link', { name: 'Ideias de viagem' })).toBeInTheDocument();
    await expectNoViolations(container);
  });

  it('shows a calm message when the search finds nothing', async () => {
    stubServer({ notes: [noteOf()] });
    renderAt('/notes?q=zzz');
    expect(await screen.findByText('Nenhuma nota com esse texto')).toBeInTheDocument();
  });

  it('switches between list and grid', async () => {
    stubServer({ notes: [noteOf()] });
    const { router } = renderAt('/notes');
    await screen.findByRole('link', { name: 'Ideias de viagem' });
    expect(screen.getByText('Lisboa em março. Porto em abril.')).toBeInTheDocument();
    expect(screen.getByText(/Atualizada em 6 de fev/)).toBeInTheDocument();

    const views = screen.getByRole('group', { name: 'Visualização' });
    await userEvent.click(within(views).getByRole('button', { name: 'Grade' }));
    await waitFor(() => {
      expect(router.state.location.search).toMatchObject({ view: 'grid' });
    });
    expect(within(views).getByRole('button', { name: 'Grade' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('link', { name: 'Ideias de viagem' })).toBeInTheDocument();
  });

  it('shows empty, loading and error states', async () => {
    stubServer({ mode: 'loading' });
    const loading = renderAt('/notes');
    expect(await screen.findByRole('status')).toHaveAttribute('aria-busy', 'true');
    loading.unmount();
    vi.unstubAllGlobals();

    stubServer({ mode: 'error' });
    const failed = renderAt('/notes');
    expect(await screen.findByRole('button', { name: 'Tentar de novo' })).toBeInTheDocument();
    failed.unmount();
    vi.unstubAllGlobals();

    stubServer();
    const empty = renderAt('/notes');
    expect(await screen.findByText('Anote o que quiser guardar.')).toBeInTheDocument();
    expect(screen.getByText('Nenhuma nota ainda')).toBeInTheDocument();
    await expectNoViolations(empty.container);
  });

  it('reaches every control with the keyboard', async () => {
    stubServer({ notes: [noteOf()] });
    renderAt('/notes');
    await screen.findByRole('link', { name: 'Ideias de viagem' });
    const seen = new Set<string>();
    for (let step = 0; step < 16; step += 1) {
      await userEvent.tab();
      seen.add(
        document.activeElement?.getAttribute('aria-label') ??
          document.activeElement?.textContent ??
          '',
      );
    }
    expect(seen).toContain('Nova nota');
    expect(seen).toContain('Ideias de viagem');
  });
});

describe('note form', () => {
  it('shows the validation error inside the form', async () => {
    const server = stubServer();
    const { container } = renderAt('/notes/new');
    await userEvent.click(await screen.findByRole('button', { name: 'Salvar' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Campo obrigatório');
    expect(container.querySelector('form')).toContainElement(alert);
    expect(server.calls.some((call) => call.method === 'POST')).toBe(false);
    await expectNoViolations(container);
  });

  it('pd62 lays the form in the grid with title, text and visibility on the full row', async () => {
    stubServer();
    const { container } = renderAt('/notes/new');
    await screen.findByLabelText('Título');
    const span = (element: Element) => element.closest('[data-span="full"]');
    expect(span(screen.getByLabelText('Título'))).not.toBeNull();
    expect(span(screen.getByLabelText('Texto'))).not.toBeNull();
    expect(span(screen.getByRole('radiogroup', { name: 'Visibilidade' }))).not.toBeNull();
    expect(container.querySelector('select')).toBeNull();
    const buttons = screen.getAllByRole('button').map((button) => button.textContent);
    expect(buttons.indexOf('Cancelar')).toBeLessThan(buttons.indexOf('Salvar'));
  });

  it('pd19 centers the header and the form in the form column', async () => {
    stubServer();
    const { container } = renderAt('/notes/new');
    const heading = await screen.findByRole('heading', { level: 1, name: 'Nova nota' });
    const column = heading.closest('div[class*="screen"]');
    expect(column).not.toBeNull();
    expect(column).toContainElement(container.querySelector('form'));
    expect(screen.getByRole('link', { name: 'Voltar' })).toBeInTheDocument();
  });

  it('cancels back to the list when creating and to the note when editing', async () => {
    stubServer({ notes: [noteOf()] });
    const created = renderAt('/notes/new');
    await userEvent.click(await screen.findByRole('button', { name: 'Cancelar' }));
    await waitFor(() => {
      expect(created.router.state.location.pathname).toBe('/notes');
    });
    created.unmount();

    const edited = renderAt('/notes/n-1/edit');
    await userEvent.click(await screen.findByRole('button', { name: 'Cancelar' }));
    await waitFor(() => {
      expect(edited.router.state.location.pathname).toBe('/notes/n-1');
    });
  });
});

describe('note screen', () => {
  it('creates, edits and deletes a note', async () => {
    const server = stubServer();
    const { router } = renderAt('/notes/new');
    await userEvent.type(await screen.findByLabelText('Título'), 'Receita de bolo');
    await userEvent.type(screen.getByLabelText('Texto'), 'Farinha e ovos.');
    await userEvent.click(screen.getByRole('radio', { name: 'Compartilhada' }));
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/notes/n-new');
    });
    expect(server.calls.find((call) => call.method === 'POST')?.body).toEqual({
      title: 'Receita de bolo',
      body: 'Farinha e ovos.',
      visibility: 'shared',
    });
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Receita de bolo' }),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('link', { name: 'Editar' }));
    const title = await screen.findByLabelText('Título');
    await userEvent.clear(title);
    await userEvent.type(title, 'Receita de pão');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/notes/n-new');
    });
    expect(server.calls.find((call) => call.method === 'PATCH')?.body).toMatchObject({
      title: 'Receita de pão',
    });
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Receita de pão' }),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Mais ações' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Excluir' }));
    await userEvent.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Excluir' }),
    );
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/notes');
    });
    expect(server.notes).toHaveLength(0);
    expect(await screen.findByText('Nenhuma nota ainda')).toBeInTheDocument();
  });

  it('asks for confirmation before deleting', async () => {
    const server = stubServer({ notes: [noteOf()] });
    renderAt('/notes/n-1');
    await userEvent.click(await screen.findByRole('button', { name: 'Mais ações' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Excluir' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(server.calls.some((call) => call.method === 'DELETE')).toBe(false);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });
    expect(server.calls.some((call) => call.method === 'DELETE')).toBe(false);
  });

  it('warns and stays on the note when the deletion is refused', async () => {
    stubServer({ notes: [noteOf()], refuse_delete: true });
    const { router } = renderAt('/notes/n-1');
    await userEvent.click(await screen.findByRole('button', { name: 'Mais ações' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Excluir' }));
    await userEvent.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Excluir' }),
    );
    await waitFor(() => {
      expect(getToasts().some((toast) => toast.tone === 'danger')).toBe(true);
    });
    expect(router.state.location.pathname).toBe('/notes/n-1');
  });

  it('shows not found for a deleted note', async () => {
    stubServer();
    const { container } = renderAt('/notes/n-gone');
    expect(await screen.findByText('Nota não encontrada')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver todas as notas' })).toHaveAttribute(
      'href',
      '/notes',
    );
    await expectNoViolations(container);
  });

  it('pd14 shows Editar with the pencil and Excluir in danger tone inside Mais ações', async () => {
    stubServer({ notes: [noteOf()] });
    renderAt('/notes/n-1');
    const edit = await screen.findByRole('link', { name: 'Editar' });
    expect(edit).toHaveAttribute('href', '/notes/n-1/edit');
    expect(edit.querySelector('svg')).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Excluir' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Mais ações' }));
    expect(screen.getByRole('menuitem', { name: 'Excluir' })).toHaveAttribute(
      'data-tone',
      'danger',
    );
    expect(screen.getByText('Notas · Nota')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Voltar' })).toBeInTheDocument();
  });

  it('pd59 shows the overview in cards with Texto and Registro', async () => {
    stubServer({ notes: [noteOf()] });
    const { container } = renderAt('/notes/n-1');
    const text = await screen.findByRole('heading', { level: 2, name: 'Texto' });
    expect(text.closest('section')).toHaveTextContent(/Lisboa em março\.\s*Porto em abril\./);
    const record = screen.getByRole('heading', { level: 2, name: 'Registro' }).closest('section');
    expect(record).toHaveTextContent('Pessoal');
    expect(record).toHaveTextContent('Criado em');
    expect(record).toHaveTextContent('Atualizado em');
    expect(screen.getByRole('tab', { name: 'Visão geral' })).toBeInTheDocument();
    await expectNoViolations(container);
  });

  it('shows the empty text and the extra tabs of another feature', async () => {
    stubServer({ notes: [noteOf({ body: '' })] });
    renderWithProviders(null, {
      routes: createNotesRoutes(rootRoute, {
        extra_tabs: [{ id: 'links', label: 'Conexões', render: (note) => `de ${note.title}` }],
      }),
      route: '/notes/n-1',
    });
    expect(await screen.findByText('Sem texto ainda.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'Conexões' }));
    expect(await screen.findByText('de Ideias de viagem')).toBeInTheDocument();
  });
});
