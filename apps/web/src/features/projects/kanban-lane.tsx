import { Button } from '@atria/ui';
import { useNavigate } from '@tanstack/react-router';
import { useState, type CSSProperties, type DragEvent } from 'react';
import { useT } from '../../shared/i18n/i18n';
import { PlusIcon } from './icons';
import { KanbanCard } from './kanban-card';
import styles from './projects.module.css';
import type { CardTask } from './use-card-task-link';
import { laneLabel } from './use-kanban';
import type { Card, Lane } from './use-projects';

export interface KanbanLaneProps {
  project_id: string;
  lane: Lane;
  lanes: readonly Lane[];
  cards: readonly Card[];
  tasks: ReadonlyMap<string, CardTask>;
  dragging_id: string | undefined;
  onMove: (card: Card, lane_id: string) => void;
  onDrop: (lane_id: string, position: number) => void;
  onDragStart: (card: Card, event: DragEvent<HTMLLIElement>) => void;
  onDragEnd: () => void;
}

/** Posição de soltura: quantos cartões da raia ficam acima do ponteiro. */
function dropPosition(lane: HTMLElement, y: number, dragging_id: string | undefined): number {
  const items = Array.from(lane.querySelectorAll<HTMLElement>('[data-card-id]')).filter(
    (item) => item.dataset.cardId !== dragging_id,
  );
  return items.filter((item) => {
    const box = item.getBoundingClientRect();
    return box.top + box.height / 2 < y;
  }).length;
}

/** Raia tingida na cor dela, com nome e contagem no cabeçalho (PD-44) e o "+ Adicionar cartão" no pé (PD-45). */
export function KanbanLane({
  project_id,
  lane,
  lanes,
  cards,
  tasks,
  dragging_id,
  onMove,
  onDrop,
  onDragStart,
  onDragEnd,
}: KanbanLaneProps) {
  const t = useT();
  const navigate = useNavigate();
  const [over, setOver] = useState(false);
  const name = laneLabel(lane, t);
  const classes = [styles.lane, over ? styles.laneDrop : ''].filter(Boolean).join(' ');

  return (
    <li
      className={classes}
      style={{ '--lane': lane.color } as CSSProperties}
      data-lane-id={lane.id}
      onDragOver={(event) => {
        if (dragging_id === undefined) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        setOver(true);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOver(false);
      }}
      onDrop={(event) => {
        if (dragging_id === undefined) return;
        event.preventDefault();
        setOver(false);
        onDrop(lane.id, dropPosition(event.currentTarget, event.clientY, dragging_id));
      }}
    >
      <div className={styles.laneHead}>
        <h2 className={styles.laneName}>{name}</h2>
        <span
          className={styles.laneCount}
          aria-label={t('projects.board.count', { count: cards.length })}
        >
          {cards.length}
        </span>
      </div>
      <ul className={styles.cards}>
        {cards.map((card) => (
          <KanbanCard
            key={card.id}
            project_id={project_id}
            card={card}
            lanes={lanes}
            task={tasks.get(card.id)}
            dragging={dragging_id === card.id}
            onMove={onMove}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
          />
        ))}
      </ul>
      <Button
        variant="muted"
        tint={lane.color}
        className={styles.laneAdd}
        onClick={() => {
          void navigate({
            to: `/projects/${project_id}/cards/new`,
            search: { lane: lane.id },
          });
        }}
      >
        <PlusIcon />
        {t('projects.board.add_card')}{' '}
        <span className={styles.srOnly}>{t('projects.board.add_card_in', { lane: name })}</span>
      </Button>
    </li>
  );
}
