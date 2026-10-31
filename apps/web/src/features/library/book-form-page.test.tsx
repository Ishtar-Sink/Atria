import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearToasts } from '../../shared/toast/toast-store';
import { bookOf, renderLibrary, stubLibraryServer } from './library-test-server';

afterEach(() => {
  vi.unstubAllGlobals();
  clearToasts();
});

const posts = (server: ReturnType<typeof stubLibraryServer>) =>
  server.calls.filter((call) => call.method === 'POST' && call.url.pathname === '/api/v1/books');

const image = () => new File([new Uint8Array(64)], 'capa.png', { type: 'image/png' });
const pdf = () => new File([new Uint8Array(64)], 'livro.pdf', { type: 'application/pdf' });

describe('book form', () => {
  it('creates a book with title, cover, author, publisher, pages and tags', async () => {
    const server = stubLibraryServer();
    const { router } = renderLibrary('/library/books/new');
    await userEvent.type(await screen.findByLabelText('Título'), 'Dom Casmurro');
    await userEvent.type(screen.getByLabelText('Autoria'), 'Machado de Assis');
    await userEvent.type(screen.getByLabelText('Editora'), 'Editora Exemplo');
    await userEvent.type(screen.getByLabelText('Páginas'), '200');
    await userEvent.type(screen.getByLabelText('Etiquetas'), 'romance{Enter}');
    await userEvent.upload(screen.getByLabelText('Capa do livro', { selector: 'input' }), image());
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => {
      expect(posts(server)).toHaveLength(1);
    });
    expect(posts(server)[0]?.body).toMatchObject({
      title: 'Dom Casmurro',
      author: 'Machado de Assis',
      publisher: 'Editora Exemplo',
      page_count: 200,
      tags: ['romance'],
      reading_status: 'want_to_read',
      visibility: 'personal',
    });
    // O item é criado primeiro; depois a capa vai no corpo cru, com o tipo do arquivo (PD-36).
    await waitFor(() => {
      expect(server.calls.some((call) => call.url.pathname.endsWith('/cover'))).toBe(true);
    });
    const cover = server.calls.find((call) => call.url.pathname.endsWith('/cover'));
    expect(cover?.method).toBe('PUT');
    expect(cover?.content_type).toBe('image/png');
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(`/library/books/${server.books[0]?.id ?? ''}`);
    });
  });

  it('pd37 places the cover on the left of the main fields and tags, notes and visibility below', async () => {
    stubLibraryServer();
    const { container } = renderLibrary('/library/books/new');
    await screen.findByLabelText('Título');
    const media = container.querySelector('[class*="formMedia"]');
    if (!media) throw new Error('sem a área da capa');
    expect(media.firstElementChild).toContainElement(
      screen.getByRole('group', { name: 'Capa do livro' }),
    );
    expect(media.lastElementChild).toContainElement(screen.getByLabelText('Título'));
    const tags = screen.getByLabelText('Etiquetas');
    const visibility = screen.getByRole('radiogroup', { name: 'Visibilidade' });
    expect(media.compareDocumentPosition(tags) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(
      tags.compareDocumentPosition(visibility) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(media.contains(tags)).toBe(false);
  });

  it('pd11 turns tags into pills with Enter and comma', async () => {
    stubLibraryServer();
    renderLibrary('/library/books/new');
    const field = await screen.findByLabelText('Etiquetas');
    await userEvent.type(field, 'clássico{Enter}');
    await userEvent.type(field, 'brasil,');
    expect(await screen.findByText('clássico')).toBeInTheDocument();
    expect(screen.getByText('brasil')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remover clássico' })).toBeInTheDocument();
  });

  it('attaches an optional pdf', async () => {
    const server = stubLibraryServer();
    renderLibrary('/library/books/new');
    await userEvent.type(await screen.findByLabelText('Título'), 'Com PDF');
    await userEvent.upload(screen.getByLabelText('PDF (opcional)'), pdf());
    expect(screen.getByText('livro.pdf')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => {
      expect(server.calls.some((call) => call.url.pathname.endsWith('/pdf'))).toBe(true);
    });
    const upload = server.calls.find((call) => call.url.pathname.endsWith('/pdf'));
    expect(upload?.method).toBe('PUT');
    expect(upload?.content_type).toBe('application/octet-stream');
    expect(upload?.file?.name).toBe('livro.pdf');
  });

  it('saves the book without a pdf and without a cover', async () => {
    const server = stubLibraryServer();
    renderLibrary('/library/books/new');
    await userEvent.type(await screen.findByLabelText('Título'), 'Só texto');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => {
      expect(posts(server)).toHaveLength(1);
    });
    expect(server.calls.filter((call) => call.method === 'PUT')).toHaveLength(0);
  });

  it('rejects a non pdf file inside the form with role alert', async () => {
    const server = stubLibraryServer();
    const { container } = renderLibrary('/library/books/new');
    const input = await screen.findByLabelText('PDF (opcional)');
    fireEvent.change(input, {
      target: { files: [new File(['x'], 'foto.png', { type: 'image/png' })] },
    });
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Use um arquivo PDF.');
    expect(container.querySelector('form')).toContainElement(alert);
    expect(server.calls.filter((call) => call.method === 'PUT')).toHaveLength(0);
  });

  it('pd35 saves the book reading status', async () => {
    const server = stubLibraryServer();
    renderLibrary('/library/books/new');
    await userEvent.type(await screen.findByLabelText('Título'), 'Lendo agora');
    expect(screen.getByRole('radio', { name: 'Quero ler' })).toBeChecked();
    expect(
      within(screen.getByRole('radiogroup', { name: 'Status de leitura' })).getAllByRole('radio'),
    ).toHaveLength(3);
    await userEvent.click(screen.getByRole('radio', { name: 'Lendo' }));
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => {
      expect(posts(server)).toHaveLength(1);
    });
    expect(posts(server)[0]?.body).toMatchObject({ reading_status: 'reading' });
  });

  it('requires the title and rejects invalid pages inside the form with role alert', async () => {
    const server = stubLibraryServer();
    renderLibrary('/library/books/new');
    await userEvent.type(await screen.findByLabelText('Páginas'), 'abc');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    const alerts = await screen.findAllByRole('alert');
    expect(alerts.map((alert) => alert.textContent)).toEqual([
      'Campo obrigatório',
      'Informe um número inteiro maior que zero.',
    ]);
    expect(posts(server)).toHaveLength(0);
  });

  it('edits a book and keeps its data', async () => {
    const server = stubLibraryServer({
      books: [bookOf({ tags: ['romance'], reading_status: 'reading' })],
    });
    const { router } = renderLibrary('/library/books/b-1/edit');
    const title = await screen.findByLabelText('Título');
    expect(title).toHaveValue('Dom Casmurro');
    expect(screen.getByRole('radio', { name: 'Lendo' })).toBeChecked();
    await userEvent.clear(title);
    await userEvent.type(title, 'Dom Casmurro (edição)');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => {
      expect(server.calls.some((call) => call.method === 'PATCH')).toBe(true);
    });
    expect(server.calls.find((call) => call.method === 'PATCH')?.body).toMatchObject({
      title: 'Dom Casmurro (edição)',
      tags: ['romance'],
    });
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/library/books/b-1');
    });
  });

  it('has no axe violations', async () => {
    stubLibraryServer();
    const { container } = renderLibrary('/library/books/new');
    await screen.findByLabelText('Título');
    expect(await axe(container)).toHaveNoViolations();
  });
});
