import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearToasts } from '../../shared/toast/toast-store';
import { bookOf, renderLibrary, sessionOf, stubLibraryServer } from './library-test-server';

afterEach(() => {
  vi.unstubAllGlobals();
  clearToasts();
});

async function openHistory(route = '/library/books/b-1') {
  const view = renderLibrary(route);
  await userEvent.click(await screen.findByRole('tab', { name: 'Histórico de leitura' }));
  return view;
}

describe('reading history tab', () => {
  it('pd40 shows the register session action above the list', async () => {
    stubLibraryServer({ books: [bookOf()], sessions: [sessionOf()] });
    await openHistory();
    const action = await screen.findByRole('link', { name: 'Registrar sessão' });
    expect(action).toHaveAttribute('href', '/library/books/b-1/sessions/new');
    const list = await screen.findByRole('list', { name: 'Sessões de leitura' });
    expect(action.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('pd60 lists each session as pages and date from the most recent', async () => {
    stubLibraryServer({
      books: [bookOf()],
      sessions: [
        sessionOf({ id: 's-1', pages_read: 1, read_on: '2026-10-25' }),
        sessionOf({ id: 's-2', pages_read: 50, read_on: '2026-10-26' }),
      ],
    });
    await openHistory();
    const list = await screen.findByRole('list', { name: 'Sessões de leitura' });
    const rows = within(list).getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('50 páginas · 26/10/2026');
    expect(rows[1]).toHaveTextContent('1 página · 25/10/2026');
  });

  it('pd60 sums the sessions in the progress summary', async () => {
    stubLibraryServer({
      books: [bookOf()],
      sessions: [
        sessionOf({ id: 's-1', pages_read: 25 }),
        sessionOf({ id: 's-2', pages_read: 30, read_on: '2026-10-26' }),
      ],
    });
    await openHistory();
    expect(await screen.findByTestId('session-summary')).toHaveTextContent(
      '55 páginas lidas em 2 sessões',
    );
    expect(screen.getByRole('progressbar', { name: 'Progresso de leitura' })).toHaveAttribute(
      'aria-valuenow',
      '27.5',
    );
    expect(screen.getByText('55 de 200 páginas', { exact: false })).toBeInTheDocument();
  });

  it('shows the empty state with explanatory text', async () => {
    stubLibraryServer({ books: [bookOf()] });
    await openHistory();
    expect(await screen.findByText('Nenhuma sessão registrada')).toBeInTheDocument();
    expect(
      screen.getByText('Registre as páginas que você lê para acompanhar o progresso do livro.'),
    ).toBeInTheDocument();
  });

  it('links each session to its edit form', async () => {
    stubLibraryServer({ books: [bookOf()], sessions: [sessionOf()] });
    await openHistory();
    const edit = await screen.findByRole('link', { name: 'Editar sessão de 25/10/2026' });
    expect(edit).toHaveAttribute('href', '/library/books/b-1/sessions/s-1/edit');
  });

  it('updates the progress at once when a session is deleted', async () => {
    stubLibraryServer({
      books: [bookOf({ pages_read_total: 100 })],
      sessions: [sessionOf({ pages_read: 100 })],
    });
    await openHistory();
    await userEvent.click(
      await screen.findByRole('button', { name: 'Excluir sessão de 25/10/2026' }),
    );
    await userEvent.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', {
        name: 'Excluir sessão',
      }),
    );
    await waitFor(() => {
      expect(screen.getByText('Nenhuma sessão registrada')).toBeInTheDocument();
    });
  });
});
