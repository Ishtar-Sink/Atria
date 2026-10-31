import { paletteFor } from '@atria/theme';
import { hexToRgb } from '@atria/ui';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { rootRoute } from '../../app/router';
import { renderWithProviders } from '../../shared/test/render';
import { clearToasts } from '../../shared/toast/toast-store';
import { createProjectsRoutes } from './routes';
import { cardOf, defaultLanes, projectOf, stubServer } from './test-server';

afterEach(() => {
  vi.unstubAllGlobals();
  clearToasts();
});

function renderAt(route: string) {
  return renderWithProviders(null, { routes: createProjectsRoutes(rootRoute), route });
}

function seeded() {
  return stubServer({
    projects: [
      projectOf({ id: 'p-1', name: 'Reforma da sala' }),
      projectOf({ id: 'p-2', name: 'Viagem de julho', visibility: 'shared' }),
    ],
    lanes: [
      ...defaultLanes('p-1'),
      ...defaultLanes('p-2').map((lane) => ({ ...lane, id: `p2-${lane.id}` })),
    ],
    cards: [
      cardOf({ id: 'c-1', title: 'Comprar tinta', lane_id: 'l-done' }),
      cardOf({ id: 'c-2', title: 'Escolher sofá', lane_id: 'l-wait' }),
      cardOf({ id: 'c-3', title: 'Pintar paredes', lane_id: 'l-doing', position: 0 }),
    ],
  });
}

describe('projects list', () => {
  it('lists projects as a list and as a grid', async () => {
    seeded();
    const { router } = renderAt('/projects');
    expect(await screen.findByRole('heading', { level: 1, name: 'Projetos' })).toHaveAttribute(
      'data-page-heading',
    );
    expect(await screen.findByRole('link', { name: 'Reforma da sala' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Viagem de julho' })).toBeInTheDocument();

    const views = screen.getByRole('group', { name: 'Visualização' });
    await userEvent.click(within(views).getByRole('button', { name: 'Grade' }));
    await waitFor(() => {
      expect(router.state.location.search).toMatchObject({ view: 'grid' });
    });
    expect(within(views).getByRole('button', { name: 'Grade' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('link', { name: 'Reforma da sala' })).toBeInTheDocument();
    await userEvent.click(within(views).getByRole('button', { name: 'Lista' }));
    await waitFor(() => {
      expect(router.state.location.search).toMatchObject({ view: 'list' });
    });
  });

  it('pd42 shows the project progress from the listing', async () => {
    seeded();
    renderAt('/projects');
    await screen.findByRole('link', { name: 'Reforma da sala' });
    // 3 cartões em p-1: só o da raia "Pronto" conta como pronto.
    expect(screen.getAllByText('1 de 3 cartões prontos').length).toBeGreaterThan(0);
    expect(
      screen.getByRole('progressbar', { name: 'Progresso de Reforma da sala' }),
    ).toHaveAttribute('aria-valuenow', '33');
    expect(screen.getByText('Nenhum cartão ainda')).toBeInTheDocument();
  });

  it('pd61 lists the projects report in the Relatórios menu', async () => {
    seeded();
    renderAt('/projects');
    await screen.findByRole('link', { name: 'Reforma da sala' });
    await userEvent.click(screen.getByRole('button', { name: 'Relatórios' }));
    expect(screen.getByRole('menuitem', { name: 'Cartões por raia' })).toHaveAttribute(
      'href',
      '/reports/proj-cards?from_module=projects',
    );
  });

  it('exposes the Filtros, Busca and Visualização controls by accessible name', async () => {
    seeded();
    renderAt('/projects');
    await screen.findByRole('link', { name: 'Reforma da sala' });
    expect(screen.getByRole('group', { name: 'Filtros' })).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: 'Busca' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Visualização' })).toBeInTheDocument();
  });

  it('reads search, filters and view mode from the URL', async () => {
    const server = seeded();
    const { router } = renderAt('/projects?q=viagem&visibility=shared&view=grid');
    await screen.findByRole('link', { name: 'Viagem de julho' });
    const first = server.calls.find((call) => call.url.pathname === '/api/v1/projects');
    expect(first?.url.searchParams.get('q')).toBe('viagem');
    expect(first?.url.searchParams.get('visibility')).toBe('shared');
    expect(screen.queryByRole('link', { name: 'Reforma da sala' })).not.toBeInTheDocument();

    await userEvent.type(screen.getByRole('searchbox', { name: 'Busca' }), 'x');
    await waitFor(() => {
      expect(router.state.location.search).toMatchObject({ q: 'viagemx' });
    });
    await userEvent.click(screen.getByLabelText('Visibilidade'));
    await userEvent.click(screen.getByRole('option', { name: 'Todas' }));
    await waitFor(() => {
      expect(router.state.location.search).not.toHaveProperty('visibility');
    });
  });

  it('uses a deterministic color for projects without image', async () => {
    seeded();
    const { container } = renderAt('/projects');
    await screen.findByRole('link', { name: 'Reforma da sala' });
    const [from, to] = paletteFor('p-1');
    const swatch = container.querySelector<HTMLElement>('li span[aria-hidden="true"]');
    const rgb = (hex: string) => `rgb(${(hexToRgb(hex) ?? []).join(', ')})`;
    expect(swatch?.style.background).toBe(`linear-gradient(135deg, ${rgb(from)}, ${rgb(to)})`);
  });

  it('shows the empty state with explanatory text', async () => {
    stubServer();
    const { container } = renderAt('/projects');
    expect(await screen.findByText('Nenhum projeto por aqui')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Crie um projeto para organizar cartões em raias, do que espera ao que está pronto.',
      ),
    ).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('shows the loading state', async () => {
    stubServer({ mode: 'loading' });
    renderAt('/projects');
    expect(await screen.findByRole('status')).toHaveAttribute('aria-busy', 'true');
  });

  it('shows the error state', async () => {
    stubServer({ mode: 'error' });
    renderAt('/projects');
    expect(await screen.findByRole('button', { name: 'Tentar de novo' })).toBeInTheDocument();
    expect(screen.getByText('Não foi possível carregar os projetos')).toBeInTheDocument();
  });

  it('has no axe violations', async () => {
    seeded();
    const { container } = renderAt('/projects');
    await screen.findByRole('link', { name: 'Reforma da sala' });
    expect(await axe(container)).toHaveNoViolations();
  });
});
