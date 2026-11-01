import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { rootRoute } from '../../app/router';
import { renderWithProviders } from '../../shared/test/render';
import { clearToasts } from '../../shared/toast/toast-store';
import { createProjectsRoutes } from './routes';
import { callsTo, cardOf, defaultLanes, problem, projectOf, stubServer } from './test-server';

afterEach(() => {
  vi.unstubAllGlobals();
  clearToasts();
});

function seeded(overrides: Parameters<typeof stubServer>[0] = {}) {
  return stubServer({
    projects: [projectOf()],
    lanes: defaultLanes(),
    cards: [
      cardOf({
        id: 'c-1',
        title: 'Escolher sofá',
        description: 'Ver três lojas',
        lane_id: 'l-wait',
        priority: 'low',
        labels: ['sala'],
        checklist: [
          { id: 'i-1', text: 'Medir', done: true, position: 0 },
          { id: 'i-2', text: 'Comparar', done: false, position: 1 },
        ],
      }),
    ],
    tasks: [
      { id: 't-1', title: 'Pedir orçamento', completed_at: null },
      { id: 't-2', title: 'Chamar o eletricista', completed_at: null },
    ],
    ...overrides,
  });
}

const LINK_TO_T1 = {
  id: 'link-1',
  source_type: 'project_card',
  source_id: 'c-1',
  target_type: 'task',
  target_id: 't-1',
};

function renderAt(route: string) {
  return renderWithProviders(null, { routes: createProjectsRoutes(rootRoute), route });
}

async function choose(label: string, option: string) {
  await userEvent.click(await screen.findByLabelText(label));
  await userEvent.click(screen.getByRole('option', { name: option }));
}

