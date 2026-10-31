import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { rootRoute } from '../../app/router';
import { renderWithProviders } from '../../shared/test/render';
import { clearToasts } from '../../shared/toast/toast-store';
import { loadPdf, PdfLoadError, type PdfDocument } from './load-pdf';
import { createReaderRoutes } from './routes';

// O jsdom não tem canvas nem a biblioteca de PDF: o carregamento é simulado.
vi.mock('./load-pdf', () => {
  class PdfLoadError extends Error {
    kind: 'corrupted' | 'protected';
    constructor(kind: 'corrupted' | 'protected') {
      super(kind);
      this.kind = kind;
    }
  }
  return { loadPdf: vi.fn(), PdfLoadError };
});

interface Call {
  method: string;
  path: string;
  body: Record<string, unknown>;
}

let calls: Call[] = [];

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function stubApi(options: { position?: number | null } = {}) {
  calls = [];
  const position = options.position === undefined ? 12 : options.position;
  vi.stubGlobal(
    'fetch',
    vi.fn((input: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      const body =
        typeof init?.body === 'string' ? (JSON.parse(init.body) as Record<string, unknown>) : {};
      const path = input.replace('/api/v1', '');
      if (path === '/me') return Promise.resolve(json({ id: 'u-1', email: 'a@b.c' }));
      calls.push({ method, path, body });
      if (path === '/books/b-1') {
        return Promise.resolve(json({ id: 'b-1', title: 'Dom Casmurro', pdf_file_id: 'f-1' }));
      }
      if (path === '/books/b-1/reading-position') {
        return Promise.resolve(json({ page: method === 'PUT' ? body.page : position }));
      }
      if (path === '/books/b-1/highlights') return Promise.resolve(json({ items: [] }));
      if (path === '/books/b-1/reading-sessions') return Promise.resolve(json({ id: 's-1' }, 201));
      return Promise.resolve(json({ code: 'not_found', title: 'x' }, 404));
    }),
  );
}

function fakeDoc(page_count = 40): PdfDocument {
  return {
    page_count,
    first_page_size: { width: 600, height: 800 },
    render_page: vi.fn(() =>
      Promise.resolve({ size: { width: 600, height: 800 }, has_text: true }),
    ),
    destroy: vi.fn(),
  };
}

let observers: { callback: IntersectionObserverCallback; targets: Set<Element> }[] = [];

class FakeIntersectionObserver {
  private readonly entry: (typeof observers)[number];
  constructor(callback: IntersectionObserverCallback) {
    this.entry = { callback, targets: new Set() };
    observers.push(this.entry);
  }
  observe(target: Element) {
    this.entry.targets.add(target);
  }
  unobserve(target: Element) {
    this.entry.targets.delete(target);
  }
  disconnect() {
    this.entry.targets.clear();
  }
}

/** Marca como perto da tela só as páginas pedidas. */
function setNearPages(pages: number[]) {
  act(() => {
    observers.forEach(({ callback, targets }) => {
      const entries = Array.from(targets).map((target) => ({
        target,
        isIntersecting: pages.includes(Number(target.getAttribute('data-page'))),
      }));
      callback(entries as IntersectionObserverEntry[], {} as IntersectionObserver);
    });
  });
}

function renderReader() {
  return renderWithProviders(null, {
    routes: createReaderRoutes(rootRoute),
    route: '/library/books/b-1/read',
  });
}

async function readerReady() {
  await screen.findByRole('region', { name: 'Páginas do PDF' });
  await waitFor(() => {
    expect(screen.getByLabelText('Página atual')).toHaveValue('12');
  });
}

beforeEach(() => {
  observers = [];
  vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
  stubApi();
  vi.mocked(loadPdf).mockResolvedValue(fakeDoc());
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.mocked(loadPdf).mockReset();
  clearToasts();
});

