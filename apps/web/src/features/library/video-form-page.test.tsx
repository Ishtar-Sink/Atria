import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearToasts } from '../../shared/toast/toast-store';
import { renderLibrary, stubLibraryServer, videoOf } from './library-test-server';

afterEach(() => {
  vi.unstubAllGlobals();
  clearToasts();
});

const posts = (server: ReturnType<typeof stubLibraryServer>) =>
  server.calls.filter((call) => call.method === 'POST' && call.url.pathname === '/api/v1/videos');

describe('video form', () => {
  it('creates a video with url and shows the thumbnail on the shelf', async () => {
    const server = stubLibraryServer();
    const form = renderLibrary('/library/videos/new');
    await userEvent.type(
      await screen.findByLabelText('Endereço'),
      'https://www.youtube.com/watch?v=abc',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => {
      expect(posts(server)).toHaveLength(1);
    });
    expect(posts(server)[0]?.body).toMatchObject({
      url: 'https://www.youtube.com/watch?v=abc',
      watch_status: 'to_watch',
    });
    // O servidor busca a miniatura; a vitrine a mostra pelo id do arquivo.
    server.videos[0] = { ...(server.videos[0] ?? videoOf()), thumbnail_file_id: 'thumb-1' };
    form.unmount();
    renderLibrary('/library?tab=videos');
    await waitFor(() => {
      expect(document.querySelector('img[src="/api/v1/files/thumb-1"]')).not.toBeNull();
    });
  });

  it('allows a manual thumbnail when none is fetched', async () => {
    const server = stubLibraryServer();
    renderLibrary('/library/videos/new');
    expect(
      await screen.findByText('Sem miniatura buscada? Envie uma imagem em 16:9.'),
    ).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Endereço'), 'https://exemplo.test/video');
    const group = screen.getByRole('group', { name: 'Miniatura do vídeo' });
    expect(group.className).toMatch(/landscape/);
    await userEvent.upload(
      within(group).getByLabelText('Miniatura do vídeo', { selector: 'input' }),
      new File([new Uint8Array(16)], 'mini.jpg', { type: 'image/jpeg' }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => {
      expect(server.calls.some((call) => call.url.pathname.endsWith('/thumbnail'))).toBe(true);
    });
    const upload = server.calls.find((call) => call.url.pathname.endsWith('/thumbnail'));
    expect(upload?.method).toBe('PUT');
    expect(upload?.content_type).toBe('image/jpeg');
  });

  it('pd37 places the thumbnail on the left and url, title, channel and status on the right', async () => {
    stubLibraryServer();
    const { container } = renderLibrary('/library/videos/new');
    await screen.findByLabelText('Endereço');
    const media = container.querySelector('[class*="formMedia"]');
    if (!media) throw new Error('sem a área da miniatura');
    expect(media.firstElementChild).toContainElement(
      screen.getByRole('group', { name: 'Miniatura do vídeo' }),
    );
    const right = media.lastElementChild;
    [
      screen.getByLabelText('Endereço'),
      screen.getByLabelText('Título'),
      screen.getByLabelText('Canal'),
      screen.getByRole('radiogroup', { name: 'Status de exibição' }),
    ].forEach((field) => {
      expect(right).toContainElement(field);
    });
  });

  it('pd37 saves the channel and the watch status', async () => {
    const server = stubLibraryServer();
    renderLibrary('/library/videos/new');
    await userEvent.type(await screen.findByLabelText('Endereço'), 'https://exemplo.test/v');
    await userEvent.type(screen.getByLabelText('Canal'), 'Canal Exemplo');
    expect(screen.getByRole('radio', { name: 'Para assistir' })).toBeChecked();
    await userEvent.click(screen.getByRole('radio', { name: 'Assistindo' }));
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => {
      expect(posts(server)).toHaveLength(1);
    });
    expect(posts(server)[0]?.body).toMatchObject({
      channel: 'Canal Exemplo',
      watch_status: 'watching',
    });
  });

  it('pd37 does not send a blank channel', async () => {
    const server = stubLibraryServer();
    renderLibrary('/library/videos/new');
    await userEvent.type(await screen.findByLabelText('Endereço'), 'https://exemplo.test/v');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => {
      expect(posts(server)).toHaveLength(1);
    });
    expect(posts(server)[0]?.body).not.toHaveProperty('channel');
  });

  it('pd37 shows the error of a channel over 300 characters with role alert', async () => {
    const server = stubLibraryServer();
    renderLibrary('/library/videos/new');
    await userEvent.type(await screen.findByLabelText('Endereço'), 'https://exemplo.test/v');
    await userEvent.click(screen.getByLabelText('Canal'));
    await userEvent.paste('c'.repeat(301));
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Use até 300 caracteres.');
    expect(posts(server)).toHaveLength(0);
  });

  it('rejects an address that is not http or https', async () => {
    const server = stubLibraryServer();
    renderLibrary('/library/videos/new');
    await userEvent.type(await screen.findByLabelText('Endereço'), 'ftp://exemplo.test/v');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Informe um endereço http ou https.',
    );
    expect(posts(server)).toHaveLength(0);
  });
});
