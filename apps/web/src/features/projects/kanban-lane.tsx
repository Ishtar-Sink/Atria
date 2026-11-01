import { useDndContext, useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Button } from '@atria/ui';
import { useNavigate } from '@tanstack/react-router';
import type { CSSProperties } from 'react';
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
  cards: readonly Card[];
  tasks: ReadonlyMap<string, CardTask>;
  onKeyMove: (card: Card, key: string) => boolean;
}

/** Raia tingida na cor dela, com nome e contagem no cabeçalho (PD-44) e o "+ Adicionar cartão" no pé (PD-45). */
export function KanbanLane({ project_id, lane, cards, tasks, onKeyMove }: KanbanLaneProps) {
  const t = useT();
  const navigate = useNavigate();
  const { setNodeRef, isOver } = useDroppable({
    id: `lane:${lane.id}`,
    data: { type: 'lane', lane_id: lane.id },
  });
  const { over } = useDndContext();
  const over_here =
    isOver || (over?.data.current as { lane_id?: string } | undefined)?.lane_id === lane.id;
  const name = laneLabel(lane, t);
  const classes = [styles.lane, over_here ? styles.laneDrop : ''].filter(Boolean).join(' ');

  return (
    <li
      ref={setNodeRef}
      className={classes}
      style={{ '--lane': lane.color } as CSSProperties}
      data-lane-id={lane.id}
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
      <SortableContext items={cards.map((card) => card.id)} strategy={verticalListSortingStrategy}>
        <ul className={styles.cards}>
          {cards.map((card) => (
            <KanbanCard
              key={card.id}
              project_id={project_id}
              card={card}
              task={tasks.get(card.id)}
              onKeyMove={onKeyMove}
            />
          ))}
        </ul>
      </SortableContext>
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
