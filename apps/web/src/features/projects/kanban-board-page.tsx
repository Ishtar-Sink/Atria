import { ErrorState, LoadingState } from '@atria/ui';
import { useEffect, useRef, useState, type DragEvent } from 'react';
import { useT } from '../../shared/i18n/i18n';
import { KanbanLane } from './kanban-lane';
import styles from './projects.module.css';
import { useCardTasks } from './use-card-task-link';
import { cardsOfLane, laneLabel, useCards, useLanes, useMoveCard } from './use-kanban';
import type { Card, Project } from './use-projects';

/** Aba Quadro: as raias e os cartões, sem gerenciar raia aqui (RF-55, PD-47). */
export function KanbanBoardPage({ project }: { project: Project }) {
  const t = useT();
  const lanes = useLanes(project.id);
  const cards = useCards(project.id);
  const move = useMoveCard(project.id);
  const [dragging_id, setDraggingId] = useState<string>();
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

  function moveTo(card: Card, lane_id: string, position?: number, keep_focus = false) {
    const target = lanes.data?.find((lane) => lane.id === lane_id);
    if (!target || (card.lane_id === lane_id && position === undefined)) return;
    if (keep_focus) focus_card.current = card.id;
    move.mutate({ card_id: card.id, lane_id, ...(position === undefined ? {} : { position }) });
    setAnnouncement(t('projects.board.moved', { card: card.title, lane: laneLabel(target, t) }));
  }

  function onDragStart(card: Card, event: DragEvent<HTMLLIElement>) {
    event.dataTransfer.setData('text/plain', card.id);
    event.dataTransfer.effectAllowed = 'move';
    setDraggingId(card.id);
  }

  return (
    <div>
      <ul className={styles.kanban} aria-label={t('projects.board.label')}>
        {lanes.data.map((lane) => (
          <KanbanLane
            key={lane.id}
            project_id={project.id}
            lane={lane}
            lanes={lanes.data}
            cards={cardsOfLane(card_list, lane.id)}
            tasks={tasks}
            dragging_id={dragging_id}
            onMove={(card, lane_id) => {
              moveTo(card, lane_id, undefined, true);
            }}
            onDrop={(lane_id, position) => {
              const card = card_list.find((item) => item.id === dragging_id);
              setDraggingId(undefined);
              if (card) moveTo(card, lane_id, position);
            }}
            onDragStart={onDragStart}
            onDragEnd={() => {
              setDraggingId(undefined);
            }}
          />
        ))}
      </ul>
      <p role="status" aria-live="polite" className={styles.srOnly}>
        {announcement}
      </p>
    </div>
  );
}
