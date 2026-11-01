import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { translate } from '../../shared/i18n/i18n';
import { renderWithProviders } from '../../shared/test/render';
import { clearToasts, getToasts } from '../../shared/toast/toast-store';
import {
  callsTo,
  cardOf,
  defaultLanes,
  laneOf,
  problem,
  projectOf,
  stubServer,
} from './test-server';
import {
  appendChecklistItem,
  laneLabel,
  moveChecklistItem,
  removeChecklistItem,
  toChecklistDrafts,
  toChecklistInput,
  keyboardCardTarget,
  moveCardInList,
  resolveCardDrop,
  reorderLanesInList,
  useCards,
  useLanes,
  useMoveCard,
  useReorderLanes,
  useUpdateLane,
} from './use-kanban';
import { useProject } from './use-projects';

afterEach(() => {
  vi.unstubAllGlobals();
  clearToasts();
});

function seeded() {
  return stubServer({
    projects: [projectOf()],
    lanes: defaultLanes(),
    cards: [
      cardOf({ id: 'c-1', title: 'Escolher sofá', lane_id: 'l-wait', position: 0 }),
      cardOf({ id: 'c-2', title: 'Medir parede', lane_id: 'l-done', position: 0 }),
    ],
  });
}

function Board() {
  const cards = useCards('p-1');
  const lanes = useLanes('p-1');
  const project = useProject('p-1');
  const move = useMoveCard('p-1');
  const reorder = useReorderLanes('p-1');
  const update = useUpdateLane('p-1');
  return (
    <div>
      <ul aria-label="cartões">
        {(cards.data ?? []).map((card) => (
          <li key={card.id}>{`${card.title} em ${card.lane_id}`}</li>
        ))}
      </ul>
      <p aria-label="raias">{(lanes.data ?? []).map((lane) => lane.id).join(',')}</p>
      <p aria-label="progresso">
        {project.data
          ? `${String(project.data.progress.done_cards)}/${String(project.data.progress.total_cards)}`
          : ''}
      </p>
      <button
        type="button"
        onClick={() => {
          move.mutate({ card_id: 'c-1', lane_id: 'l-doing' });
        }}
      >
        mover
      </button>
      <button
        type="button"
        onClick={() => {
          reorder.mutate({ lane_ids: ['l-done', 'l-wait', 'l-doing'] });
        }}
      >
        reordenar
      </button>
      <button
        type="button"
        onClick={() => {
          update.mutate({ lane_id: 'l-wait', patch: { counts_as_done: true } });
        }}
      >
        concluir raia
      </button>
    </div>
  );
}

