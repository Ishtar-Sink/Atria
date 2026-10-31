import { Badge, Card, ProgressBar } from '@atria/ui';
import { useT } from '../../../shared/i18n/i18n';
import { formatDate } from '../../../shared/format/intl';
import { usePreferences } from '../../../shared/preferences/preferences-context';
import { formatDeadline, formatProgress, type Goal } from '../lib/goal-progress';
import styles from './goals.module.css';

export interface GoalOverviewProps {
  goal: Goal;
  /** Já calculado sobre os marcos que a tela mostra, para mudar junto com eles. */
  percent: number;
}

/** Visão geral em cartões, como os dashboards: dados na zona principal e "Registro" na lateral (PD-59). */
export function GoalOverview({ goal, percent }: GoalOverviewProps) {
  const t = useT();
  const { locale, time_zone } = usePreferences();
  const by_status = goal.milestone_count === 0;
  const record: [string, string][] = [
    [t('goals.detail.field_visibility'), t(`goals.form.visibility_${goal.visibility}`)],
    [t('goals.detail.field_created'), formatDate(goal.created_at, locale, time_zone)],
    [t('goals.detail.field_updated'), formatDate(goal.updated_at, locale, time_zone)],
  ];
  return (
    <div className={styles.dash}>
      <div className={styles.zone}>
        <Card as="section" aria-labelledby="goal-card-progress">
          <h2 id="goal-card-progress" className={styles.cardTitle}>
            {t('goals.detail.card_progress')}
          </h2>
          <ProgressBar label={t('goals.detail.progress_bar')} value={percent} />
          <dl className={styles.facts}>
            <div>
              <dt>{t('goals.detail.field_progress')}</dt>
              <dd>
                <span className={styles.num}>{formatProgress(percent, locale)}</span>
                {by_status ? ` ${t('goals.detail.progress_by_status')}` : ''}
              </dd>
            </div>
            <div>
              <dt>{t('goals.detail.field_status')}</dt>
              <dd>{t(`goals.status.${goal.status}`)}</dd>
            </div>
            <div>
              <dt>{t('goals.detail.field_deadline')}</dt>
              <dd>
                {goal.deadline
                  ? formatDeadline(goal.deadline, locale)
                  : t('goals.list.no_deadline')}
              </dd>
            </div>
          </dl>
        </Card>
        {goal.description ? (
          <Card as="section" aria-labelledby="goal-card-description">
            <h2 id="goal-card-description" className={styles.cardTitle}>
              {t('goals.detail.card_description')}
            </h2>
            <p className={styles.longText}>{goal.description}</p>
          </Card>
        ) : null}
      </div>
      <div className={styles.zone}>
        <Card as="section" aria-labelledby="goal-card-record">
          <h2 id="goal-card-record" className={styles.cardTitle}>
            {t('goals.detail.card_record')}
          </h2>
          {goal.labels.length > 0 ? (
            <ul
              aria-label={t('goals.detail.labels')}
              className={[styles.pills, styles.registerPills].join(' ')}
            >
              {goal.labels.map((label) => (
                <li key={label}>
                  <Badge tone="info">{`#${label}`}</Badge>
                </li>
              ))}
            </ul>
          ) : null}
          <dl className={styles.about}>
            {record.map(([name, value]) => (
              <div key={name}>
                <dt>{name}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </Card>
      </div>
    </div>
  );
}
