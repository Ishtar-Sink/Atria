import { screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { clearToasts } from '../../shared/toast/toast-store';
import { renderLibrary, stubLibraryServer, videoOf } from './library-test-server';

afterEach(() => {
  vi.unstubAllGlobals();
  clearToasts();
});

describe('video page', () => {
  it('pd37 shows the channel, the watch status and the url in the data card', async () => {
    stubLibraryServer({
      videos: [videoOf({ watch_status: 'watching', thumbnail_file_id: 't-1' })],
    });
    renderLibrary('/library/videos/v-1');
    const data = await screen.findByRole('region', { name: 'Dados' });
    expect(within(data).getByRole('img', { name: 'Miniatura de Aula de redes' })).toHaveAttribute(
      'src',
      '/api/v1/files/t-1',
    );
    expect(within(data).getByText('Canal Exemplo')).toBeInTheDocument();
    expect(within(data).getByText('Assistindo')).toBeInTheDocument();
    expect(
      within(data).getByRole('link', { name: 'https://www.youtube.com/watch?v=abc' }),
    ).toBeInTheDocument();
  });

  it('shows a dash when the video has no channel', async () => {
    stubLibraryServer({ videos: [videoOf({ channel: null })] });
    renderLibrary('/library/videos/v-1');
    const data = await screen.findByRole('region', { name: 'Dados' });
    expect(within(data).getByText('Canal').nextElementSibling).toHaveTextContent('—');
  });

  it('pd59 shows the Registro card on the side', async () => {
    stubLibraryServer({ videos: [videoOf({ tags: ['redes'], visibility: 'shared' })] });
    renderLibrary('/library/videos/v-1');
    const record = await screen.findByRole('region', { name: 'Registro' });
    expect(within(record).getByRole('list', { name: 'Etiquetas' })).toHaveTextContent('#redes');
    expect(within(record).getByText('Compartilhado')).toBeInTheDocument();
    expect(within(record).getByText('Criado em')).toBeInTheDocument();
  });

  it('has no read action and keeps notes in a tab', async () => {
    stubLibraryServer({ videos: [videoOf()] });
    renderLibrary('/library/videos/v-1');
    await screen.findByRole('link', { name: 'Editar' });
    expect(screen.queryByRole('link', { name: 'Ler' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      'Visão geral',
      'Notas',
    ]);
  });

  it('has no axe violations', async () => {
    stubLibraryServer({ videos: [videoOf({ thumbnail_file_id: 't-1' })] });
    const { container } = renderLibrary('/library/videos/v-1');
    await screen.findByRole('region', { name: 'Dados' });
    expect(await axe(container)).toHaveNoViolations();
  });
});
