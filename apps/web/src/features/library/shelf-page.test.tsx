import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearToasts } from '../../shared/toast/toast-store';
import {
  articleOf,
  bookOf,
  renderLibrary,
  stubLibraryServer,
  videoOf,
} from './library-test-server';

afterEach(() => {
  vi.unstubAllGlobals();
  clearToasts();
  localStorage.clear();
});

async function expectNoViolations(container: HTMLElement) {
  expect(await axe(container)).toHaveNoViolations();
}

const lastList = (server: ReturnType<typeof stubLibraryServer>, path: string) =>
  server.calls.filter((call) => call.method === 'GET' && call.url.pathname === path).at(-1);

function expectViewIcons(group: HTMLElement, names: string[]): void {
  const buttons = within(group).getAllByRole('button');
  expect(buttons.map((b) => b.getAttribute('aria-label'))).toEqual(names);
  for (const [i, button] of buttons.entries()) {
    expect(button).toHaveAttribute('title', names[i]);
    expect(button).toHaveAccessibleName(names[i] ?? '');
    expect(button.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(button.textContent).toBe('');
  }
}

describe('library shelf', () => {
  it('pd35 shows one tab per type books articles and videos', async () => {
    stubLibraryServer({ books: [bookOf()] });
    renderLibrary('/library');
    expect(await screen.findByRole('heading', { level: 1, name: 'Acervo' })).toBeInTheDocument();
    const tabs = within(screen.getByRole('tablist')).getAllByRole('tab');
    expect(tabs.map((tab) => tab.textContent)).toEqual(['Livros', 'Artigos', 'Vídeos']);
    expect(screen.getByRole('tab', { name: 'Livros' })).toHaveAttribute('aria-selected', 'true');
    expect(await screen.findByRole('link', { name: 'Dom Casmurro' })).toBeInTheDocument();
  });

  it('pd35 filters articles by reading status with chips', async () => {
    const server = stubLibraryServer({
      articles: [articleOf(), articleOf({ id: 'a-2', title: 'Outro', reading_status: 'reading' })],
    });
    const { router } = renderLibrary('/library?tab=articles');
    await screen.findByRole('link', { name: 'Sobre a atenção' });
    const group = screen.getByRole('group', { name: 'Filtros' });
    expect(
      within(group)
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['Todos', 'Para ler', 'Lendo', 'Lido']);
    await userEvent.click(within(group).getByRole('button', { name: 'Lendo' }));
    await waitFor(() => {
      expect(lastList(server, '/api/v1/articles')?.url.searchParams.get('reading_status')).toBe(
        'reading',
      );
    });
    expect(router.state.location.search).toMatchObject({ tab: 'articles', status: 'reading' });
    expect(await screen.findByRole('link', { name: 'Outro' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Sobre a atenção' })).not.toBeInTheDocument();
  });

  it('pd35 filters books by reading status with chips', async () => {
    const server = stubLibraryServer({ books: [bookOf()] });
    renderLibrary('/library');
    await screen.findByRole('link', { name: 'Dom Casmurro' });
    const group = screen.getByRole('group', { name: 'Filtros' });
    expect(
      within(group)
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['Todos', 'Quero ler', 'Lendo', 'Lido']);
    await userEvent.click(within(group).getByRole('button', { name: 'Quero ler' }));
    await waitFor(() => {
      expect(lastList(server, '/api/v1/books')?.url.searchParams.get('reading_status')).toBe(
        'want_to_read',
      );
    });
  });

  it('pd35 filters videos by watch status with chips', async () => {
    const server = stubLibraryServer({ videos: [videoOf()] });
    renderLibrary('/library?tab=videos');
    await screen.findByRole('link', { name: 'Aula de redes' });
    const group = screen.getByRole('group', { name: 'Filtros' });
    expect(
      within(group)
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['Todos', 'Para assistir', 'Assistindo', 'Assistido']);
    await userEvent.click(within(group).getByRole('button', { name: 'Assistindo' }));
    await waitFor(() => {
      expect(lastList(server, '/api/v1/videos')?.url.searchParams.get('watch_status')).toBe(
        'watching',
      );
    });
    expect(lastList(server, '/api/v1/videos')?.url.searchParams.has('reading_status')).toBe(false);
  });

  it('pd35 keeps the status chip of each tab in the url', async () => {
    stubLibraryServer({ books: [bookOf()], articles: [articleOf()] });
    const { router } = renderLibrary('/library?tab=articles&status=read');
    await screen.findByRole('tab', { name: 'Artigos' });
    expect(screen.getByRole('button', { name: 'Lido' })).toHaveAttribute('aria-pressed', 'true');
    // Trocar de aba descarta o status, porque os valores são de cada tipo.
    await userEvent.click(screen.getByRole('tab', { name: 'Vídeos' }));
    await waitFor(() => {
      expect(router.state.location.search).toMatchObject({ tab: 'videos' });
    });
    expect(router.state.location.search).not.toHaveProperty('status');
    expect(screen.getByRole('button', { name: 'Todos' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('pd35 ignores a status that is not from the open tab', async () => {
    stubLibraryServer({ videos: [videoOf()] });
    renderLibrary('/library?tab=videos&status=reading');
    await screen.findByRole('link', { name: 'Aula de redes' });
    expect(screen.getByRole('button', { name: 'Todos' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Assistindo' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('pd38 shows book covers in portrait columns of at least 170 px and articles and videos in landscape', async () => {
    stubLibraryServer({
      books: [bookOf({ cover_file_id: 'f-1' })],
      articles: [articleOf({ cover_file_id: 'f-2' })],
    });
    const css = readFileSync(join(import.meta.dirname, 'library.module.css'), 'utf8');
    expect(css).toMatch(/\.shelfGrid\s*\{[^}]*minmax\(170px, 1fr\)/);
    renderLibrary('/library');
    const link = await screen.findByRole('link', { name: 'Dom Casmurro' });
    const cover = link.closest('li')?.querySelector('[data-cover]');
    expect(cover).toHaveAttribute('data-cover', '2:3');
    expect(cover?.className).toMatch(/portrait/);
    expect(cover?.querySelector('img')).toHaveAttribute('src', '/api/v1/files/f-1');

    await userEvent.click(screen.getByRole('tab', { name: 'Artigos' }));
    const article = await screen.findByRole('link', { name: 'Sobre a atenção' });
    const wide = article.closest('li')?.querySelector('[data-cover]');
    expect(wide).toHaveAttribute('data-cover', '16:9');
    expect(wide?.className).toMatch(/landscape/);
  });

  it('pd38 uses a deterministic gradient from the id without cover', async () => {
    stubLibraryServer({ books: [bookOf()] });
    renderLibrary('/library');
    const link = await screen.findByRole('link', { name: 'Dom Casmurro' });
    const fill = () =>
      link.closest('li')?.querySelector<HTMLElement>('[data-cover] span')?.style.background;
    expect(fill()).toMatch(/linear-gradient/);
    const first = fill();
    expect(link.closest('li')?.querySelector('img')).toBeNull();
    // O mesmo id gera sempre o mesmo gradiente.
    expect(fill()).toBe(first);
  });

  it('pd39 keeps the progress and status at the foot of the shelf card', async () => {
    stubLibraryServer({
      books: [
        bookOf({ pages_read_total: 55, progress_percent: 27.5 }),
        bookOf({ id: 'b-2', title: 'Um título bem mais longo que ocupa duas linhas no cartão' }),
      ],
    });
    const css = readFileSync(join(import.meta.dirname, 'library.module.css'), 'utf8');
    expect(css).toMatch(/\.tileFoot\s*\{[^}]*margin-top:\s*auto/);
    expect(css).toMatch(/\.tile\s*\{[^}]*height:\s*100%/);
    renderLibrary('/library');
    const card = (await screen.findByRole('link', { name: 'Dom Casmurro' })).closest('li');
    const foot = card?.lastElementChild as HTMLElement;
    expect(foot.className).toMatch(/tileFoot/);
    expect(within(foot).getByRole('progressbar')).toBeInTheDocument();
    expect(within(foot).getByText('Quero ler')).toBeInTheDocument();
  });

  it('uses the shared view icons with title and accessible name', async () => {
    stubLibraryServer({ books: [bookOf()] });
    renderLibrary('/library');
    await screen.findByRole('link', { name: 'Dom Casmurro' });
    expectViewIcons(screen.getByRole('group', { name: 'Visualização' }), ['Grade', 'Lista']);
  });

  it('pd24 remembers the view mode per tab', async () => {
    stubLibraryServer({ books: [bookOf()], articles: [articleOf()] });
    renderLibrary('/library');
    await screen.findByRole('link', { name: 'Dom Casmurro' });
    const switcher = screen.getByRole('group', { name: 'Visualização' });
    await userEvent.click(within(switcher).getByRole('button', { name: 'Lista' }));
    await waitFor(() => {
      expect(localStorage.getItem('atria_view:library:books')).toBe('list');
    });
    expect(localStorage.getItem('atria_view:library:articles')).toBeNull();
    await userEvent.click(screen.getByRole('tab', { name: 'Artigos' }));
    await screen.findByRole('link', { name: 'Sobre a atenção' });
    expect(
      within(screen.getByRole('group', { name: 'Visualização' })).getByRole('button', {
        name: 'Grade',
      }),
    ).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(screen.getByRole('tab', { name: 'Livros' }));
    await screen.findByRole('link', { name: 'Dom Casmurro' });
    expect(
      within(screen.getByRole('group', { name: 'Visualização' })).getByRole('button', {
        name: 'Lista',
      }),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  it('pd61 lists the library reports in the Relatórios menu', async () => {
    stubLibraryServer({ books: [bookOf()] });
    renderLibrary('/library');
    await screen.findByRole('link', { name: 'Dom Casmurro' });
    await userEvent.click(screen.getByRole('button', { name: 'Relatórios' }));
    const menu = await screen.findByRole('menu', { name: 'Relatórios' });
    const items = within(menu).getAllByRole('menuitem');
    expect(items.map((item) => item.textContent)).toEqual(['Páginas lidas', 'Acervo por status']);
    expect(items[0]).toHaveAttribute('href', expect.stringContaining('/reports/read-pages'));
    expect(items[1]).toHaveAttribute('href', expect.stringContaining('/reports/lib-status'));
  });

  it('pd09 offers one card per type with icon and description', async () => {
    stubLibraryServer({ books: [bookOf()] });
    renderLibrary('/library');
    await screen.findByRole('link', { name: 'Dom Casmurro' });
    await userEvent.click(screen.getByRole('button', { name: 'Novo' }));
    const dialog = await screen.findByRole('dialog');
    const cards = within(dialog).getAllByRole('link');
    expect(cards).toHaveLength(3);
    expect(cards.map((card) => card.getAttribute('data-create-type'))).toEqual([
      'book',
      'article',
      'video',
    ]);
    expect(
      within(dialog).getByText('Com capa, páginas e progresso de leitura'),
    ).toBeInTheDocument();
    cards.forEach((card) => {
      expect(card.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
    });
  });

  it('pd09 focuses the type of the open tab', async () => {
    stubLibraryServer({ articles: [articleOf()] });
    renderLibrary('/library?tab=articles');
    await screen.findByRole('link', { name: 'Sobre a atenção' });
    await userEvent.click(screen.getByRole('button', { name: 'Novo' }));
    const dialog = await screen.findByRole('dialog');
    await waitFor(() => {
      expect(within(dialog).getByRole('link', { name: /Artigo/ })).toHaveFocus();
    });
  });

  it('pd09 opens the form of the chosen type without a type field', async () => {
    stubLibraryServer({ videos: [] });
    const { router } = renderLibrary('/library?tab=videos');
    await userEvent.click(await screen.findByRole('button', { name: 'Novo' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('link', { name: /Vídeo/ }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/library/videos/new');
    });
    expect(await screen.findByLabelText('Endereço')).toBeInTheDocument();
    expect(screen.queryByLabelText('Tipo')).not.toBeInTheDocument();
  });

  it('pd10 follows the grid or list preference', async () => {
    localStorage.setItem('atria.settings.create_layout.u-1', 'list');
    stubLibraryServer({ books: [bookOf()] });
    renderLibrary('/library');
    await screen.findByRole('link', { name: 'Dom Casmurro' });
    await waitFor(() => {
      expect(localStorage.getItem('atria.settings.create_layout.u-1')).toBe('list');
    });
    await userEvent.click(screen.getByRole('button', { name: 'Novo' }));
    const dialog = await screen.findByRole('dialog');
    await waitFor(() => {
      expect(dialog.querySelector('[data-layout]')).toHaveAttribute('data-layout', 'list');
    });
  });

  it('pd09 has no axe violations with the type dialog open', async () => {
    stubLibraryServer({ books: [bookOf()] });
    const { container } = renderLibrary('/library');
    await screen.findByRole('link', { name: 'Dom Casmurro' });
    await userEvent.click(screen.getByRole('button', { name: 'Novo' }));
    await screen.findByRole('dialog');
    await expectNoViolations(container);
  });

  it('exposes the Filtros, Busca and Visualização controls by accessible name', async () => {
    stubLibraryServer({ books: [bookOf()] });
    renderLibrary('/library');
    await screen.findByRole('link', { name: 'Dom Casmurro' });
    expect(screen.getByRole('group', { name: 'Filtros' })).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: 'Busca' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Visualização' })).toBeInTheDocument();
  });

  it('shows the book progress on the shelf', async () => {
    stubLibraryServer({
      books: [bookOf({ pages_read_total: 55, progress_percent: 27.5 })],
    });
    renderLibrary('/library');
    const bar = await screen.findByRole('progressbar', { name: 'Progresso de Dom Casmurro' });
    expect(bar).toHaveAttribute('aria-valuenow', '27.5');
    expect(screen.getByText('27,5%')).toBeInTheDocument();
  });

  it('reads search, filters and view mode from the URL', async () => {
    const server = stubLibraryServer({
      books: [bookOf({ tags: ['romance'] })],
    });
    const { router } = renderLibrary('/library?q=dom&tag=romance&view=list');
    await screen.findByRole('link', { name: 'Dom Casmurro' });
    const first = server.calls.find((call) => call.url.pathname === '/api/v1/books');
    expect(first?.url.searchParams.get('q')).toBe('dom');
    expect(first?.url.searchParams.get('tag')).toBe('romance');
    expect(screen.getByRole('button', { name: 'Lista' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('searchbox', { name: 'Busca' })).toHaveValue('dom');
    await userEvent.type(screen.getByRole('searchbox', { name: 'Busca' }), 'x');
    await waitFor(() => {
      expect(router.state.location.search).toMatchObject({ q: 'domx' });
    });
  });

  it('shows the empty state with explanatory text', async () => {
    stubLibraryServer();
    renderLibrary('/library');
    expect(await screen.findByText('Nada no acervo ainda')).toBeInTheDocument();
    expect(
      screen.getByText('Use o botão Novo para registrar um livro, um artigo ou um vídeo.'),
    ).toBeInTheDocument();
  });

  it('shows the loading state', async () => {
    stubLibraryServer({ mode: 'loading' });
    renderLibrary('/library');
    expect(await screen.findByText('Carregando o acervo…')).toBeInTheDocument();
  });

  it('shows the error state', async () => {
    stubLibraryServer({ mode: 'error' });
    renderLibrary('/library');
    expect(await screen.findByText('Não foi possível carregar o acervo')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeInTheDocument();
  });

  it('has no axe violations', async () => {
    stubLibraryServer({
      books: [bookOf({ pages_read_total: 55, progress_percent: 27.5 })],
    });
    const { container } = renderLibrary('/library');
    await screen.findByRole('link', { name: 'Dom Casmurro' });
    await expectNoViolations(container);
  });
});
