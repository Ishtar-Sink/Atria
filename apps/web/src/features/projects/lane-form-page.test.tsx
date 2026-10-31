import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { rootRoute } from '../../app/router';
import { renderWithProviders } from '../../shared/test/render';
import { clearToasts } from '../../shared/toast/toast-store';
import { createProjectsRoutes } from './routes';
import { callsTo, defaultLanes, projectOf, stubServer } from './test-server';

afterEach(() => {
  vi.unstubAllGlobals();
  clearToasts();
});

function seeded() {
  return stubServer({ projects: [projectOf()], lanes: defaultLanes() });
}

function renderAt(route: string) {
  return renderWithProviders(null, { routes: createProjectsRoutes(rootRoute), route });
}

async function pickHex(hex: string) {
  await userEvent.click(screen.getByRole('button', { name: /^Cor/ }));
  const dialog = await screen.findByRole('dialog', { name: 'Escolher cor' });
  const field = within(dialog).getByLabelText('HEX');
  await userEvent.clear(field);
  await userEvent.type(field, hex);
  await userEvent.click(within(dialog).getByRole('button', { name: 'Aplicar' }));
}

describe('lane form', () => {
  it('creates a colored lane that appears in order', async () => {
    const server = seeded();
    const { router } = renderAt('/projects/p-1/lanes/new');
    await userEvent.type(await screen.findByLabelText('Nome'), 'Revisão');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/projects/p-1');
    });
    expect(router.state.location.search).toMatchObject({ tab: 'settings' });
    expect(callsTo(server, 'POST', '/lanes')[0]?.body).toMatchObject({ name: 'Revisão' });
    const handles = await screen.findAllByRole('button', { name: /^Reordenar a raia/ });
    expect(handles.map((handle) => handle.getAttribute('aria-label'))).toEqual([
      'Reordenar a raia Aguardando, posição 1 de 4',
      'Reordenar a raia Em progresso, posição 2 de 4',
      'Reordenar a raia Pronto, posição 3 de 4',
      'Reordenar a raia Revisão, posição 4 de 4',
    ]);
  });

  it('renames a lane', async () => {
    const server = seeded();
    const { router } = renderAt('/projects/p-1/lanes/l-wait/edit');
    const name = await screen.findByLabelText('Nome');
    expect(name).toHaveValue('Aguardando');
    await userEvent.clear(name);
    await userEvent.type(name, 'Na fila');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => {
      expect(callsTo(server, 'PATCH', '/lanes/l-wait')).toHaveLength(1);
    });
    expect(callsTo(server, 'PATCH', '/lanes/l-wait')[0]?.body).toEqual({
      name: 'Na fila',
      color: '#92400e',
      counts_as_done: false,
    });
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/projects/p-1');
    });
  });

  it('pd12 saves the hex color chosen in the color picker', async () => {
    const server = seeded();
    renderAt('/projects/p-1/lanes/new');
    await userEvent.type(await screen.findByLabelText('Nome'), 'Revisão');
    await pickHex('#0EA5E9');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => {
      expect(callsTo(server, 'POST', '/lanes')).toHaveLength(1);
    });
    // O HEX vai em minúsculas, como o servidor devolve.
    expect(callsTo(server, 'POST', '/lanes')[0]?.body.color).toBe('#0ea5e9');
  });

  it('pd12 starts a new lane with a hex color', async () => {
    seeded();
    renderAt('/projects/p-1/lanes/new');
    const trigger = await screen.findByRole('button', { name: /^Cor/ });
    expect(trigger).toHaveTextContent('#6D28D9');
  });

  it('pd43 saves counts as done', async () => {
    const server = seeded();
    renderAt('/projects/p-1/lanes/new');
    await userEvent.type(await screen.findByLabelText('Nome'), 'Entregue');
    await userEvent.click(screen.getByRole('checkbox', { name: 'Conta como concluída' }));
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => {
      expect(callsTo(server, 'POST', '/lanes')[0]?.body).toMatchObject({ counts_as_done: true });
    });
  });

  it('shows the validation error inside the form', async () => {
    const server = seeded();
    const { container } = renderAt('/projects/p-1/lanes/new');
    await userEvent.click(await screen.findByRole('button', { name: 'Salvar' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Campo obrigatório');
    expect(container.querySelector('form')).toContainElement(alert);
    expect(callsTo(server, 'POST', '/lanes')).toHaveLength(0);
    expect(await axe(container)).toHaveNoViolations();
  });
});