describe('kanban interface', () => {
  it('moves the card before the server answers', async () => {
    const server = seeded();
    server.reject = (call) => (call.url.pathname.endsWith('/move') ? 'hang' : undefined);
    renderWithProviders(<Board />);
    expect(await screen.findByText('Escolher sofá em l-wait')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'mover' }));
    // O servidor ainda não respondeu: a tela já mostra o cartão na nova raia.
    expect(await screen.findByText('Escolher sofá em l-doing')).toBeInTheDocument();
    expect(callsTo(server, 'POST', '/cards/c-1/move')).toHaveLength(1);
  });

  it('rolls back and shows the undo notice when the server rejects', async () => {
    const server = seeded();
    server.reject = (call) =>
      call.url.pathname.endsWith('/move') ? problem('invalid_target_lane', 422) : undefined;
    renderWithProviders(<Board />);
    await screen.findByText('Escolher sofá em l-wait');
    await userEvent.click(screen.getByRole('button', { name: 'mover' }));
    await waitFor(() => {
      expect(getToasts()).toHaveLength(1);
    });
    expect(getToasts()[0]).toMatchObject({ tone: 'danger', message_key: 'common.errors.generic' });
    expect(translate('common.errors.generic')).toContain('desfeita');
    expect(await screen.findByText('Escolher sofá em l-wait')).toBeInTheDocument();
    expect(screen.queryByText('Escolher sofá em l-doing')).not.toBeInTheDocument();
  });

  it('reorders the lanes at once and rolls back with the notice when the server rejects', async () => {
    const server = seeded();
    server.reject = (call) => (call.url.pathname.endsWith('/lanes/order') ? 'hang' : undefined);
    const first = renderWithProviders(<Board />);
    await waitFor(() => {
      expect(screen.getByLabelText('raias')).toHaveTextContent('l-wait,l-doing,l-done');
    });
    await userEvent.click(screen.getByRole('button', { name: 'reordenar' }));
    await waitFor(() => {
      expect(screen.getByLabelText('raias')).toHaveTextContent('l-done,l-wait,l-doing');
    });
    expect(callsTo(server, 'PUT', '/lanes/order')[0]?.body).toEqual({
      lane_ids: ['l-done', 'l-wait', 'l-doing'],
    });
    first.unmount();
    vi.unstubAllGlobals();

    const other = seeded();
    other.reject = (call) =>
      call.url.pathname.endsWith('/lanes/order') ? problem('validation_failed', 422) : undefined;
    renderWithProviders(<Board />);
    await waitFor(() => {
      expect(screen.getByLabelText('raias')).toHaveTextContent('l-wait,l-doing,l-done');
    });
    await userEvent.click(screen.getByRole('button', { name: 'reordenar' }));
    await waitFor(() => {
      expect(getToasts()).toHaveLength(1);
    });
    expect(getToasts()[0]?.message_key).toBe('common.errors.validation_failed');
    await waitFor(() => {
      expect(screen.getByLabelText('raias')).toHaveTextContent('l-wait,l-doing,l-done');
    });
  });

  it('pd43 recomputes the progress when a lane counts as done', async () => {
    const server = seeded();
    renderWithProviders(<Board />);
    await waitFor(() => {
      expect(screen.getByLabelText('progresso')).toHaveTextContent('1/2');
    });
    await userEvent.click(screen.getByRole('button', { name: 'concluir raia' }));
    await waitFor(() => {
      expect(screen.getByLabelText('progresso')).toHaveTextContent('2/2');
    });
    expect(callsTo(server, 'PATCH', '/lanes/l-wait')[0]?.body).toEqual({ counts_as_done: true });
  });
});

describe('kanban helpers', () => {
  it('moveCardInList reindexes the source and the target lanes', () => {
    const cards = [
      cardOf({ id: 'a', title: 'A', lane_id: 'x', position: 0 }),
      cardOf({ id: 'b', title: 'B', lane_id: 'x', position: 1 }),
      cardOf({ id: 'c', title: 'C', lane_id: 'y', position: 0 }),
    ];
    const moved = moveCardInList(cards, 'a', 'y', 0);
    const where = (id: string) => moved.find((card) => card.id === id);
    expect(where('a')).toMatchObject({ lane_id: 'y', position: 0 });
    expect(where('c')).toMatchObject({ lane_id: 'y', position: 1 });
    expect(where('b')).toMatchObject({ lane_id: 'x', position: 0 });
    // Sem posição, o cartão vai para o fim; dentro da mesma raia, só reordena.
    expect(moveCardInList(cards, 'a', 'x')[0]).toMatchObject({ id: 'a', position: 1 });
    expect(moveCardInList(cards, 'zzz', 'x')).toHaveLength(3);
  });

  it('reorderLanesInList renumbers the positions', () => {
    const lanes = defaultLanes();
    expect(
      reorderLanesInList(lanes, ['l-done', 'l-wait', 'l-doing']).map((lane) => [
        lane.id,
        lane.position,
      ]),
    ).toEqual([
      ['l-done', 0],
      ['l-wait', 1],
      ['l-doing', 2],
    ]);
  });

  it('laneLabel prefers the user name and falls back to the system key translation', () => {
    const t = (key: string) => translate(key);
    expect(laneLabel(laneOf({ id: 'a', name: 'Revisão' }), t)).toBe('Revisão');
    expect(laneLabel(laneOf({ id: 'b', name: null, system_key: 'in_progress' }), t)).toBe(
      'Em progresso',
    );
    expect(laneLabel(laneOf({ id: 'c', name: 'Na fila', system_key: 'waiting' }), t)).toBe(
      'Na fila',
    );
  });
});

