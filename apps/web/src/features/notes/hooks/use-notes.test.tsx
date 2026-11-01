import type { Schemas } from '@atria/contracts';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../../shared/test/render';
import { clearToasts, getToasts } from '../../../shared/toast/toast-store';
import { useListSearch } from '../../../shared/url-state/use-list-search';
import {
  notesSearchSchema,
  searchToFilters,
  useCreateNote,
  useDeleteNote,
  useNotes,
  useUpdateNote,
} from './use-notes';

type Note = Schemas['NoteResponse'];

function note(overrides: Partial<Note> = {}): Note {
  return {
    id: 'n-1',
    owner_id: 'u-1',
    title: 'Ideias de viagem',
    body: 'Lisboa em março.',
    visibility: 'personal',
    created_at: '2026-01-01T10:00:00Z',
    updated_at: '2026-01-01T10:00:00Z',
    ...overrides,
  };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

interface Call {
  method: string;
  url: URL;
  body: unknown;
}

function stubApi(handler: (call: Call) => Response | Promise<Response>) {
  const calls: Call[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(input instanceof Request ? input.url : input, 'http://localhost');
      if (url.pathname === '/api/v1/me')
        return Promise.resolve(json({ id: 'u-1', email: 'a@b.c' }));
      if (url.pathname === '/api/v1/me/preferences')
        return Promise.resolve(json({ theme: 'system' }));
      const call: Call = {
        method: init?.method ?? 'GET',
        url,
        body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
      };
      calls.push(call);
      return Promise.resolve(handler(call));
    }),
  );
  return calls;
}

function Listing() {
  const { search } = useListSearch(notesSearchSchema);
  const query = useNotes(searchToFilters(search));
  const update = useUpdateNote();
  const remove = useDeleteNote();
  const items = query.data?.pages.flatMap((page) => page.items) ?? [];
  return (
    <div>
      <ul>
        {items.map((item) => (
          <li key={item.id}>{item.title}</li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => {
          update.mutate({ id: 'n-1', patch: { title: 'Novo título' } });
        }}
      >
        rename
      </button>
      <button
        type="button"
        onClick={() => {
          remove.mutate({ id: 'n-1' });
        }}
      >
        remove
      </button>
    </div>
  );
}

function Creator() {
  const create = useCreateNote();
  return (
    <button
      type="button"
      onClick={() => {
        create.mutate({ title: 'Nova', body: '' });
      }}
    >
      create
    </button>
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  clearToasts();
});

describe('note hooks', () => {
  it('lists notes with visibility and order from the url', async () => {
    const calls = stubApi(() => json({ items: [note()], next_cursor: null }));
    renderWithProviders(<Listing />, { route: '/?visibility=shared&sort=created_at' });
    expect(await screen.findByText('Ideias de viagem')).toBeInTheDocument();
    const list = calls.find((call) => call.url.pathname === '/api/v1/notes');
    expect(list?.url.searchParams.get('visibility')).toBe('shared');
    expect(list?.url.searchParams.get('sort')).toBe('created_at');
    expect(list?.url.searchParams.get('limit')).toBe('20');
  });

  it('searches notes through the search endpoint', async () => {
    const calls = stubApi((call) =>
      call.url.pathname === '/api/v1/search'
        ? json({
            groups: [
              {
                context: 'notes',
                items: [{ entity_type: 'note', id: 'n-2', title: 'Receita', snippet: 'bolo' }],
              },
            ],
          })
        : json({ items: [], next_cursor: null }),
    );
    renderWithProviders(<Listing />, { route: '/?q=bolo' });
    expect(await screen.findByText('Receita')).toBeInTheDocument();
    const search = calls.find((call) => call.url.pathname === '/api/v1/search');
    expect(search?.url.searchParams.get('q')).toBe('bolo');
    expect(search?.url.searchParams.get('contexts')).toBe('notes');
    expect(calls.some((call) => call.url.pathname === '/api/v1/notes')).toBe(false);
  });

  it('creates a note', async () => {
    const calls = stubApi(() => json(note({ id: 'n-9' }), 201));
    const { router } = renderWithProviders(<Creator />);
    await userEvent.click(await screen.findByRole('button', { name: 'create' }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/notes/n-9');
    });
    expect(calls[0]?.method).toBe('POST');
    expect(calls[0]?.body).toEqual({ title: 'Nova', body: '' });
  });

  it('edits a note optimistically', async () => {
    let release: (response: Response) => void = () => undefined;
    stubApi((call) => {
      if (call.method === 'PATCH') {
        return new Promise<Response>((resolve) => {
          release = resolve;
        });
      }
      return json({ items: [note()], next_cursor: null });
    });
    renderWithProviders(<Listing />);
    await screen.findByText('Ideias de viagem');
    await userEvent.click(screen.getByRole('button', { name: 'rename' }));
    expect(await screen.findByText('Novo título')).toBeInTheDocument();
    release(json(note({ title: 'Novo título' })));
    await waitFor(() => {
      expect(getToasts()).toHaveLength(0);
    });
  });

  it('deletes a note optimistically', async () => {
    let release: (response: Response) => void = () => undefined;
    let deleted = false;
    stubApi((call) => {
      if (call.method === 'DELETE') {
        return new Promise<Response>((resolve) => {
          release = resolve;
        });
      }
      return json({ items: deleted ? [] : [note()], next_cursor: null });
    });
    const { router } = renderWithProviders(<Listing />);
    await screen.findByText('Ideias de viagem');
    await userEvent.click(screen.getByRole('button', { name: 'remove' }));
    await waitFor(() => {
      expect(screen.queryByText('Ideias de viagem')).not.toBeInTheDocument();
    });
    deleted = true;
    release(new Response(null, { status: 204 }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/notes');
    });
  });

  it('rolls back a delete and warns when refused', async () => {
    let release: (response: Response) => void = () => undefined;
    stubApi((call) => {
      if (call.method === 'DELETE') {
        return new Promise<Response>((resolve) => {
          release = resolve;
        });
      }
      return json({ items: [note()], next_cursor: null });
    });
    const { router } = renderWithProviders(<Listing />);
    await screen.findByText('Ideias de viagem');
    await userEvent.click(screen.getByRole('button', { name: 'remove' }));
    await waitFor(() => {
      expect(screen.queryByText('Ideias de viagem')).not.toBeInTheDocument();
    });
    release(json({ code: 'note_not_found', title: 'x' }, 404));
    expect(await screen.findByText('Ideias de viagem')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/');
    expect(getToasts().some((toast) => toast.tone === 'danger')).toBe(true);
  });
});
