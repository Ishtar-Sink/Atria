import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearToasts } from '../../shared/toast/toast-store';
import { articleOf, renderLibrary, stubLibraryServer } from './library-test-server';

afterEach(() => {
  vi.unstubAllGlobals();
  clearToasts();
});

const posts = (server: ReturnType<typeof stubLibraryServer>) =>
  server.calls.filter((call) => call.method === 'POST' && call.url.pathname === '/api/v1/articles');

describe('article form', () => {
  it('creates an article with title, url, author, source, tags and reading status', async () => {
    const server = stubLibraryServer();
    renderLibrary('/library/articles/new');
    await userEvent.type(await screen.findByLabelText('Título'), 'Sobre a atenção');
    await userEvent.type(screen.getByLabelText('Endereço'), 'https://exemplo.test/atencao');
    await userEvent.type(screen.getByLabelText('Autoria'), 'Ana Souza');
    await userEvent.type(screen.getByLabelText('Fonte'), 'Revista Exemplo');
    await userEvent.type(screen.getByLabelText('Etiquetas'), 'foco{Enter}');
    expect(screen.getByRole('radio', { name: 'Para ler' })).toBeChecked();
    await userEvent.click(screen.getByRole('radio', { name: 'Lendo' }));
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => {
      expect(posts(server)).toHaveLength(1);
    });
    expect(posts(server)[0]?.body).toMatchObject({
      title: 'Sobre a atenção',
      url: 'https://exemplo.test/atencao',
      author: 'Ana Souza',
      source: 'Revista Exemplo',
      tags: ['foco'],
      reading_status: 'reading',
    });
  });

  it('pd36 uploads an article cover in 16 by 9', async () => {
    const server = stubLibraryServer();
    renderLibrary('/library/articles/new');
    await userEvent.type(await screen.findByLabelText('Título'), 'Com capa');
    const area = screen.getByRole('button', {
      name: 'Capa do artigo: clique ou arraste uma imagem',
    });
    expect(area.className).toMatch(/landscape/);
    await userEvent.upload(
      screen.getByLabelText('Capa do artigo', { selector: 'input' }),
      new File([new Uint8Array(32)], 'capa.webp', { type: 'image/webp' }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => {
      expect(server.calls.some((call) => call.url.pathname.endsWith('/cover'))).toBe(true);
    });
    const cover = server.calls.find((call) => call.url.pathname.endsWith('/cover'));
    expect(cover?.url.pathname).toMatch(/^\/api\/v1\/articles\/.+\/cover$/);
    expect(cover?.content_type).toBe('image/webp');
  });

  it('attaches an optional pdf', async () => {
    const server = stubLibraryServer();
    renderLibrary('/library/articles/new');
    await userEvent.type(await screen.findByLabelText('Título'), 'Com PDF');
    await userEvent.upload(
      screen.getByLabelText('PDF (opcional)'),
      new File([new Uint8Array(8)], 'artigo.pdf', { type: 'application/pdf' }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => {
      expect(server.calls.some((call) => call.url.pathname.endsWith('/pdf'))).toBe(true);
    });
    expect(server.calls.find((call) => call.url.pathname.endsWith('/pdf'))?.url.pathname).toMatch(
      /^\/api\/v1\/articles\/.+\/pdf$/,
    );
  });

  it('rejects an address that is not http or https inside the form', async () => {
    const server = stubLibraryServer();
    renderLibrary('/library/articles/new');
    await userEvent.type(await screen.findByLabelText('Título'), 'Endereço ruim');
    await userEvent.type(screen.getByLabelText('Endereço'), 'javascript:alert(1)');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Informe um endereço http ou https.',
    );
    expect(posts(server)).toHaveLength(0);
  });

  it('keeps the article without a progress bar', async () => {
    stubLibraryServer({ articles: [articleOf()] });
    renderLibrary('/library/articles/a-1');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Sobre a atenção' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.getByText('Para ler')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'https://exemplo.test/atencao' })).toHaveAttribute(
      'rel',
      'noopener noreferrer',
    );
    // Sem sessões de leitura: só Visão geral e Notas (RN-22).
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      'Visão geral',
      'Notas',
    ]);
  });
});
