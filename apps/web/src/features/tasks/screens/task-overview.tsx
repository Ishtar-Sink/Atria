import { Badge, Card } from '@atria/ui';
import { formatDate } from '../../../shared/format/intl';
import { summarizeRule } from '../../../shared/forms/recurrence-fields';
import { useT } from '../../../shared/i18n/i18n';
import { usePreferences } from '../../../shared/preferences/preferences-context';
import { toRule, type Task, type TaskOccurrence } from '../hooks/use-tasks';
import styles from './task-overview.module.css';

export interface TaskOverviewProps {
  task: Task;
  /** A ocorrência de hoje da recorrente; `undefined` quando não há. */
  today_occurrence: TaskOccurrence | undefined;
}

export function useStatusText(task: Task, today_occurrence: TaskOccurrence | undefined): string {
  const t = useT();
  if (!task.is_recurring) {
    return t((task.completed_at ?? null) === null ? 'tasks.item.open' : 'tasks.item.completed');
  }
  if (today_occurrence === undefined) return t('tasks.detail.no_occurrence_today');
  return t(today_occurrence.completed ? 'tasks.item.completed_today' : 'tasks.item.open_today');
}

/** O resumo da regra completa vem da base (DEC-008). */
export function useRepetitionText(task: Task | undefined): string {
  const t = useT();
  const { locale } = usePreferences();
  if (task === undefined) return '';
  return task.recurrence
    ? summarizeRule(toRule(task.recurrence), locale)
    : t('tasks.detail.repetition_single');
}

export function TaskOverview({ task, today_occurrence }: TaskOverviewProps) {
  const t = useT();
  const { locale, time_zone } = usePreferences();
  const status = useStatusText(task, today_occurrence);
  const repetition = useRepetitionText(task);
  const visibility =
    task.visibility === 'shared'
      ? t('tasks.form.visibility_shared')
      : t('tasks.form.visibility_personal');

  return (
    <div className={styles.grid}>
      <div className={styles.column}>
        <Card as="section" aria-labelledby="task-card-task">
          <h2 id="task-card-task" className={styles.cardTitle}>
            {t('tasks.detail.card_task')}
          </h2>
          <dl className={styles.facts}>
            <dt>{t('tasks.detail.status')}</dt>
            <dd>{status}</dd>
            <dt>{t('tasks.detail.repetition')}</dt>
            <dd>{repetition}</dd>
            {task.is_recurring ? null : (
              <>
                <dt>{t('tasks.detail.date')}</dt>
                <dd>
                  {task.due_on ? formatDate(task.due_on, locale, 'UTC') : t('tasks.item.no_date')}
                </dd>
              </>
            )}
          </dl>
        </Card>
        {task.description ? (
          <Card as="section" aria-labelledby="task-card-notes">
            <h2 id="task-card-notes" className={styles.cardTitle}>
              {t('tasks.detail.card_notes')}
            </h2>
            <p className={styles.notes}>{task.description}</p>
          </Card>
        ) : null}
      </div>
      <Card as="section" aria-labelledby="task-card-record">
        <h2 id="task-card-record" className={styles.cardTitle}>
          {t('tasks.detail.card_record')}
        </h2>
        {task.labels.length > 0 ? (
          <ul className={styles.labels} aria-label={t('tasks.detail.labels')}>
            {task.labels.map((label) => (
              <li key={label}>
                <Badge tone="accent">{label}</Badge>
              </li>
            ))}
          </ul>
        ) : null}
        <dl className={styles.facts}>
          <dt>{t('tasks.detail.visibility')}</dt>
          <dd>{visibility}</dd>
          <dt>{t('tasks.detail.created_at')}</dt>
          <dd>{formatDate(task.created_at, locale, time_zone)}</dd>
          <dt>{t('tasks.detail.updated_at')}</dt>
          <dd>{formatDate(task.updated_at, locale, time_zone)}</dd>
        </dl>
      </Card>
    </div>
  );
}
