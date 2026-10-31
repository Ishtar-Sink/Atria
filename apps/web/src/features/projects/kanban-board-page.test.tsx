import { createEvent, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { rootRoute } from '../../app/router';
import { renderWithProviders } from '../../shared/test/render';
import { clearToasts } from '../../shared/toast/toast-store';
import { createProjectsRoutes } from './routes';
import { callsTo, cardOf, defaultLanes, laneOf, projectOf, stubServer } from './test-server';

afterEach(() => {
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
      cardOf({ id: 'c-3', title: 'Pintar paredes', lane_id: 'l-doing', position: 0 }),
    ],
    ...overrides,
  });
}

function renderBoard() {
  return renderWithProviders(null, {
    routes: createProjectsRoutes(rootRoute),
    route: '/projects/p-1?tab=board',
  });
}

function laneNamed(name: string): HTMLElement {
  const lane = screen.getByRole('heading', { level: 2, name }).closest('li');
  if (!lane) throw new Error(`raia ${name} não encontrada`);
  return lane;
}

function cardNamed(title: string): HTMLElement {
  const card = screen.getByRole('link', { name: title }).closest('li');
  if (!card) throw new Error(`cartão ${title} não encontrado`);
  return card;
}

describe('kanban board', () => {
  it('shows the default lanes waiting, in progress and done for a new project', async () => {
    seeded({ cards: [] });
    renderBoard();
    await screen.findByRole('heading', { level: 2, name: 'Aguardando' });
    const names = screen
      .getAllByRole('heading', { level: 2 })
      .map((heading) => heading.textContent);
    expect(names).toEqual(['Aguardando', 'Em progresso', 'Pronto']);
  });

  it('translates default lanes by system key', async () => {
    seeded({ cards: [] });
    renderBoard();
    await screen.findByRole('heading', { level: 2, name: 'Em progresso' });
    expect(screen.queryByText('in_progress')).not.toBeInTheDocument();
  });

  it('shows the user name of a renamed default lane', async () => {
    seeded({
      cards: [],
      lanes: defaultLanes().map((lane) =>
        lane.id === 'l-wait' ? { ...lane, name: 'Na fila' } : lane,
      ),
    });
    renderBoard();
    await screen.findByRole('heading', { level: 2, name: 'Na fila' });
    expect(screen.queryByRole('heading', { level: 2, name: 'Aguardando' })).not.toBeInTheDocument();
  });

  it('pd44 tints the lane with its color and shows only name and count', async () => {
    seeded();
    renderBoard();
    await screen.findByRole('heading', { level: 2, name: 'Aguardando' });
    const lane = laneNamed('Aguardando');
    expect(lane.getAttribute('style')).toContain('--lane: #92400e');
    const head = within(lane).getByRole('heading', { level: 2 }).parentElement as HTMLElement;
    expect(within(head).getByLabelText('2 cartões')).toHaveTextContent('2');
    expect(within(head).queryAllByRole('button')).toHaveLength(0);
  });

  it('pd45 opens the card form with the chosen lane from the add card button', async () => {
    seeded();
    const { router } = renderBoard();
    await screen.findByRole('heading', { level: 2, name: 'Em progresso' });
    await userEvent.click(
      within(laneNamed('Em progresso')).getByRole('button', {
        name: 'Adicionar cartão em Em progresso',
      }),
    );
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/projects/p-1/cards/new');
    });
    expect(router.state.location.search).toMatchObject({ lane: 'l-doing' });
  });

  it('pd46 shows priority labels due date checklist progress and the linked task on the card', async () => {
    seeded({
      cards: [
        cardOf({
          id: 'c-1',
          title: 'Escolher sofá',
          description: 'Ver três lojas',
          priority: 'high',
          labels: ['sala'],
          due_date: '2026-03-05',
          checklist: [
            { id: 'i-1', text: 'Medir', done: true, position: 0 },
            { id: 'i-2', text: 'Comparar', done: false, position: 1 },
          ],
        }),
      ],
      tasks: [{ id: 't-1', title: 'Pedir orçamento', completed_at: null }],
      links: [
        {
          id: 'link-1',
          source_type: 'project_card',
          source_id: 'c-1',
          target_type: 'task',
          target_id: 't-1',
        },
      ],
    });
    renderBoard();
    await screen.findByRole('link', { name: 'Escolher sofá' });
    const card = within(cardNamed('Escolher sofá'));
    expect(card.getByText('Ver três lojas')).toBeInTheDocument();
    expect(card.getByText('Prioridade alta')).toBeInTheDocument();
    expect(card.getByText('sala')).toBeInTheDocument();
    expect(card.getByText('05/03/2026')).toBeInTheDocument();
    expect(card.getByText('1/2')).toBeInTheDocument();
    expect(await card.findByText('Pedir orçamento')).toBeInTheDocument();
  });

  it('pd46 moves a card to another lane by drag and drop through the move route', async () => {
    const server = seeded();
    renderBoard();
    await screen.findByRole('link', { name: 'Escolher sofá' });
    const data = { setData: vi.fn(), effectAllowed: '', dropEffect: '' };
    fireEvent.dragStart(cardNamed('Escolher sofá'), { dataTransfer: data });
    fireEvent.dragOver(laneNamed('Em progresso'), { dataTransfer: data });
    // O jsdom não tem `DragEvent`: a coordenada do ponteiro entra à mão.
    const drop = createEvent.drop(laneNamed('Em progresso'), { dataTransfer: data });
    Object.defineProperty(drop, 'clientY', { value: 1000 });
    fireEvent(laneNamed('Em progresso'), drop);
    await waitFor(() => {
      expect(callsTo(server, 'POST', '/cards/c-1/move')).toHaveLength(1);
    });
    // O PATCH do cartão não move: a rota `move` leva a raia e a posição.
    expect(callsTo(server, 'PATCH', '/cards/c-1')).toHaveLength(0);
    expect(callsTo(server, 'POST', '/cards/c-1/move')[0]?.body).toEqual({
      lane_id: 'l-doing',
      position: 1,
    });
    await waitFor(() => {
      expect(
        within(laneNamed('Em progresso')).getByRole('link', { name: 'Escolher sofá' }),
      ).toBeInTheDocument();
    });
  });

  it('pd46 moves a card with the lane selector at the foot by keyboard', async () => {
    const server = seeded();
    renderBoard();
    await screen.findByRole('link', { name: 'Escolher sofá' });
    const select = within(cardNamed('Escolher sofá')).getByRole('button', {
      name: /Mover “Escolher sofá” para/,
    });
    select.focus();
    await userEvent.keyboard('{Enter}{ArrowDown}{ArrowDown}{Enter}');
    await waitFor(() => {
      expect(callsTo(server, 'POST', '/cards/c-1/move')[0]?.body).toEqual({ lane_id: 'l-done' });
    });
    await waitFor(() => {
      expect(
        within(laneNamed('Pronto')).getByRole('link', { name: 'Escolher sofá' }),
      ).toBeInTheDocument();
    });
    // O foco acompanha o cartão para a nova raia.
    await waitFor(() => {
      expect(document.activeElement?.id).toBe('move-c-1');
    });
  });

  it('pd47 has no lane management inside the board', async () => {
    seeded();
    renderBoard();
    await screen.findByRole('heading', { level: 2, name: 'Aguardando' });
    const board = screen.getByRole('list', { name: 'Raias do quadro' });
    expect(within(board).queryByRole('button', { name: /Excluir/ })).not.toBeInTheDocument();
    expect(within(board).queryByRole('button', { name: /Reordenar/ })).not.toBeInTheDocument();
    expect(within(board).queryByRole('link', { name: /Editar/ })).not.toBeInTheDocument();
    expect(within(board).queryByRole('link', { name: 'Nova raia' })).not.toBeInTheDocument();
  });

  it('announces the move to screen readers', async () => {
    seeded();
    renderBoard();
    await screen.findByRole('link', { name: 'Escolher sofá' });
    await userEvent.click(
      within(cardNamed('Escolher sofá')).getByRole('button', {
        name: /Mover “Escolher sofá” para/,
      }),
    );
    await userEvent.click(screen.getByRole('option', { name: 'Em progresso' }));
    const live = await screen.findByText('“Escolher sofá” movido para Em progresso.');
    expect(live).toHaveAttribute('aria-live', 'polite');
  });

  it('shows custom lanes in order with their own color', async () => {
    seeded({
      lanes: [
        ...defaultLanes(),
        laneOf({ id: 'l-new', name: 'Revisão', color: '#0ea5e9', position: 3 }),
      ],
    });
    renderBoard();
    await screen.findByRole('heading', { level: 2, name: 'Revisão' });
    expect(laneNamed('Revisão').getAttribute('style')).toContain('--lane: #0ea5e9');
  });

  it('shows the error state', async () => {
    stubServer({ mode: 'error' });
    renderWithProviders(null, {
      routes: createProjectsRoutes(rootRoute),
      route: '/projects/p-1?tab=board',
    });
    expect(await screen.findByRole('button', { name: 'Tentar de novo' })).toBeInTheDocument();
  });

  it('has no axe violations', async () => {
    seeded();
    const { container } = renderBoard();
    await screen.findByRole('link', { name: 'Escolher sofá' });
    expect(await axe(container)).toHaveNoViolations();
  });
});