describe('checklist drafts', () => {
  const list = [
    { key: 'a', text: 'A', done: false },
    { key: 'b', text: 'B', done: true },
    { key: 'c', text: 'C', done: false },
  ];

  it('rf33 builds drafts from the card items in position order', () => {
    expect(
      toChecklistDrafts([
        { id: 'i-2', text: 'Segundo', done: true, position: 1 },
        { id: 'i-1', text: 'Primeiro', done: false, position: 0 },
      ]),
    ).toEqual([
      { key: 'i-1', text: 'Primeiro', done: false },
      { key: 'i-2', text: 'Segundo', done: true },
    ]);
  });

  it('rf33 appends a trimmed item at the end', () => {
    const next = appendChecklistItem(list, '  Lixar  ');
    expect(next).toHaveLength(4);
    expect(next[3]).toMatchObject({ text: 'Lixar', done: false });
    expect(list.map((item) => item.key)).not.toContain(next[3]?.key);
  });

  it('cb12 ignores an item made only of spaces', () => {
    expect(appendChecklistItem(list, '   ')).toEqual(list);
  });

  it('rf33 moves an item and clamps the target', () => {
    expect(moveChecklistItem(list, 0, 2).map((item) => item.key)).toEqual(['b', 'c', 'a']);
    expect(moveChecklistItem(list, 0, -1).map((item) => item.key)).toEqual(['a', 'b', 'c']);
    expect(moveChecklistItem(list, 2, 9).map((item) => item.key)).toEqual(['a', 'b', 'c']);
  });

  it('rf33 removes an item by key', () => {
    expect(removeChecklistItem(list, 'b').map((item) => item.key)).toEqual(['a', 'c']);
  });

  it('rf33 sends only filled items in order', () => {
    expect(
      toChecklistInput([
        { key: 'a', text: '  A  ', done: true },
        { key: 'b', text: '   ', done: false },
        { key: 'c', text: 'C', done: false },
      ]),
    ).toEqual([
      { text: 'A', done: true },
      { text: 'C', done: false },
    ]);
  });
});

describe('card drop targets', () => {
  const lanes = [
    laneOf({ id: 'l-wait', position: 0 }),
    laneOf({ id: 'l-doing', position: 1 }),
    laneOf({ id: 'l-done', position: 2 }),
  ];
  const cards = [
    cardOf({ id: 'c-1', title: 'Cartão 1', lane_id: 'l-wait', position: 0 }),
    cardOf({ id: 'c-2', title: 'Cartão 2', lane_id: 'l-wait', position: 1 }),
    cardOf({ id: 'c-3', title: 'Cartão 3', lane_id: 'l-doing', position: 0 }),
  ];

  it('rf34 drops over a card of another lane before that card', () => {
    expect(resolveCardDrop(cards, 'c-1', { type: 'card', card_id: 'c-3' })).toEqual({
      lane_id: 'l-doing',
      position: 0,
    });
  });

  it('rf34 drops over a lane at its end', () => {
    expect(resolveCardDrop(cards, 'c-1', { type: 'lane', lane_id: 'l-done' })).toEqual({
      lane_id: 'l-done',
      position: 0,
    });
    expect(resolveCardDrop(cards, 'c-1', { type: 'lane', lane_id: 'l-doing' })).toEqual({
      lane_id: 'l-doing',
      position: 1,
    });
  });

  it('cb13 drops in the same lane changing only the position', () => {
    expect(resolveCardDrop(cards, 'c-1', { type: 'card', card_id: 'c-2' })).toEqual({
      lane_id: 'l-wait',
      position: 1,
    });
  });

  it('rf34 ignores a drop on the same place', () => {
    expect(resolveCardDrop(cards, 'c-1', { type: 'card', card_id: 'c-1' })).toBeNull();
    expect(resolveCardDrop(cards, 'c-1', null)).toBeNull();
    expect(resolveCardDrop(cards, 'c-2', { type: 'lane', lane_id: 'l-wait' })).toBeNull();
  });

  it('rf34 moves with the arrow keys', () => {
    expect(keyboardCardTarget(lanes, cards, 'c-1', 'ArrowRight')).toEqual({
      lane_id: 'l-doing',
      position: 1,
    });
    expect(keyboardCardTarget(lanes, cards, 'c-1', 'ArrowLeft')).toBeNull();
    expect(keyboardCardTarget(lanes, cards, 'c-1', 'ArrowDown')).toEqual({
      lane_id: 'l-wait',
      position: 1,
    });
    expect(keyboardCardTarget(lanes, cards, 'c-1', 'ArrowUp')).toBeNull();
  });
});
