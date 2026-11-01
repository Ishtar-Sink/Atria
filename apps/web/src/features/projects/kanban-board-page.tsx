import { ErrorState, LoadingState } from '@atria/ui';
import {
  closestCorners,
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type Active,
  type Over,
} from '@dnd-kit/core';
import { useEffect, useRef, useState } from 'react';
import { useT } from '../../shared/i18n/i18n';
import { KanbanLane } from './kanban-lane';
import styles from './projects.module.css';
import { useCardTasks } from './use-card-task-link';
import {
  cardsOfLane,
  keyboardCardTarget,
  laneLabel,
  resolveCardDrop,
  useCards,
  useLanes,
  useMoveCard,
  type CardDropOver,
} from './use-kanban';
import type { Card, Project } from './use-projects';

/** Aba Quadro: as raias e os cartões, sem gerenciar raia aqui (RF-55, PD-47). */
/** Comandos de teclado mostrados no fim do quadro: as teclas e a ação. */
const KEY_HINTS = [
  { keys: ['←', '→'], action: 'projects.board.keys.lanes' },
  { keys: ['↑', '↓'], action: 'projects.board.keys.order' },
  { keys: ['Enter'], action: 'projects.board.keys.open' },
] as const;

export function KanbanBoardPage({ project }: { project: Project }) {
  const t = useT();
  const lanes = useLanes(project.id);
  const cards = useCards(project.id);
  const move = useMoveCard(project.id);
  const [active_id, setActiveId] = useState<string>();
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
  );
  const [announcement, setAnnouncement] = useState('');
  const focus_card = useRef<string>(undefined);
  const card_list = cards.data ?? [];
  const tasks = useCardTasks(card_list.map((card) => card.id));

  // Depois de mover pelo seletor, o foco acompanha o cartão para a nova raia.
  useEffect(() => {
    if (focus_card.current === undefined) return;
    document.getElementById(`move-${focus_card.current}`)?.focus();
    focus_card.current = undefined;
  }, [cards.data]);

  if (lanes.isPending || cards.isPending) {
    return <LoadingState label={t('projects.board.loading')} />;
  }
  if (lanes.isError || cards.isError) {
    return (
      <ErrorState
        title={t('projects.board.error_title')}
        description={t('projects.board.error')}
        retryLabel={t('projects.list.retry')}
        onRetry={() => {
          void lanes.refetch();
          void cards.refetch();
        }}
      />
    );
  }

  function moveTo(card: Card, lane_id: string, position: number, keep_focus = false) {
    const target = lanes.data?.find((lane) => lane.id === lane_id);
    if (!target) return;
    if (keep_focus) focus_card.current = card.id;
    move.mutate({ card_id: card.id, lane_id, position });
    setAnnouncement(t('projects.board.moved', { card: card.title, lane: laneLabel(target, t) }));
  }

  function overOf(over: Over | null): CardDropOver | null {
    const data = over?.data.current as CardDropOver | undefined;
    return data?.type === 'card' || data?.type === 'lane' ? data : null;
  }

  function titleOf(active: Active) {
    return card_list.find((card) => card.id === String(active.id))?.title ?? '';
  }

  function laneNameOf(over: Over | null) {
    const data = overOf(over);
    if (!data) return '';
    const lane_id =
      data.type === 'lane'
        ? data.lane_id
        : card_list.find((card) => card.id === data.card_id)?.lane_id;
    const lane = lanes.data?.find((item) => item.id === lane_id);
    return lane ? laneLabel(lane, t) : '';
  }

  const announcements: Announcements = {
    onDragStart: ({ active }) => t('projects.board.drag_start', { card: titleOf(active) }),
    onDragOver: ({ active, over }) =>
      over
        ? t('projects.board.drag_over', { card: titleOf(active), lane: laneNameOf(over) })
        : undefined,
    onDragEnd: () => undefined,
    onDragCancel: ({ active }) => t('projects.board.drag_cancel', { card: titleOf(active) }),
  };

  function onDragEnd({ active, over }: DragEndEvent) {
    setActiveId(undefined);
    const card = card_list.find((item) => item.id === String(active.id));
    const target = card ? resolveCardDrop(card_list, card.id, overOf(over)) : null;
    if (card && target) moveTo(card, target.lane_id, target.position);
  }

  function onKeyMove(card: Card, key: string): boolean {
    const target = keyboardCardTarget(lanes.data ?? [], card_list, card.id, key);
    if (!target) return false;
    moveTo(card, target.lane_id, target.position, true);
    return true;
  }

  const active_card = card_list.find((card) => card.id === active_id);

  return (
    <div>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        accessibility={{
          screenReaderInstructions: { draggable: t('projects.board.drag_instructions') },
          announcements,
        }}
        onDragStart={({ active }) => {
          setActiveId(String(active.id));
        }}
        onDragEnd={onDragEnd}
        onDragCancel={() => {
          setActiveId(undefined);
        }}
      >
        <ul className={styles.kanban} aria-label={t('projects.board.label')}>
          {lanes.data.map((lane) => (
            <KanbanLane
              key={lane.id}
              project_id={project.id}
              lane={lane}
              cards={cardsOfLane(card_list, lane.id)}
              tasks={tasks}
              onKeyMove={onKeyMove}
            />
          ))}
        </ul>
        <DragOverlay dropAnimation={null}>
          {active_card ? (
            <div className={[styles.kcard, styles.kcardOverlay].join(' ')}>{active_card.title}</div>
          ) : null}
        </DragOverlay>
      </DndContext>
      {/* O leitor de tela já recebe as instruções do dnd-kit; a dica é para quem vê. */}
      <ul className={styles.boardHint} aria-hidden="true">
        {KEY_HINTS.map(({ keys, action }) => (
          <li key={action}>
            {keys.map((key) => (
              <kbd key={key}>{key}</kbd>
            ))}
            <span>{t(action)}</span>
          </li>
        ))}
      </ul>
      <p role="status" aria-live="polite" className={styles.srOnly}>
        {announcement}
      </p>
    </div>
  );
}
