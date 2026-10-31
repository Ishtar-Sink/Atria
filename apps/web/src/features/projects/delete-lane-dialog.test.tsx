import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { rootRoute } from '../../app/router';
import { renderWithProviders } from '../../shared/test/render';
import { clearToasts } from '../../shared/toast/toast-store';
import { createProjectsRoutes } from './routes';
import { callsTo, cardOf, defaultLanes, projectOf, stubServer } from './test-server';

afterEach(() => {
  vi.unstubAllGlobals();
  clearToasts();
});

function renderSettings(server: Parameters<typeof stubServer>[0]) {
  const stub = stubServer({ projects: [projectOf()], lanes: defaultLanes(), ...server });
  const view = renderWithProviders(null, {
    routes: createProjectsRoutes(rootRoute),
    route: '/projects/p-1?tab=settings',
  });
  return { stub, ...view };
}

const withCards = () => [
  cardOf({ id: 'c-1', title: 'Escolher sofá', lane_id: 'l-wait', position: 0 }),
  cardOf({ id: 'c-2', title: 'Medir parede', lane_id: 'l-wait', position: 1 }),
];

describe('delete lane dialog', () => {
  it('asks for the target lane when the lane has cards', async () => {
    const { stub, container } = renderSettings({ cards: withCards() });
    await userEvent.click(await screen.findByRole('button', { name: 'Excluir Aguardando' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText(/A raia tem 2 cartões/)).toBeInTheDocument();

    // Sem escolher a raia de destino, nada é excluído (CB-07).
    await userEvent.click(within(dialog).getByRole('button', { name: 'Excluir raia' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Escolha a raia que recebe os cartões.',
    );
    expect(callsTo(stub, 'DELETE', '/lanes/l-wait')).toHaveLength(0);

    await userEvent.click(within(dialog).getByRole('button', { name: /Mover os cartões para/ }));
    const options = screen.getAllByRole('option').map((option) => option.textContent);
    expect(options).toEqual(['Em progresso', 'Pronto']);
    await userEvent.click(screen.getByRole('option', { name: 'Pronto' }));
    expect(await axe(container)).toHaveNoViolations();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Excluir raia' }));
    await waitFor(() => {
      expect(callsTo(stub, 'DELETE', '/lanes/l-wait')).toHaveLength(1);
    });
    expect(callsTo(stub, 'DELETE', '/lanes/l-wait')[0]?.url.searchParams.get('move_cards_to')).toBe(
      'l-done',
    );
    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });
  });

  it('refuses to delete the last lane', async () => {
    // O botão da tela já fica indisponível com uma raia só; aqui o servidor ainda recusa (CB-08).
    const { stub } = renderSettings({ lanes: defaultLanes().slice(0, 2), cards: [] });
    await userEvent.click(await screen.findByRole('button', { name: 'Excluir Aguardando' }));
    stub.lanes = stub.lanes.filter((lane) => lane.id === 'l-wait');
    const dialog = await screen.findByRole('alertdialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Excluir raia' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'A última raia não pode ser excluída.',
    );
  });

  it('shows only the refusal and no delete button when the lane is the last one', async () => {
    renderSettings({ lanes: defaultLanes().slice(0, 1), cards: [] });
    await screen.findByRole('heading', { name: 'Raias' });
    expect(screen.getByRole('button', { name: 'Excluir Aguardando' })).toBeDisabled();
  });

  it('deletes an empty lane after confirmation', async () => {
    const { stub } = renderSettings({ cards: withCards() });
    await userEvent.click(await screen.findByRole('button', { name: 'Excluir Pronto' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(
      within(dialog).queryByRole('button', { name: /Mover os cartões para/ }),
    ).not.toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Excluir raia' }));
    await waitFor(() => {
      expect(callsTo(stub, 'DELETE', '/lanes/l-done')).toHaveLength(1);
    });
    expect(callsTo(stub, 'DELETE', '/lanes/l-done')[0]?.url.search).toBe('');
  });

  it('closes with Cancelar without deleting', async () => {
    const { stub } = renderSettings({ cards: withCards() });
    await userEvent.click(await screen.findByRole('button', { name: 'Excluir Aguardando' }));
    const dialog = await screen.findByRole('alertdialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });
    expect(callsTo(stub, 'DELETE', '/lanes')).toHaveLength(0);
  });
});
