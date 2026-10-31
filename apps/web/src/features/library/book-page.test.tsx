import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearToasts } from '../../shared/toast/toast-store';
import { bookOf, renderLibrary, sessionOf, stubLibraryServer } from './library-test-server';

afterEach(() => {
  vi.unstubAllGlobals();
  clearToasts();
});

const withProgress = () =>
  stubLibraryServer({
    books: [
      bookOf({
        pages_read_total: 55,
        progress_percent: 27.5,
        cover_file_id: 'f-1',
        tags: ['romance'],
      }),
    ],
    sessions: [sessionOf({ pages_read: 25 }), sessionOf({ id: 's-2', pages_read: 30 })],
  });

describe('book page', () => {
  it('shows the progress bar with an accessible label', async () => {
    withProgress();
    renderLibrary('/library/books/b-1');
    const bar = await screen.findByRole('progressbar', { name: 'Progresso de leitura' });
    expect(bar).toHaveAttribute('aria-valuenow', '27.5');
    expect(await screen.findByText(/55 de 200 páginas/)).toBeInTheDocument();
    expect(screen.getByText('27,5%')).toBeInTheDocument();
  });

  it('pd59 shows the data card with the cover beside the fields and the Registro card on the side', async () => {
    withProgress();
    renderLibrary('/library/books/b-1');
    const data = await screen.findByRole('region', { name: 'Dados' });
    expect(within(data).getByRole('img', { name: 'Capa de Dom Casmurro' })).toBeInTheDocument();
    const facts = within(data).getByText('Autoria').closest('dl');
    const media = data.querySelector('[class*="mediaCard"]');
    // A capa vem antes dos campos, na mesma linha (esquerda).
    expect(media?.firstElementChild?.querySelector('img')).not.toBeNull();
    expect(media?.lastElementChild).toContainElement(facts);
    expect(within(data).getByText('Machado de Assis')).toBeInTheDocument();
    const record = screen.getByRole('region', { name: 'Registro' });
    expect(within(record).getByText('Visibilidade')).toBeInTheDocument();
    expect(within(record).getByText('Pessoal')).toBeInTheDocument();
    expect(within(record).getByText('Criado em')).toBeInTheDocument();
    expect(within(record).getByText('Atualizado em')).toBeInTheDocument();
    expect(within(record).getByRole('list', { name: 'Etiquetas' })).toHaveTextContent('#romance');
  });

  it('pd14 keeps Ler beside Editar and Excluir inside Mais ações', async () => {
    stubLibraryServer({
      books: [bookOf({ pdf_file_id: 'p-1' })],
    });
    renderLibrary('/library/books/b-1');
    const edit = await screen.findByRole('link', { name: 'Editar' });
    const read = screen.getByRole('link', { name: 'Ler' });
    expect(read.parentElement).toBe(edit.parentElement);
    expect(screen.queryByRole('button', { name: 'Excluir' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Mais ações' }));
    const menu = await screen.findByRole('menu');
    const items = within(menu).getAllByRole('menuitem');
    expect(items.map((item) => item.textContent)).toEqual([
      'Baixar PDF',
      'Relatório de páginas lidas',
      'Excluir',
    ]);
    expect(items.at(-1)).toHaveAttribute('data-tone', 'danger');
  });

  it('pd61 opens the pages read report filtered by the book from Mais ações', async () => {
    stubLibraryServer({ books: [bookOf()] });
    renderLibrary('/library/books/b-1');
    await userEvent.click(await screen.findByRole('button', { name: 'Mais ações' }));
    const report = await screen.findByRole('menuitem', { name: 'Relatório de páginas lidas' });
    expect(report).toHaveAttribute('href', expect.stringContaining('/reports/read-pages'));
    expect(report.getAttribute('href')).toContain('book_id=b-1');
  });

  it('shows reading history and notes in separate tabs', async () => {
    const server = withProgress();
    server.notes = [
      {
        id: 'n-1',
        owner_id: 'u-1',
        comment: 'Capítulo marcante',
        page: 12,
        created_at: '2026-10-26T10:00:00Z',
        updated_at: '2026-10-26T10:00:00Z',
      },
    ];
    renderLibrary('/library/books/b-1');
    expect(await screen.findByRole('tab', { name: 'Visão geral' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await userEvent.click(screen.getByRole('tab', { name: 'Histórico de leitura' }));
    expect(await screen.findByText('25 páginas · 25/10/2026')).toBeInTheDocument();
    expect(screen.queryByText('Capítulo marcante')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'Notas' }));
    expect(await screen.findByText('Capítulo marcante')).toBeInTheDocument();
    expect(screen.getByText('Página 12')).toBeInTheDocument();
    expect(screen.queryByText('25 páginas · 25/10/2026')).not.toBeInTheDocument();
  });

  it('links to the reader and downloads the pdf when attached', async () => {
    stubLibraryServer({ books: [bookOf({ pdf_file_id: 'p-1' })] });
    renderLibrary('/library/books/b-1');
    expect(await screen.findByRole('link', { name: 'Ler' })).toHaveAttribute(
      'href',
      '/library/books/b-1/read',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Mais ações' }));
    expect(await screen.findByRole('menuitem', { name: 'Baixar PDF' })).toHaveAttribute(
      'href',
      '/api/v1/files/p-1',
    );
  });

  it('hides read and download without pdf', async () => {
    stubLibraryServer({ books: [bookOf()] });
    renderLibrary('/library/books/b-1');
    await screen.findByRole('link', { name: 'Editar' });
    expect(screen.queryByRole('link', { name: 'Ler' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Mais ações' }));
    await screen.findByRole('menu');
    expect(screen.queryByRole('menuitem', { name: 'Baixar PDF' })).not.toBeInTheDocument();
  });

  it('adds a note to the book history', async () => {
    const server = stubLibraryServer({ books: [bookOf()] });
    renderLibrary('/library/books/b-1?tab=notes');
    await userEvent.type(await screen.findByLabelText('Comentário'), 'Reler o capítulo 2');
    await userEvent.type(screen.getByLabelText('Página'), '40');
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar nota' }));
    expect(await screen.findByText('Reler o capítulo 2')).toBeInTheDocument();
    await waitFor(() => {
      expect(
        server.calls.find(
          (call) => call.method === 'POST' && call.url.pathname === '/api/v1/books/b-1/book-notes',
        )?.body,
      ).toEqual({ comment: 'Reler o capítulo 2', page: 40 });
    });
  });

  it('asks for a quote or a comment before adding a note', async () => {
    stubLibraryServer({ books: [bookOf()] });
    renderLibrary('/library/books/b-1?tab=notes');
    await userEvent.click(await screen.findByRole('button', { name: 'Adicionar nota' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Escreva um trecho ou um comentário.',
    );
  });

  it('deletes the book with confirmation', async () => {
    const server = stubLibraryServer({ books: [bookOf()] });
    const { router } = renderLibrary('/library/books/b-1');
    await userEvent.click(await screen.findByRole('button', { name: 'Mais ações' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Excluir' }));
    const dialog = await screen.findByRole('alertdialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Excluir livro' }));
    await waitFor(() => {
      expect(
        server.calls.some(
          (call) => call.method === 'DELETE' && call.url.pathname === '/api/v1/books/b-1',
        ),
      ).toBe(true);
    });
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/library');
    });
  });

  it('adds extra tabs by property', async () => {
    stubLibraryServer({ books: [bookOf()] });
    renderLibrary('/library/books/b-1', {
      book_extra_tabs: [
        { id: 'links', label: 'Conexões', render: (book) => <p>{`Ligações de ${book.title}`}</p> },
      ],
    });
    await userEvent.click(await screen.findByRole('tab', { name: 'Conexões' }));
    expect(await screen.findByText('Ligações de Dom Casmurro')).toBeInTheDocument();
  });

  it('shows the error state', async () => {
    stubLibraryServer({ mode: 'error' });
    renderLibrary('/library/books/b-1');
    expect(await screen.findByText('Não foi possível carregar o livro')).toBeInTheDocument();
  });

  it('has no axe violations', async () => {
    withProgress();
    const { container } = renderLibrary('/library/books/b-1');
    await screen.findByRole('progressbar', { name: 'Progresso de leitura' });
    expect(await axe(container)).toHaveNoViolations();
  });
});
