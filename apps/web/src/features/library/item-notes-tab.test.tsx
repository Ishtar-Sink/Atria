import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearToasts, getToasts } from '../../shared/toast/toast-store';
import {
  articleOf,
  bookOf,
  renderLibrary,
  stubLibraryServer,
  videoOf,
} from './library-test-server';
import type { ItemNote } from './use-item-notes';

afterEach(() => {
  vi.unstubAllGlobals();
  clearToasts();
});

const NOTE: ItemNote = {
  id: 'n-1',
  owner_id: 'u-1',
  quote: null,
  comment: 'Reler o capítulo 2',
  page: null,
  created_at: '2026-10-25T10:00:00Z',
  updated_at: '2026-10-25T10:00:00Z',
};

const CASES = [
  { name: 'book', collection: 'books', segment: 'book-notes', id: 'b-1', route: 'books' },
  {
    name: 'article',
    collection: 'articles',
    segment: 'article-notes',
    id: 'a-1',
    route: 'articles',
  },
  { name: 'video', collection: 'videos', segment: 'video-notes', id: 'v-1', route: 'videos' },
] as const;

function setup(overrides: Partial<ItemNote> = {}) {
  return stubLibraryServer({
    books: [bookOf()],
    articles: [articleOf()],
    videos: [videoOf()],
    notes: [{ ...NOTE, ...overrides }],
  });
}

describe('item notes: edit and delete', () => {
  it.each(CASES)('rf31 edits a $name note', async ({ collection, segment, id, route }) => {
    const server = setup();
    renderLibrary(`/library/${route}/${id}?tab=notes`);
    await userEvent.click(await screen.findByRole('button', { name: /^Editar a nota “Reler/ }));
    const form = screen.getByRole('form', { name: 'Editar nota' });
    const comment = within(form).getByLabelText('Comentário');
    await userEvent.clear(comment);
    await userEvent.type(comment, 'Reler o capítulo 3');
    await userEvent.click(within(form).getByRole('button', { name: 'Salvar' }));
    expect(await screen.findByText('Reler o capítulo 3')).toBeInTheDocument();
    await waitFor(() => {
      expect(
        server.calls.find(
          (call) =>
            call.method === 'PATCH' &&
            call.url.pathname === `/api/v1/${collection}/${id}/${segment}/n-1`,
        )?.body,
      ).toEqual({ quote: null, comment: 'Reler o capítulo 3', page: null });
    });
  });

  it.each(CASES)(
    'rf31 deletes a $name note after confirmation',
    async ({ collection, segment, id, route }) => {
      const server = setup();
      renderLibrary(`/library/${route}/${id}?tab=notes`);
      await userEvent.click(await screen.findByRole('button', { name: /^Excluir a nota “Reler/ }));
      const dialog = await screen.findByRole('alertdialog');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Excluir nota' }));
      expect(await screen.findByText('Nenhuma nota ainda')).toBeInTheDocument();
      expect(screen.queryByText('Reler o capítulo 2')).not.toBeInTheDocument();
      await waitFor(() => {
        expect(
          server.calls.some(
            (call) =>
              call.method === 'DELETE' &&
              call.url.pathname === `/api/v1/${collection}/${id}/${segment}/n-1`,
          ),
        ).toBe(true);
      });
    },
  );

  it('rf31 keeps the note when the deletion is cancelled', async () => {
    const server = setup();
    renderLibrary('/library/books/b-1?tab=notes');
    await userEvent.click(await screen.findByRole('button', { name: /^Excluir a nota/ }));
    const dialog = await screen.findByRole('alertdialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    expect(screen.getByText('Reler o capítulo 2')).toBeInTheDocument();
    expect(server.calls.some((call) => call.method === 'DELETE')).toBe(false);
  });

  it('rf31 validates the edited note inside the form', async () => {
    const server = setup();
    renderLibrary('/library/books/b-1?tab=notes');
    await userEvent.click(await screen.findByRole('button', { name: /^Editar a nota/ }));
    const form = screen.getByRole('form', { name: 'Editar nota' });
    await userEvent.clear(within(form).getByLabelText('Comentário'));
    await userEvent.click(within(form).getByRole('button', { name: 'Salvar' }));
    expect(await within(form).findByRole('alert')).toHaveTextContent(
      'Escreva um trecho ou um comentário.',
    );
    expect(server.calls.some((call) => call.method === 'PATCH')).toBe(false);
  });

  it('rf31 rolls back the edit and warns when the server refuses', async () => {
    const server = setup();
    server.reject.push({ method: 'PATCH', match: /-notes\//, status: 500, code: 'boom' });
    renderLibrary('/library/books/b-1?tab=notes');
    await userEvent.click(await screen.findByRole('button', { name: /^Editar a nota/ }));
    const form = screen.getByRole('form', { name: 'Editar nota' });
    const comment = within(form).getByLabelText('Comentário');
    await userEvent.clear(comment);
    await userEvent.type(comment, 'Texto novo');
    await userEvent.click(within(form).getByRole('button', { name: 'Salvar' }));
    expect(await screen.findByText('Reler o capítulo 2')).toBeInTheDocument();
    await waitFor(() => {
      expect(getToasts().map((toast) => toast.message_key)).toContain('library.undo_notice');
    });
    expect(screen.queryByText('Texto novo')).not.toBeInTheDocument();
  });

  it('cb15 a deleted note is gone when the list is reloaded', async () => {
    setup();
    renderLibrary('/library/books/b-1?tab=notes');
    await userEvent.click(await screen.findByRole('button', { name: /^Excluir a nota/ }));
    const dialog = await screen.findByRole('alertdialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Excluir nota' }));
    expect(await screen.findByText('Nenhuma nota ainda')).toBeInTheDocument();
    cleanup();
    renderLibrary('/library/books/b-1?tab=notes');
    expect(await screen.findByText('Nenhuma nota ainda')).toBeInTheDocument();
  });

  it('rf31 has no axe violations with the edit form open', async () => {
    setup();
    const { container } = renderLibrary('/library/books/b-1?tab=notes');
    await userEvent.click(await screen.findByRole('button', { name: /^Editar a nota/ }));
    await screen.findByRole('form', { name: 'Editar nota' });
    expect(await axe(container)).toHaveNoViolations();
  });
});
