import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { rootRoute } from '../../app/router';
import { renderWithProviders } from '../../shared/test/render';
import { clearToasts } from '../../shared/toast/toast-store';
import { createProjectsRoutes } from './routes';
import { callsTo, cardOf, defaultLanes, projectOf, stubServer } from './test-server';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  clearToasts();
});

function seeded(overrides: Parameters<typeof stubServer>[0] = {}) {
  return stubServer({
    projects: [projectOf()],
    lanes: defaultLanes(),
    cards: [
      cardOf({ id: 'c-1', title: 'Escolher sofá', lane_id: 'l-wait', position: 0 }),
      cardOf({ id: 'c-2', title: 'Medir parede', lane_id: 'l-wait', position: 1 }),
    ],
    ...overrides,
  });
}

function renderSettings() {
  return renderWithProviders(null, {
    routes: createProjectsRoutes(rootRoute),
    route: '/projects/p-1?tab=settings',
  });
}

function handleOf(lane: string, position: number, total = 3): HTMLElement {
  return screen.getByRole('button', {
    name: `Reordenar a raia ${lane}, posição ${String(position)} de ${String(total)}`,
  });
}

/** O jsdom não faz layout: cada linha ocupa 50 px, na ordem em que está no DOM. */
function stubRowGeometry() {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: HTMLElement,
  ) {
    const index = this.parentElement ? Array.from(this.parentElement.children).indexOf(this) : 0;
    return new DOMRect(0, index * 50, 400, 50);
  });
}

describe('project settings: lanes', () => {
  it('pd47 lists the lanes in order with the color handle', async () => {
    seeded();
    renderSettings();
    expect(await screen.findByRole('heading', { name: 'Raias' })).toBeInTheDocument();
    const rows = screen.getAllByRole('listitem').filter((item) => item.querySelector('button'));
    expect(
      rows.map((row) => within(row).getByText(/^(Aguardando|Em progresso|Pronto)/).textContent),
    ).toEqual([
      expect.stringContaining('Aguardando'),
      expect.stringContaining('Em progresso'),
      expect.stringContaining('Pronto'),
    ]);
    const handle = handleOf('Aguardando', 1);
    expect(handle.getAttribute('style')).toContain('#92400e');
    expect(screen.getByText('#92400e')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Nova raia' })).toHaveAttribute(
      'href',
      '/projects/p-1/lanes/new',
    );
  });

  it('pd47 reorders lanes by dragging the handle', async () => {
    const server = seeded();
    renderSettings();
    await screen.findByRole('heading', { name: 'Raias' });
    stubRowGeometry();
    fireEvent.pointerDown(handleOf('Aguardando', 1), { button: 0, clientY: 25 });
    fireEvent.pointerMove(window, { clientY: 130 });
    fireEvent.pointerUp(window);
    await waitFor(() => {
      expect(callsTo(server, 'PUT', '/lanes/order')).toHaveLength(1);
    });
    expect(callsTo(server, 'PUT', '/lanes/order')[0]?.body).toEqual({
      lane_ids: ['l-doing', 'l-done', 'l-wait'],
    });
    expect(
      await screen.findByRole('button', { name: /Reordenar a raia Aguardando, posição 3 de 3/ }),
    ).toBeInTheDocument();
  });

  it('pd47 does not call the server when the lane is dropped where it was', async () => {
    const server = seeded();
    renderSettings();
    await screen.findByRole('heading', { name: 'Raias' });
    stubRowGeometry();
    fireEvent.pointerDown(handleOf('Aguardando', 1), { button: 0, clientY: 25 });
    fireEvent.pointerMove(window, { clientY: 30 });
    fireEvent.pointerUp(window);
    expect(callsTo(server, 'PUT', '/lanes/order')).toHaveLength(0);
  });

  it('pd47 reorders lanes with the arrow keys on the handle', async () => {
    const server = seeded();
    renderSettings();
    await screen.findByRole('heading', { name: 'Raias' });
    handleOf('Em progresso', 2).focus();
    await userEvent.keyboard('{ArrowUp}');
    await waitFor(() => {
      expect(callsTo(server, 'PUT', '/lanes/order')[0]?.body).toEqual({
        lane_ids: ['l-doing', 'l-wait', 'l-done'],
      });
    });
    expect(await screen.findByText('Raia “Em progresso” na posição 1 de 3.')).toBeInTheDocument();
    // O foco segue o puxador para a nova posição.
    await waitFor(() => {
      expect(document.activeElement).toBe(handleOf('Em progresso', 1));
    });
    // Na primeira posição, seta para cima não faz nada.
    await userEvent.keyboard('{ArrowUp}');
    expect(callsTo(server, 'PUT', '/lanes/order')).toHaveLength(1);
  });

  it('pd47 links to rename and change the color of a lane', async () => {
    seeded();
    renderSettings();
    await screen.findByRole('heading', { name: 'Raias' });
    expect(screen.getByRole('link', { name: 'Editar Aguardando' })).toHaveAttribute(
      'href',
      '/projects/p-1/lanes/l-wait/edit',
    );
  });

  it('pd43 toggles counts as done per lane', async () => {
    const server = seeded();
    renderSettings();
    await screen.findByRole('heading', { name: 'Raias' });
    expect(screen.getByRole('checkbox', { name: 'Conta como concluída: Pronto' })).toBeChecked();
    const wait = screen.getByRole('checkbox', { name: 'Conta como concluída: Aguardando' });
    expect(wait).not.toBeChecked();
    await userEvent.click(wait);
    await waitFor(() => {
      expect(callsTo(server, 'PATCH', '/lanes/l-wait')[0]?.body).toEqual({ counts_as_done: true });
    });
    expect(wait).toBeChecked();
  });

  it('pd47 deletes a lane through the confirmation dialog', async () => {
    const server = seeded();
    renderSettings();
    await screen.findByRole('heading', { name: 'Raias' });
    await userEvent.click(screen.getByRole('button', { name: 'Excluir Pronto' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText('A raia está vazia e será excluída.')).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Excluir raia' }));
    await waitFor(() => {
      expect(callsTo(server, 'DELETE', '/lanes/l-done')).toHaveLength(1);
    });
    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });
    expect(
      screen.queryByRole('button', { name: 'Reordenar a raia Pronto, posição 3 de 3' }),
    ).not.toBeInTheDocument();
  });

  it('pd47 disables deleting when only one lane is left and explains why', async () => {
    seeded({ lanes: defaultLanes().slice(0, 1), cards: [] });
    renderSettings();
    await screen.findByRole('heading', { name: 'Raias' });
    expect(screen.getByRole('button', { name: 'Excluir Aguardando' })).toBeDisabled();
    expect(screen.getByText('A última raia não pode ser excluída.')).toBeInTheDocument();
  });

  it('has no axe violations', async () => {
    seeded();
    const { container } = renderSettings();
    await screen.findByRole('heading', { name: 'Raias' });
    expect(await axe(container)).toHaveNoViolations();
  });
});
