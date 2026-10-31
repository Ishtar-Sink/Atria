import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { rootRoute } from '../../app/router';
import { renderWithProviders } from '../../shared/test/render';
import { createReportsRoutes } from './routes';

type Mode = 'ok' | 'loading' | 'error';

function stub(mode: Mode) {
  const urls: URL[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((input: string | URL | Request) => {
      const url = new URL(input instanceof Request ? input.url : input, 'http://localhost');
      if (url.pathname === '/api/v1/me') {
        return Promise.resolve(
          new Response(JSON.stringify({ id: 'u-1', email: 'a@b.c' }), {
            headers: { 'Content-Type': 'application/json' },
          }),
        );
      }
      urls.push(url);
      if (mode === 'loading') return new Promise<Response>(() => undefined);
      if (mode === 'error') {
        return Promise.resolve(new Response('{"code":"boom","title":"x"}', { status: 500 }));
      }
      const csv = url.searchParams.get('format') === 'csv';
      return Promise.resolve(
        new Response(csv ? 'zip' : '{}', {
          headers: {
            'Content-Type': csv ? 'application/zip' : 'application/json',
            'Content-Disposition': `attachment; filename="${csv ? 'atria-export-csv.zip' : 'atria-export.json'}"`,
          },
        }),
      );
    }),
  );
  return urls;
}

function renderExports() {
  return renderWithProviders(null, {
    routes: createReportsRoutes(rootRoute),
    route: '/reports/exports',
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function captureDownloads() {
  const names: string[] = [];
  vi.stubGlobal(
    'URL',
    Object.assign(URL, { createObjectURL: () => 'blob:x', revokeObjectURL: () => undefined }),
  );
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    names.push(this.download);
  });
  return names;
}

describe('ExportsPage', () => {
  it('downloads all user data as json', async () => {
    const urls = stub('ok');
    const names = captureDownloads();
    renderExports();
    await userEvent.click(await screen.findByRole('button', { name: 'Exportar JSON' }));
    await waitFor(() => {
      expect(names).toEqual(['atria-export.json']);
    });
    expect(urls[0]?.pathname).toBe('/api/v1/exports');
    expect(urls[0]?.searchParams.get('format')).toBe('json');
  });

  it('downloads all user data as csv', async () => {
    const urls = stub('ok');
    const names = captureDownloads();
    renderExports();
    await userEvent.click(await screen.findByRole('button', { name: 'Exportar CSV' }));
    await waitFor(() => {
      expect(names).toEqual(['atria-export-csv.zip']);
    });
    expect(urls[0]?.searchParams.get('format')).toBe('csv');
  });

  it('shows the loading state while exporting', async () => {
    stub('loading');
    renderExports();
    await userEvent.click(await screen.findByRole('button', { name: 'Exportar JSON' }));
    const busy = await screen.findByRole('button', { name: 'Preparando o arquivo…' });
    expect(busy).toBeDisabled();
    expect(busy).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('button', { name: 'Exportar CSV' })).toBeDisabled();
  });

  it('shows the error state when the export fails', async () => {
    stub('error');
    renderExports();
    await userEvent.click(await screen.findByRole('button', { name: 'Exportar CSV' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível exportar');
    expect(screen.getByRole('button', { name: 'Exportar CSV' })).toBeEnabled();
  });

  it('has no axe violations', async () => {
    stub('ok');
    const { container } = renderExports();
    await screen.findByRole('button', { name: 'Exportar JSON' });
    expect(await axe(container)).toHaveNoViolations();
  });
});
