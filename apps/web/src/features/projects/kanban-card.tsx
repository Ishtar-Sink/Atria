import { Badge, SelectField, type BadgeTone } from '@atria/ui';
import { Link } from '@tanstack/react-router';
import type { DragEvent } from 'react';
import { useT } from '../../shared/i18n/i18n';
import { usePreferences } from '../../shared/preferences/preferences-context';
import { CalendarIcon, ChecklistIcon, LinkIcon } from './icons';
import styles from './projects.module.css';
import type { CardTask } from './use-card-task-link';
import { laneLabel } from './use-kanban';
import { formatDay, isPriority, type Card, type Lane, type Priority } from './use-projects';

/** Alta em tom de perigo suave, média em aviso e baixa neutra, como no protótipo (PD-46). */
const PRIORITY_TONE: Record<Priority, BadgeTone> = {
  high: 'danger',
  medium: 'warning',
  low: 'neutral',
};

export interface KanbanCardProps {
  project_id: string;
  card: Card;
  lanes: readonly Lane[];
  task: CardTask | undefined;
  dragging: boolean;
  onMove: (card: Card, lane_id: string) => void;
  onDragStart: (card: Card, event: DragEvent<HTMLLIElement>) => void;
  onDragEnd: () => void;
}

/** Cartão do quadro (RF-57, PD-46): movido arrastando ou pelo seletor de raia do pé. */
export function KanbanCard({
  project_id,
  card,
  lanes,
  task,
  dragging,
  onMove,
  onDragStart,
  onDragEnd,
}: KanbanCardProps) {
  const t = useT();
  const { locale } = usePreferences();
  const done = card.checklist.filter((item) => item.done).length;
  const total = card.checklist.length;
  const priority = isPriority(card.priority) ? card.priority : undefined;
  const classes = [styles.kcard, dragging ? styles.kcardDragging : ''].filter(Boolean).join(' ');

  return (
    <li
      className={classes}
      draggable
      data-card-id={card.id}
      onDragStart={(event) => {
        onDragStart(card, event);
      }}
      onDragEnd={onDragEnd}
    >
      <Link
        to={`/projects/${project_id}/cards/${card.id}`}
        className={styles.rowTitle}
        draggable={false}
      >
        {card.title}
      </Link>
      {card.description ? <p className={styles.kcardDesc}>{card.description}</p> : null}
      {priority || card.labels.length > 0 ? (
        <div className={styles.pills}>
          {priority ? (
            <Badge tone={PRIORITY_TONE[priority]}>{t(`projects.priority_badge.${priority}`)}</Badge>
          ) : null}
          {card.labels.map((label) => (
            <Badge key={label} tone="accent">
              {label}
            </Badge>
          ))}
        </div>
      ) : null}
      <div className={styles.kcardFoot}>
        <div className={styles.kcardMeta}>
          {card.due_date ? (
            <span>
              <CalendarIcon />
              <span className={styles.srOnly}>{t('projects.card.due')}</span>
              {formatDay(card.due_date, locale)}
            </span>
          ) : null}
          {total > 0 ? (
            <span>
              <ChecklistIcon />
              <span className={styles.srOnly}>{t('projects.card.checklist')}</span>
              {`${String(done)}/${String(total)}`}
            </span>
          ) : null}
          {task ? (
            <span>
              <LinkIcon />
              <span className={styles.srOnly}>{t('projects.card.linked_task')}</span>
              {task.title}
            </span>
          ) : null}
        </div>
        <SelectField
          id={`move-${card.id}`}
          className={styles.move}
          label={t('projects.card.move_to', { card: card.title })}
          value={card.lane_id}
          options={lanes.map((lane) => ({ value: lane.id, label: laneLabel(lane, t) }))}
          onChange={(lane_id) => {
            onMove(card, lane_id);
          }}
        />
      </div>
    </li>
  );
}