describe('card form', () => {
  it('pd46 creates a card with title description lane due date priority labels and checklist', async () => {
    const server = seeded();
    const { router } = renderAt('/projects/p-1/cards/new?lane=l-doing');
    await userEvent.type(await screen.findByLabelText('Título'), 'Comprar luminária');
    await userEvent.type(screen.getByLabelText('Descrição'), 'Algo quente');
    // A raia vem da URL (PD-45).
    expect(screen.getByLabelText('Raia')).toHaveTextContent('Em progresso');
    await userEvent.click(screen.getByRole('button', { name: /Prazo/ }));
    await userEvent.click(document.querySelector<HTMLElement>('[data-day$="-15"]') as HTMLElement);
    await choose('Prioridade', 'Alta');
    await userEvent.type(screen.getByLabelText('Etiquetas'), 'sala{Enter}');
    const novo = screen.getByLabelText('Novo item do checklist');
    await userEvent.type(novo, 'Medir o canto{Enter}');
    await userEvent.type(novo, 'Escolher a cor{Enter}');
    await userEvent.click(screen.getByRole('checkbox', { name: 'Feito: Medir o canto' }));
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => {
      expect(callsTo(server, 'POST', '/projects/p-1/cards')).toHaveLength(1);
    });
    const body = callsTo(server, 'POST', '/projects/p-1/cards')[0]?.body;
    expect(body).toMatchObject({
      lane_id: 'l-doing',
      title: 'Comprar luminária',
      description: 'Algo quente',
      priority: 'high',
      labels: ['sala'],
      checklist: [
        { text: 'Medir o canto', done: true },
        { text: 'Escolher a cor', done: false },
      ],
    });
    expect(body?.due_date).toMatch(/^\d{4}-\d{2}-15$/);
    // Sem tarefa escolhida, nenhuma ligação é criada.
    expect(callsTo(server, 'POST', '/links')).toHaveLength(0);
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/projects/p-1');
    });
    expect(router.state.location.search).toMatchObject({ tab: 'board' });
  });

  it('rf33 saves the checklist in the order and state shown', async () => {
    const server = seeded();
    renderAt('/projects/p-1/cards/c-1');
    await screen.findByLabelText('Título');
    screen.getByRole('button', { name: 'Reordenar o item Comparar, posição 2 de 2' }).focus();
    await userEvent.keyboard('{ArrowUp}');
    await userEvent.click(screen.getByRole('button', { name: 'Remover o item Medir' }));
    await userEvent.type(screen.getByLabelText('Novo item do checklist'), 'Pintar{Enter}');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => {
      expect(callsTo(server, 'PATCH', '/cards/c-1')).toHaveLength(1);
    });
    expect(callsTo(server, 'PATCH', '/cards/c-1')[0]?.body).toMatchObject({
      checklist: [
        { text: 'Comparar', done: false },
        { text: 'Pintar', done: false },
      ],
    });
  });

  it('rf33 refuses a checklist item longer than 300 characters inside the form', async () => {
    const server = seeded();
    renderAt('/projects/p-1/cards/new');
    await userEvent.type(await screen.findByLabelText('Título'), 'Cartão');
    const novo = screen.getByLabelText('Novo item do checklist');
    await userEvent.click(novo);
    await userEvent.paste('x'.repeat(301));
    await userEvent.keyboard('{Enter}');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Cada item do checklist tem até 300 caracteres.',
    );
    expect(callsTo(server, 'POST', '/projects/p-1/cards')).toHaveLength(0);
  });

  it('pd46 edits a card with PATCH and moves it with the move route when the lane changes', async () => {
    const server = seeded();
    renderAt('/projects/p-1/cards/c-1');
    const title = await screen.findByLabelText('Título');
    expect(title).toHaveValue('Escolher sofá');
    expect(screen.getByLabelText('Item 1 do checklist')).toHaveValue('Medir');
    expect(screen.getByLabelText('Item 2 do checklist')).toHaveValue('Comparar');
    expect(screen.getByRole('checkbox', { name: 'Feito: Medir' })).toBeChecked();
    expect(screen.getByLabelText('Raia')).toHaveTextContent('Aguardando');
    await userEvent.clear(title);
    await userEvent.type(title, 'Escolher o sofá');
    await choose('Raia', 'Pronto');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => {
      expect(callsTo(server, 'POST', '/cards/c-1/move')).toHaveLength(1);
    });
    expect(callsTo(server, 'PATCH', '/cards/c-1')[0]?.body).toMatchObject({
      title: 'Escolher o sofá',
      priority: 'low',
      labels: ['sala'],
    });
    // O PATCH não carrega a raia; quem move é a rota `move`.
    expect(callsTo(server, 'PATCH', '/cards/c-1')[0]?.body).not.toHaveProperty('lane_id');
    expect(callsTo(server, 'POST', '/cards/c-1/move')[0]?.body).toEqual({ lane_id: 'l-done' });
  });

  it('pd46 links the chosen task after saving', async () => {
    const server = seeded();
    renderAt('/projects/p-1/cards/new');
    await userEvent.type(await screen.findByLabelText('Título'), 'Instalar luz');
    await choose('Ligar a uma tarefa', 'Chamar o eletricista');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => {
      expect(callsTo(server, 'POST', '/links')).toHaveLength(1);
    });
    const link = callsTo(server, 'POST', '/links')[0]?.body;
    expect(link).toMatchObject({
      source_type: 'project_card',
      target_type: 'task',
      target_id: 't-2',
    });
    // A tarefa vai pela ligação, nunca dentro do cartão (DEC-003).
    expect(callsTo(server, 'POST', '/projects/p-1/cards')[0]?.body).not.toHaveProperty('task_id');
    expect(link?.source_id).toBe(server.cards.at(-1)?.id);
  });

  it('pd46 replaces and removes the linked task', async () => {
    const server = seeded({ links: [LINK_TO_T1] });
    const first = renderAt('/projects/p-1/cards/c-1');
    expect(await screen.findByLabelText('Ligar a uma tarefa')).toHaveTextContent('Pedir orçamento');
    await choose('Ligar a uma tarefa', 'Chamar o eletricista');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => {
      expect(callsTo(server, 'POST', '/links')).toHaveLength(1);
    });
    expect(callsTo(server, 'DELETE', '/links/link-1')).toHaveLength(1);
    expect(callsTo(server, 'POST', '/links')[0]?.body).toMatchObject({ target_id: 't-2' });
    first.unmount();
    vi.unstubAllGlobals();

    const other = seeded({ links: [LINK_TO_T1] });
    renderAt('/projects/p-1/cards/c-1');
    await screen.findByLabelText('Título');
    await choose('Ligar a uma tarefa', 'Nenhuma tarefa');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => {
      expect(callsTo(other, 'DELETE', '/links/link-1')).toHaveLength(1);
    });
    expect(callsTo(other, 'POST', '/links')).toHaveLength(0);
  });

  it('pd46 keeps a completed linked task selectable', async () => {
    seeded({
      links: [LINK_TO_T1],
      tasks: [{ id: 't-1', title: 'Pedir orçamento', completed_at: '2026-02-01T10:00:00Z' }],
    });
    renderAt('/projects/p-1/cards/c-1');
    expect(await screen.findByLabelText('Ligar a uma tarefa')).toHaveTextContent('Pedir orçamento');
  });

  it('pd46 deletes the card from Mais ações after confirmation', async () => {
    const server = seeded();
    const { router } = renderAt('/projects/p-1/cards/c-1');
    await screen.findByLabelText('Título');
    // "Excluir cartão" só existe em Mais ações.
    expect(screen.queryByRole('button', { name: 'Excluir cartão' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Mais ações' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Excluir cartão' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(callsTo(server, 'DELETE', '/cards/c-1')).toHaveLength(0);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Excluir cartão' }));
    await waitFor(() => {
      expect(callsTo(server, 'DELETE', '/cards/c-1')).toHaveLength(1);
    });
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/projects/p-1');
    });
  });

  it('does not offer Mais ações when creating a card', async () => {
    seeded();
    renderAt('/projects/p-1/cards/new');
    await screen.findByLabelText('Título');
    expect(screen.queryByRole('button', { name: 'Mais ações' })).not.toBeInTheDocument();
  });

  it('pd11 turns labels into pills', async () => {
    seeded();
    renderAt('/projects/p-1/cards/new');
    await userEvent.type(await screen.findByLabelText('Etiquetas'), 'sala{Enter}obra{Enter}');
    const pills = screen.getByRole('list', { name: 'Etiquetas adicionadas' });
    expect(
      within(pills)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual([expect.stringContaining('sala'), expect.stringContaining('obra')]);
    expect(within(pills).getByRole('button', { name: 'Remover sala' })).toBeInTheDocument();
  });

  it('shows the server errors inside the form with role alert', async () => {
    const server = seeded();
    server.reject = (call) =>
      call.method === 'POST' && call.url.pathname.endsWith('/cards')
        ? problem('validation_failed', 422)
        : undefined;
    const { container } = renderAt('/projects/p-1/cards/new');
    await userEvent.type(await screen.findByLabelText('Título'), 'Instalar luz');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Alguns dados não são válidos');
    expect(container.querySelector('form')).toContainElement(alert);
  });

  it('shows the required title error inside the form', async () => {
    const server = seeded();
    renderAt('/projects/p-1/cards/new');
    await userEvent.click(await screen.findByRole('button', { name: 'Salvar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Campo obrigatório');
    expect(callsTo(server, 'POST', '/projects/p-1/cards')).toHaveLength(0);
  });

  it('has no axe violations', async () => {
    seeded({ links: [LINK_TO_T1] });
    const { container } = renderAt('/projects/p-1/cards/c-1');
    await screen.findByLabelText('Título');
    expect(await axe(container)).toHaveNoViolations();
  });
});
