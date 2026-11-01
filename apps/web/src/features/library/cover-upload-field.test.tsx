import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppProviders } from '../../app/providers';
import { render } from '@testing-library/react';
import { clearToasts } from '../../shared/toast/toast-store';
import { CoverUploadField } from './cover-upload-field';
import { bookOf, stubLibraryServer, videoOf } from './library-test-server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

afterEach(() => {
  vi.unstubAllGlobals();
  clearToasts();
});

function png(name = 'capa.png', size = 1024): File {
  return new File([new Uint8Array(size)], name, { type: 'image/png' });
}

function renderField(props: Parameters<typeof CoverUploadField>[0]) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <AppProviders query_client={client}>
      <QueryClientProvider client={client}>
        <form>
          <CoverUploadField {...props} />
        </form>
      </QueryClientProvider>
    </AppProviders>,
  );
}

const AREA_BOOK = 'Capa do livro: clique ou arraste uma imagem';

const putCalls = (server: ReturnType<typeof stubLibraryServer>) =>
  server.calls.filter((call) => call.method === 'PUT');

describe('cover upload field', () => {
  it('pd36 uploads a cover by click and by drop', async () => {
    const server = stubLibraryServer({ books: [bookOf()] });
    renderField({ kind: 'book', title: 'Dom Casmurro', item_id: 'b-1' });

    await userEvent.upload(screen.getByLabelText('Capa do livro', { selector: 'input' }), png());
    await waitFor(() => {
      expect(putCalls(server)).toHaveLength(1);
    });
    const first = putCalls(server)[0];
    expect(first?.url.pathname).toBe('/api/v1/books/b-1/cover');
    expect(first?.content_type).toBe('image/png');
    expect(first?.file).toBeInstanceOf(File);

    const jpeg = new File([new Uint8Array(10)], 'outra.jpg', { type: 'image/jpeg' });
    fireEvent.drop(screen.getByRole('button', { name: AREA_BOOK }), {
      dataTransfer: { files: [jpeg] },
    });
    await waitFor(() => {
      expect(putCalls(server)).toHaveLength(2);
    });
    expect(putCalls(server)[1]?.content_type).toBe('image/jpeg');
  });

  it('pd36 replaces and removes the cover', async () => {
    const server = stubLibraryServer({ books: [bookOf({ cover_file_id: 'f-1' })] });
    renderField({ kind: 'book', title: 'Dom Casmurro', item_id: 'b-1', file_id: 'f-1' });
    expect(screen.getByRole('img', { name: 'Capa de Dom Casmurro' })).toHaveAttribute(
      'src',
      '/api/v1/files/f-1',
    );
    await userEvent.upload(
      screen.getByLabelText('Capa do livro', { selector: 'input' }),
      png('nova.png'),
    );
    await waitFor(() => {
      expect(putCalls(server)).toHaveLength(1);
    });
    await userEvent.click(screen.getByRole('button', { name: 'Remover' }));
    await waitFor(() => {
      expect(
        server.calls.some(
          (call) => call.method === 'DELETE' && call.url.pathname === '/api/v1/books/b-1/cover',
        ),
      ).toBe(true);
    });
  });

  it('pd36 rejects a non image and a file over 5 MB inside the form with role alert', async () => {
    const server = stubLibraryServer({ books: [bookOf()] });
    const { container } = renderField({ kind: 'book', title: 'Dom', item_id: 'b-1' });
    const input = screen.getByLabelText('Capa do livro', { selector: 'input' });
    fireEvent.change(input, {
      target: { files: [new File(['x'], 'nota.txt', { type: 'text/plain' })] },
    });
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Use uma imagem PNG, JPEG ou WebP.');
    expect(container.querySelector('form')).toContainElement(alert);

    fireEvent.change(input, { target: { files: [png('grande.png', 5 * 1024 * 1024 + 1)] } });
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('A imagem passa de 5 MB.');
    });
    expect(putCalls(server)).toHaveLength(0);
  });

  it('pd36 shows the server error for unsupported_file_type and file_too_large', async () => {
    const server = stubLibraryServer({
      books: [bookOf()],
      reject: [{ method: 'PUT', match: /cover$/, status: 415, code: 'unsupported_file_type' }],
    });
    renderField({ kind: 'book', title: 'Dom', item_id: 'b-1' });
    const input = screen.getByLabelText('Capa do livro', { selector: 'input' });
    await userEvent.upload(input, png());
    expect(await screen.findByRole('alert')).toHaveTextContent('Use uma imagem PNG, JPEG ou WebP.');

    server.reject = [{ method: 'PUT', match: /cover$/, status: 413, code: 'file_too_large' }];
    await userEvent.upload(input, png('outra.png'));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('A imagem passa de 5 MB.');
    });
  });

  it('pd36 uses 2 by 3 for books and 16 by 9 for articles and videos', () => {
    stubLibraryServer();
    const book = renderField({ kind: 'book' });
    expect(screen.getByRole('button', { name: AREA_BOOK }).className).toMatch(/portrait/);
    book.unmount();
    const article = renderField({ kind: 'article' });
    expect(
      screen.getByRole('button', {
        name: 'Capa do artigo: clique ou arraste uma imagem',
      }).className,
    ).toMatch(/landscape/);
    article.unmount();
    renderField({ kind: 'video' });
    expect(
      screen.getByRole('button', {
        name: 'Miniatura do vídeo: clique ou arraste uma imagem',
      }).className,
    ).toMatch(/landscape/);
  });

  it('keeps the chosen file for the form to send when the item is not saved yet', async () => {
    const server = stubLibraryServer();
    const on_pending = vi.fn();
    renderField({ kind: 'book', on_pending });
    const file = png();
    await userEvent.upload(screen.getByLabelText('Capa do livro', { selector: 'input' }), file);
    expect(on_pending).toHaveBeenCalledWith(file);
    expect(putCalls(server)).toHaveLength(0);
  });

  it('offers only Trocar for a video thumbnail, which has no remove route', () => {
    stubLibraryServer({ videos: [videoOf({ thumbnail_file_id: 'f-9' })] });
    renderField({ kind: 'video', title: 'Aula', item_id: 'v-1', file_id: 'f-9' });
    expect(screen.getByRole('button', { name: 'Trocar' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remover' })).not.toBeInTheDocument();
  });

  it('is operable by keyboard only', async () => {
    stubLibraryServer({ books: [bookOf()] });
    renderField({ kind: 'book', title: 'Dom', item_id: 'b-1' });
    const click = vi.spyOn(HTMLInputElement.prototype, 'click');
    await userEvent.tab();
    const area = screen.getByRole('button', { name: AREA_BOOK });
    expect(area).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(click).toHaveBeenCalledTimes(1);
    await userEvent.keyboard(' ');
    expect(click).toHaveBeenCalledTimes(2);
    click.mockRestore();
  });

  it('has no inner choose button', () => {
    stubLibraryServer();
    renderField({ kind: 'book' });
    expect(screen.queryByRole('button', { name: 'Escolher imagem' })).not.toBeInTheDocument();
  });

  it('opens the file chooser when the area is clicked', async () => {
    stubLibraryServer();
    renderField({ kind: 'book' });
    const click = vi.spyOn(HTMLInputElement.prototype, 'click');
    await userEvent.click(screen.getByRole('button', { name: AREA_BOOK }));
    expect(click).toHaveBeenCalledTimes(1);
    click.mockRestore();
  });

  it('shows the upload progress inside the field while the cover is sent', async () => {
    const server = stubLibraryServer({ books: [bookOf()], hold_uploads: true });
    renderField({ kind: 'book', title: 'Dom', item_id: 'b-1' });
    await userEvent.upload(screen.getByLabelText('Capa do livro', { selector: 'input' }), png());
    const bar = await screen.findByRole('progressbar', { name: 'Enviando a imagem' });
    expect(bar).toHaveAttribute('aria-valuenow', '50');
    server.release_uploads();
    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
  });

  it('ignores clicks while the cover is being sent', async () => {
    stubLibraryServer({ books: [bookOf()], hold_uploads: true });
    renderField({ kind: 'book', title: 'Dom', item_id: 'b-1' });
    await userEvent.upload(screen.getByLabelText('Capa do livro', { selector: 'input' }), png());
    const area = screen.getByRole('button', { name: AREA_BOOK });
    await waitFor(() => {
      expect(area).toHaveAttribute('aria-disabled', 'true');
    });
    const click = vi.spyOn(HTMLInputElement.prototype, 'click');
    await userEvent.click(area);
    expect(click).not.toHaveBeenCalled();
    click.mockRestore();
  });

  it('has no axe violations', async () => {
    stubLibraryServer({ books: [bookOf()] });
    const { container } = renderField({ kind: 'book', title: 'Dom', item_id: 'b-1' });
    expect(await axe(container)).toHaveNoViolations();
  });
});
