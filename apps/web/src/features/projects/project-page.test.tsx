import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { rootRoute } from '../../app/router';
import { renderWithProviders } from '../../shared/test/render';
import { clearToasts } from '../../shared/toast/toast-store';
import { createProjectsRoutes, type ProjectsRoutesOptions } from './routes';
import { callsTo, cardOf, defaultLanes, projectOf, stubServer } from './test-server';

afterEach(() => {
  vi.unstubAllGlobals();
  clearToasts();
});

function seeded() {
  return stubServer({
    projects: [projectOf()],
    lanes: defaultLanes(),
    cards: [cardOf({ id: 'c-1', title: 'Comprar tinta', lane_id: 'l-done' })],
  });
}

function renderAt(route: string, options: ProjectsRoutesOptions = {}) {
  return renderWithProviders(null, { routes: createProjectsRoutes(rootRoute, options), route });
}

const connections = {
  id: 'connections',
  label: 'Conexões',
  render: () => <p>Conteúdo das conexões</p>,
};

describe('project page', () => {
  it('pd41 opens on the overview tab by default', async () => {
    seeded();
    renderAt('/projects/p-1');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Reforma da sala' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Visão geral' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(await screen.findByRole('heading', { name: 'Andamento' })).toBeInTheDocument();
  });

  it('pd41 orders the tabs overview board extra tabs and settings last', async () => {
    seeded();
    renderAt('/projects/p-1', { extra_tabs: [connections] });
    await screen.findByRole('tablist');
    const names = screen.getAllByRole('tab').map((tab) => tab.textContent);
    expect(names).toEqual(['Visão geral', 'Quadro', 'Conexões', 'Configurações']);
    await userEvent.click(screen.getByRole('tab', { name: 'Conexões' }));
    expect(await screen.findByText('Conteúdo das conexões')).toBeInTheDocument();
  });

  it('pd41 keeps the tab in the URL', async () => {
    seeded();
    const { router } = renderAt('/projects/p-1?tab=settings');
    expect(await screen.findByRole('tab', { name: 'Configurações' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await userEvent.click(screen.getByRole('tab', { name: 'Quadro' }));
    await waitFor(() => {
      expect(router.state.location.search).toMatchObject({ tab: 'board' });
    });
    expect(screen.getByRole('tab', { name: 'Quadro' })).toHaveAttribute('aria-selected', 'true');
  });

  it('shows the extra links slot inside Ligações of the overview', async () => {
    seeded();
    renderAt('/projects/p-1', { links_slot: () => <p>Ligação do próprio projeto</p> });
    expect(await screen.findByText('Ligação do próprio projeto')).toBeInTheDocument();
    expect(screen.queryByText('Nenhuma ligação ainda.')).not.toBeInTheDocument();
  });

  it('pd14 shows Editar and keeps Excluir inside Mais ações', async () => {
    const server = seeded();
    const { router } = renderAt('/projects/p-1');
    const edit = await screen.findByRole('link', { name: 'Editar' });
    expect(edit).toHaveAttribute('href', '/projects/p-1/edit');
    expect(screen.queryByRole('button', { name: 'Excluir' })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Mais ações' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Excluir' }));
    const dialog = await screen.findByRole('alertdialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Excluir projeto' }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/projects');
    });
    expect(callsTo(server, 'DELETE', '/projects/p-1')).toHaveLength(1);
  });

  it('pd61 opens the cards per lane report filtered by the project', async () => {
    seeded();
    renderAt('/projects/p-1');
    await screen.findByRole('heading', { level: 1, name: 'Reforma da sala' });
    await userEvent.click(screen.getByRole('button', { name: 'Mais ações' }));
    const item = screen.getByRole('menuitem', { name: 'Relatório de cartões por raia' });
    expect(item.getAttribute('href')).toContain('/reports/proj-cards?project_id=p-1');
  });

  it('shows the error state when the project does not load', async () => {
    stubServer({ mode: 'error' });
    renderAt('/projects/p-1');
    expect(await screen.findByRole('button', { name: 'Tentar de novo' })).toBeInTheDocument();
  });

  it('has no axe violations', async () => {
    seeded();
    const { container } = renderAt('/projects/p-1');
    await screen.findByRole('heading', { name: 'Andamento' });
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('project form', () => {
  it('creates a project and opens it', async () => {
    const server = stubServer();
    const { router } = renderAt('/projects/new');
    await userEvent.type(await screen.findByLabelText('Nome'), 'Viagem de julho');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/projects/p-1');
    });
    expect(callsTo(server, 'POST', '/projects')[0]?.body).toMatchObject({
      name: 'Viagem de julho',
      visibility: 'personal',
    });
    // O projeto novo já abre com as três raias padrão.
    await userEvent.click(await screen.findByRole('tab', { name: 'Quadro' }));
    expect(
      await screen.findByRole('heading', { level: 2, name: 'Aguardando' }),
    ).toBeInTheDocument();
  });

  it('edits a project name', async () => {
    const server = seeded();
    const { router } = renderAt('/projects/p-1/edit');
    const name = await screen.findByLabelText('Nome');
    expect(name).toHaveValue('Reforma da sala');
    await userEvent.clear(name);
    await userEvent.type(name, 'Reforma da varanda');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/projects/p-1');
    });
    expect(callsTo(server, 'PATCH', '/projects/p-1')[0]?.body).toMatchObject({
      name: 'Reforma da varanda',
    });
  });

  it('shows the required name error inside the form', async () => {
    const server = stubServer();
    const { container } = renderAt('/projects/new');
    await userEvent.click(await screen.findByRole('button', { name: 'Salvar' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Campo obrigatório');
    expect(container.querySelector('form')).toContainElement(alert);
    expect(callsTo(server, 'POST', '/projects')).toHaveLength(0);
    expect(await axe(container)).toHaveNoViolations();
  });
});
