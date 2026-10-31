import { Badge } from '@atria/ui';
import { Link } from '@tanstack/react-router';
import { formatDate } from '../../../shared/format/intl';
import { useT } from '../../../shared/i18n/i18n';
import { usePreferences } from '../../../shared/preferences/preferences-context';
import type { TaskRow } from '../hooks/use-tasks';
import { CompleteButton, type CompleteWhen } from './complete-button';
import styles from './task-item.module.css';

export interface TaskItemProps {
  row: TaskRow;
  today: string;
  onToggle: () => void;
}

function RepeatIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3" />
    </svg>
  );
}

function whenOf(row: TaskRow, today: string): CompleteWhen {
  if (row.occurrence_date === null) return 'single';
  return row.occurrence_date === today ? 'today' : { date: row.occurrence_date };
}

/** Um selo `*Soft`: aberta em tom primário calmo, feita em verde; nunca vermelho (frontend-14). */
function statusKey(row: TaskRow, today: string): string {
  const is_today = row.occurrence_date !== null && row.occurrence_date === today;
  if (is_today) return row.done ? 'tasks.item.completed_today' : 'tasks.item.open_today';
  return row.done ? 'tasks.item.completed' : 'tasks.item.open';
}

export function TaskItem({ row, today, onToggle }: TaskItemProps) {
  const t = useT();
  const { locale } = usePreferences();
  const { task } = row;
  const date_text =
    row.date === null
      ? t('tasks.item.no_date')
      : row.occurrence_date === null
        ? t('tasks.item.due', { date: formatDate(row.date, locale, 'UTC') })
        : formatDate(row.date, locale, 'UTC');

  return (
    <li className={[styles.root, row.done ? styles.done : ''].filter(Boolean).join(' ')}>
      <div className={styles.main}>
        <Link to="/tasks/$taskId" params={{ taskId: task.id }} className={styles.title}>
          {task.title}
        </Link>
        <div className={styles.sub}>
          <span>{date_text}</span>
          {task.is_recurring ? (
            <span className={styles.repeat}>
              <RepeatIcon />
              <span className={styles.srOnly}>{t('tasks.item.repeats')}</span>
            </span>
          ) : null}
          {task.labels.length > 0 ? (
            <ul className={styles.labels} aria-label={t('tasks.detail.labels')}>
              {task.labels.map((label) => (
                <li key={label}>
                  <Badge tone="accent">{label}</Badge>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
      <div className={styles.meta}>
        <Badge tone={row.done ? 'success' : 'primary'}>{t(statusKey(row, today))}</Badge>
        <CompleteButton
          title={task.title}
          done={row.done}
          when={whenOf(row, today)}
          onToggle={onToggle}
        />
      </div>
    </li>
  );
}
