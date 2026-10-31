import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../shared/test/render';
import { callsTo, cardOf, defaultLanes, json, problem, projectOf, stubServer } from './test-server';
import { useCardTask, useCardTasks, useSetCardTask } from './use-card-task-link';

afterEach(() => {
  vi.unstubAllGlobals();
});

const LINK = {
  id: 'link-1',
  source_type: 'project_card',
  source_id: 'c-1',
  target_type: 'task',
  target_id: 't-1',
};

function seeded(overrides: Parameters<typeof stubServer>[0] = {}) {
  return stubServer({
    projects: [projectOf()],
    lanes: defaultLanes(),
    cards: [cardOf({ id: 'c-1', title: 'Escolher sofá' }), cardOf({ id: 'c-2', title: 'Medir' })],
    tasks: [
      { id: 't-1', title: 'Pedir orçamento', completed_at: null },
      { id: 't-2', title: 'Chamar o eletricista', completed_at: null },
    ],
    ...overrides,
  });
}

function Probe({ card_id }: { card_id: string }) {
  const single = useCardTask(card_id);
  const many = useCardTasks(['c-1', 'c-2']);
  const set = useSetCardTask();
  return (
    <div>
      <p aria-label="tarefa">
        {single.data ? single.data.title : single.isSuccess ? 'nenhuma' : '…'}
      </p>
      <p aria-label="muitas">{[...many.keys()].join(',')}</p>
      <button
        type="button"
        onClick={() => {
          set.mutate({ card_id, task_id: 't-2' });
        }}
      >
        ligar t-2
      </button>
      <button
        type="button"
        onClick={() => {
          set.mutate({ card_id, task_id: 't-1' });
        }}
      >
        ligar t-1
      </button>
      <button
        type="button"
        onClick={() => {
          set.mutate({ card_id, task_id: null });
        }}
      >
        desligar
      </button>
    </div>
  );
}

describe('card task link', () => {
  it('dec003 reads the linked task from links with linked_type task', async () => {
    const server = seeded({ links: [LINK] });
    renderWithProviders(<Probe card_id="c-1" />);
    expect(await screen.findByText('Pedir orçamento')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByLabelText('muitas')).toHaveTextContent('c-1');
    });
    const read = callsTo(server, 'GET', '/links')[0];
    expect(read?.url.searchParams.get('entity_type')).toBe('project_card');
    expect(read?.url.searchParams.get('entity_id')).toBe('c-1');
    expect(read?.url.searchParams.get('linked_type')).toBe('task');
    expect(callsTo(server, 'GET', '/tasks/t-1')).not.toHaveLength(0);
    // O cartão sem ligação não aparece na lista dos cartões com tarefa.
    expect(screen.getByLabelText('muitas')).not.toHaveTextContent('c-2');
  });

  it('dec003 never sends a task id inside the card', async () => {
    const server = seeded();
    renderWithProviders(<Probe card_id="c-1" />);
    await screen.findByText('nenhuma');
    await userEvent.click(screen.getByRole('button', { name: 'ligar t-2' }));
    await waitFor(() => {
      expect(callsTo(server, 'POST', '/links')).toHaveLength(1);
    });
    expect(callsTo(server, 'POST', '/links')[0]?.body).toEqual({
      source_type: 'project_card',
      source_id: 'c-1',
      target_type: 'task',
      target_id: 't-2',
    });
    // A ligação é a única escrita: nenhuma chamada ao cartão.
    expect(server.calls.filter((call) => call.url.pathname.includes('/cards'))).toHaveLength(0);
  });

  it('dec003 replaces the link when the task changes and removes it when cleared', async () => {
    const server = seeded({ links: [LINK] });
    renderWithProviders(<Probe card_id="c-1" />);
    await screen.findByText('Pedir orçamento');
    await userEvent.click(screen.getByRole('button', { name: 'ligar t-2' }));
    await waitFor(() => {
      expect(callsTo(server, 'DELETE', '/links/link-1')).toHaveLength(1);
    });
    await waitFor(() => {
      expect(callsTo(server, 'POST', '/links')).toHaveLength(1);
    });
    expect(await screen.findByText('Chamar o eletricista')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'desligar' }));
    await waitFor(() => {
      expect(screen.getByLabelText('tarefa')).toHaveTextContent('nenhuma');
    });
  });

  it('dec003 keeps the link when the same task is chosen again', async () => {
    const server = seeded({ links: [LINK] });
    renderWithProviders(<Probe card_id="c-1" />);
    await screen.findByText('Pedir orçamento');
    await userEvent.click(screen.getByRole('button', { name: 'ligar t-1' }));
    await waitFor(() => {
      expect(callsTo(server, 'GET', '/links').length).toBeGreaterThan(1);
    });
    expect(callsTo(server, 'DELETE', '/links')).toHaveLength(0);
    expect(callsTo(server, 'POST', '/links')).toHaveLength(0);
  });

  it('dec003 treats a link_already_exists answer as linked', async () => {
    const server = seeded();
    server.reject = (call) =>
      call.method === 'POST' && call.url.pathname === '/api/v1/links'
        ? problem('link_already_exists', 409)
        : undefined;
    renderWithProviders(<Probe card_id="c-1" />);
    await screen.findByText('nenhuma');
    await userEvent.click(screen.getByRole('button', { name: 'ligar t-2' }));
    await waitFor(() => {
      expect(callsTo(server, 'POST', '/links')).toHaveLength(1);
    });
    // O 409 não vira erro: a leitura seguinte é feita e nada é desfeito.
    await waitFor(() => {
      expect(callsTo(server, 'GET', '/links').length).toBeGreaterThan(2);
    });
    expect(callsTo(server, 'DELETE', '/links')).toHaveLength(0);
  });

  it('shows no task for a card whose link points to a task that cannot be read', async () => {
    const server = seeded({ links: [LINK] });
    server.reject = (call) =>
      call.url.pathname.startsWith('/api/v1/tasks/')
        ? json({ code: 'not_found', title: 'x' }, 404)
        : undefined;
    renderWithProviders(<Probe card_id="c-1" />);
    await waitFor(() => {
      expect(screen.getByLabelText('tarefa')).toHaveTextContent('…');
    });
  });
});
