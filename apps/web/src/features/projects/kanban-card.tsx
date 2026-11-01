import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Badge, type BadgeTone } from '@atria/ui';
import { Link } from '@tanstack/react-router';
import { useT } from '../../shared/i18n/i18n';
import { usePreferences } from '../../shared/preferences/preferences-context';
import { CalendarIcon, ChecklistIcon, LinkIcon } from './icons';
import styles from './projects.module.css';
import type { CardTask } from './use-card-task-link';
import { formatDay, isPriority, type Card, type Priority } from './use-projects';

/** Alta em tom de perigo suave, média em aviso e baixa neutra, como no protótipo (PD-46). */
const PRIORITY_TONE: Record<Priority, BadgeTone> = {
  high: 'danger',
  medium: 'warning',
  low: 'neutral',
};

export interface KanbanCardProps {
  project_id: string;
  card: Card;
  task: CardTask | undefined;
  /** Seta no link do cartão em foco: devolve `true` quando moveu o cartão (RF-34). */
  onKeyMove: (card: Card, key: string) => boolean;
}

/** Cartão do quadro (RF-57, RF-34): arrastado inteiro por mouse e toque, ou pelas setas com o link em foco. */
export function KanbanCard({ project_id, card, task, onKeyMove }: KanbanCardProps) {
  const t = useT();
  const { locale } = usePreferences();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useSortable({
    id: card.id,
    data: { type: 'card', card_id: card.id, lane_id: card.lane_id },
    transition: null,
    attributes: { roleDescription: t('projects.card.drag_role') },
  });
  const done = card.checklist.filter((item) => item.done).length;
  const total = card.checklist.length;
  const priority = isPriority(card.priority) ? card.priority : undefined;
  const classes = [styles.kcard, isDragging ? styles.kcardDragging : ''].filter(Boolean).join(' ');

  return (
    <li
      ref={setNodeRef}
      className={classes}
      data-card-id={card.id}
      style={{ transform: CSS.Translate.toString(transform) }}
      {...listeners}
    >
      <Link
        to={`/projects/${project_id}/cards/${card.id}`}
        id={`move-${card.id}`}
        className={styles.rowTitle}
        draggable={false}
        aria-describedby={attributes['aria-describedby']}
        aria-roledescription={attributes['aria-roledescription']}
        onKeyDown={(event) => {
          if (onKeyMove(card, event.key)) event.preventDefault();
        }}
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
      </div>
    </li>
  );
}
