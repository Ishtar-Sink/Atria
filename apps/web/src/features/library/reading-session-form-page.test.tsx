import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearToasts } from '../../shared/toast/toast-store';
import { bookOf, renderLibrary, sessionOf, stubLibraryServer } from './library-test-server';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-26T15:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  clearToasts();
});

const posts = (server: ReturnType<typeof stubLibraryServer>) =>
  server.calls.filter(
    (call) => call.method === 'POST' && call.url.pathname.endsWith('/reading-sessions'),
  );

describe('reading session form', () => {
  it('registers pages read with a note', async () => {
    const server = stubLibraryServer({ books: [bookOf()] });
    const { router } = renderLibrary('/library/books/b-1/sessions/new');
    await userEvent.type(await screen.findByLabelText('Páginas lidas'), '30');
    await userEvent.type(screen.getByLabelText('Observação'), 'Capítulos 3 e 4');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => {
      expect(posts(server)).toHaveLength(1);
    });
    expect(posts(server)[0]?.body).toEqual({
      pages_read: 30,
      read_on: '2026-10-26',
      observation: 'Capítulos 3 e 4',
    });
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/library/books/b-1');
    });
  });

  it('pd60 registers only pages read and date without start and end pages', async () => {
    const server = stubLibraryServer({ books: [bookOf()] });
    renderLibrary('/library/books/b-1/sessions/new');
    await userEvent.type(await screen.findByLabelText('Páginas lidas'), '20');
    // A data é escolhida no calendário próprio (PD-57).
    await userEvent.click(screen.getByRole('button', { name: /Data/ }));
    const day = document.querySelector<HTMLElement>('[data-day="2026-10-20"]');
    if (!day) throw new Error('dia não encontrado');
    await userEvent.click(day);
    expect(screen.queryByLabelText(/inicial|final|início|fim/i)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => {
      expect(posts(server)).toHaveLength(1);
    });
    const body = posts(server)[0]?.body ?? {};
    expect(body).toEqual({ pages_read: 20, read_on: '2026-10-20' });
    expect(body).not.toHaveProperty('from_page');
    expect(body).not.toHaveProperty('to_page');
    // A sessão não grava a posição de leitura (DEC-004).
    expect(server.calls.some((call) => call.url.pathname.endsWith('/reading-position'))).toBe(
      false,
    );
  });

  it('pd60 rejects a session without pages read inside the form with role alert', async () => {
    const server = stubLibraryServer({ books: [bookOf()] });
    const { container } = renderLibrary('/library/books/b-1/sessions/new');
    await userEvent.click(await screen.findByRole('button', { name: 'Salvar' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Informe um número inteiro maior que zero.');
    expect(container.querySelector('form')).toContainElement(alert);
    expect(posts(server)).toHaveLength(0);

    await userEvent.type(screen.getByLabelText('Páginas lidas'), '0');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('maior que zero');
    });
    expect(posts(server)).toHaveLength(0);
  });

  it('edits a registered session', async () => {
    const server = stubLibraryServer({
      books: [bookOf()],
      sessions: [sessionOf({ pages_read: 20, read_on: '2026-10-24' })],
    });
    const { router } = renderLibrary('/library/books/b-1/sessions/s-1/edit');
    const pages = await screen.findByLabelText('Páginas lidas');
    expect(pages).toHaveValue('20');
    await userEvent.clear(pages);
    await userEvent.type(pages, '25');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => {
      expect(server.calls.some((call) => call.method === 'PATCH')).toBe(true);
    });
    const patch = server.calls.find((call) => call.method === 'PATCH');
    expect(patch?.url.pathname).toBe('/api/v1/books/b-1/reading-sessions/s-1');
    expect(patch?.body).toMatchObject({ pages_read: 25, read_on: '2026-10-24' });
    expect(patch?.body).not.toHaveProperty('from_page');
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/library/books/b-1');
    });
  });

  it('deletes a session with confirmation', async () => {
    const server = stubLibraryServer({
      books: [bookOf({ pages_read_total: 25 })],
      sessions: [sessionOf()],
    });
    renderLibrary('/library/books/b-1');
    await userEvent.click(await screen.findByRole('tab', { name: 'Histórico de leitura' }));
    await userEvent.click(
      await screen.findByRole('button', { name: 'Excluir sessão de 25/10/2026' }),
    );
    const dialog = await screen.findByRole('alertdialog');
    expect(server.calls.some((call) => call.method === 'DELETE')).toBe(false);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Excluir sessão' }));
    await waitFor(() => {
      expect(
        server.calls.some(
          (call) =>
            call.method === 'DELETE' &&
            call.url.pathname === '/api/v1/books/b-1/reading-sessions/s-1',
        ),
      ).toBe(true);
    });
    await waitFor(() => {
      expect(screen.queryByText(/25 páginas · 25\/10\/2026/)).not.toBeInTheDocument();
    });
  });

  it('rolls back and shows the undo notice when the server rejects', async () => {
    const server = stubLibraryServer({
      books: [bookOf({ pages_read_total: 25 })],
      sessions: [sessionOf()],
      reject: [{ method: 'DELETE', match: /reading-sessions\/s-1$/, status: 500, code: 'boom' }],
    });
    renderLibrary('/library/books/b-1');
    await userEvent.click(await screen.findByRole('tab', { name: 'Histórico de leitura' }));
    await userEvent.click(
      await screen.findByRole('button', { name: 'Excluir sessão de 25/10/2026' }),
    );
    await userEvent.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', {
        name: 'Excluir sessão',
      }),
    );
    expect(
      await screen.findByText('Não foi possível concluir a ação. A mudança foi desfeita.'),
    ).toBeInTheDocument();
    // A sessão volta à lista depois do aviso.
    expect(await screen.findByText(/25 páginas · 25\/10\/2026/)).toBeInTheDocument();
    expect(server.sessions).toHaveLength(1);
  });
});