describe('ReaderPage', () => {
  it('renders without sidebar and topbar', async () => {
    renderReader();
    await readerReady();
    expect(screen.getByRole('toolbar', { name: 'Barra do leitor' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    expect(screen.queryByRole('banner')).not.toBeInTheDocument();
    expect(screen.getByText('Dom Casmurro')).toBeInTheDocument();
  });

  it('zooms in and out', async () => {
    const user = userEvent.setup();
    renderReader();
    await readerReady();
    await user.click(screen.getByRole('button', { name: 'Aumentar zoom' }));
    expect(screen.getByRole('button', { name: /Zoom 125%, restaurar/ })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Diminuir zoom' }));
    await user.click(screen.getByRole('button', { name: 'Diminuir zoom' }));
    expect(screen.getByRole('button', { name: /Zoom 75%, restaurar/ })).toBeVisible();
    await user.click(screen.getByRole('button', { name: /restaurar para 100%/ }));
    expect(screen.getByRole('button', { name: /Zoom 100%, restaurar/ })).toBeVisible();
  });

  it('navigates by page with buttons and keyboard', async () => {
    const user = userEvent.setup();
    renderReader();
    await readerReady();
    const page = screen.getByLabelText('Página atual');
    await user.click(screen.getByRole('button', { name: 'Próxima página' }));
    expect(page).toHaveValue('13');
    await user.click(screen.getByRole('button', { name: 'Página anterior' }));
    expect(page).toHaveValue('12');
    screen.getByRole('region', { name: 'Páginas do PDF' }).focus();
    await user.keyboard('{PageDown}');
    expect(page).toHaveValue('13');
    await user.keyboard('{ArrowLeft}{ArrowLeft}');
    expect(page).toHaveValue('11');
    await user.clear(page);
    await user.type(page, '30{Enter}');
    expect(page).toHaveValue('30');
  });

  it('toggles light and dark theme', async () => {
    const user = userEvent.setup();
    const { container } = renderReader();
    await readerReady();
    const root = container.querySelector('[data-theme]');
    expect(root).toHaveAttribute('data-theme', 'light');
    await user.click(screen.getByRole('button', { name: 'Usar tema escuro no leitor' }));
    expect(root).toHaveAttribute('data-theme', 'dark');
    expect(document.documentElement).not.toHaveAttribute('data-theme', 'dark');
    await user.click(screen.getByRole('button', { name: 'Usar tema claro no leitor' }));
    expect(root).toHaveAttribute('data-theme', 'light');
  });

  it('keeps the download button and shows an error for a corrupted pdf', async () => {
    vi.mocked(loadPdf).mockRejectedValue(new PdfLoadError('corrupted'));
    renderReader();
    expect(await screen.findByRole('alert')).toHaveTextContent('corrompido');
    expect(screen.getByRole('link', { name: 'Baixar' })).toHaveAttribute(
      'href',
      '/api/v1/files/f-1',
    );
  });

  it('shows a protected pdf error', async () => {
    vi.mocked(loadPdf).mockRejectedValue(new PdfLoadError('protected'));
    renderReader();
    expect(await screen.findByRole('alert')).toHaveTextContent('protegido por senha');
    expect(screen.getByRole('link', { name: 'Baixar' })).toBeVisible();
  });

  it('renders only the pages near the viewport', async () => {
    const doc = fakeDoc();
    vi.mocked(loadPdf).mockResolvedValue(doc);
    renderReader();
    await readerReady();
    setNearPages([11, 12, 13]);
    await waitFor(() => {
      expect(doc.render_page).toHaveBeenCalledWith(12, expect.anything());
    });
    const rendered = vi.mocked(doc.render_page).mock.calls.map(([page]) => page);
    expect(rendered).toContain(11);
    expect(rendered).toContain(13);
    expect(rendered).not.toContain(30);
    expect(rendered).not.toContain(40);
    expect(document.querySelectorAll('[data-near="true"]')).toHaveLength(3);
  });

  it('shows the loading state', async () => {
    vi.mocked(loadPdf).mockReturnValue(new Promise(() => undefined));
    renderReader();
    expect(await screen.findByRole('status')).toHaveTextContent('Carregando o PDF');
  });

  it('has no axe violations', async () => {
    const { container } = renderReader();
    await readerReady();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('dec004 closing keeps the page and offers the session with the pages read', async () => {
    const user = userEvent.setup();
    renderReader();
    await readerReady();
    await user.click(screen.getByRole('button', { name: 'Próxima página' }));
    await user.click(screen.getByRole('button', { name: 'Próxima página' }));
    await user.click(screen.getByRole('button', { name: /Fechar leitor/ }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/da página 12 até a 14/)).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Páginas lidas')).toHaveValue(2);
    const closing = calls.filter((call) => call.method === 'PUT');
    expect(closing.map((call) => call.body)).toEqual([{ page: 14 }]);

    await user.click(within(dialog).getByRole('button', { name: 'Registrar sessão' }));
    await waitFor(() => {
      expect(calls.some((call) => call.method === 'POST')).toBe(true);
    });
    const post = calls.find((call) => call.method === 'POST');
    expect(post?.body).toMatchObject({ pages_read: 2, from_page: 12, to_page: 14 });
    expect(calls.filter((call) => call.method === 'PUT')).toHaveLength(1);
  });

  it('dec004 skipping the session still saves the closing page', async () => {
    const user = userEvent.setup();
    renderReader();
    await readerReady();
    await user.click(screen.getByRole('button', { name: 'Próxima página' }));
    await user.click(screen.getByRole('button', { name: /Fechar leitor/ }));
    await user.click(await screen.findByRole('button', { name: 'Agora não' }));
    expect(calls.filter((call) => call.method === 'PUT').map((call) => call.body)).toEqual([
      { page: 13 },
    ]);
    expect(calls.some((call) => call.method === 'POST')).toBe(false);
  });

  it('closes without an offer when the reader did not advance', async () => {
    const user = userEvent.setup();
    const { router } = renderReader();
    await readerReady();
    await user.click(screen.getByRole('button', { name: /Fechar leitor/ }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/library/books/b-1');
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(calls.filter((call) => call.method === 'PUT').map((call) => call.body)).toEqual([
      { page: 12 },
    ]);
  });
});
