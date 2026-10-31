import { Card, ErrorState, LoadingState } from '@atria/ui';
import { Link } from '@tanstack/react-router';
import type { CSSProperties, ReactNode } from 'react';
import { formatDate } from '../../shared/format/intl';
import { useT, type Translate } from '../../shared/i18n/i18n';
import { usePreferences } from '../../shared/preferences/preferences-context';
import styles from './projects.module.css';
import { useCardTasks } from './use-card-task-link';
import { laneLabel, useCards } from './use-kanban';
import { useProjectSummary } from './use-project-summary';
import { formatDay, isPriority, type Project } from './use-projects';

type LaneSummary = {
  lane_id: string;
  name?: string | null;
  system_key?: string | null;
  color: string;
};

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  const heading = `project-overview-${id}`;
  return (
    <Card as="section" aria-labelledby={heading}>
      <h2 id={heading} className={styles.cardTitle}>
        {title}
      </h2>
      {children}
    </Card>
  );
}

function LaneBadge({ lane, t }: { lane: LaneSummary | undefined; t: Translate }) {
  if (!lane) return null;
  return (
    <span className={styles.laneCount} style={{ '--lane': lane.color } as CSSProperties}>
      {laneLabel(lane, t)}
    </span>
  );
}

function CardRow({
  project_id,
  card_id,
  title,
  sub,
  lane,
  t,
}: {
  project_id: string;
  card_id: string;
  title: string;
  sub: string;
  lane: LaneSummary | undefined;
  t: Translate;
}) {
  return (
    <li className={styles.row}>
      <div className={styles.rowMain}>
        <Link to={`/projects/${project_id}/cards/${card_id}`} className={styles.rowTitle}>
          {title}
        </Link>
        <span className={styles.rowSub}>{sub}</span>
      </div>
      <div className={styles.rowMeta}>
        <LaneBadge lane={lane} t={t} />
      </div>
    </li>
  );
}

export interface ProjectOverviewTabProps {
  project: Project;
  /** Ligações do próprio projeto, que a TASK-35 monta sem esta feature importar outra. */
  links_slot?: ReactNode;
}

/** Visão geral em duas zonas, a partir de `GET /projects/{id}/summary` (PD-42). */
export function ProjectOverviewTab({ project, links_slot }: ProjectOverviewTabProps) {
  const t = useT();
  const { locale, time_zone } = usePreferences();
  const summary = useProjectSummary(project.id);
  const cards = useCards(project.id);
  const card_list = cards.data ?? [];
  const tasks = useCardTasks(card_list.map((card) => card.id));

  if (summary.isPending) return <LoadingState label={t('projects.overview.loading')} />;
  if (summary.isError) {
    return (
      <ErrorState
        title={t('projects.overview.error_title')}
        description={t('projects.overview.error')}
        retryLabel={t('projects.list.retry')}
        onRetry={() => {
          void summary.refetch();
        }}
      />
    );
  }

  const data = summary.data;
  const lane_of = (lane_id: string) => data.lanes.find((lane) => lane.lane_id === lane_id);
  const open_lane = (lane_id: string) => lane_of(lane_id)?.counts_as_done !== true;
  const { done_cards, total_cards } = data.progress;

  const high = card_list.filter((card) => card.priority === 'high' && open_lane(card.lane_id));
  const linked = card_list.flatMap((card) => {
    const task = tasks.get(card.id);
    return task ? [{ card, task }] : [];
  });

  const record: [string, string][] = [
    [t('projects.overview.about_visibility'), t(`projects.visibility.${project.visibility}`)],
    [t('projects.overview.about_created'), formatDate(project.created_at, locale, time_zone)],
    [t('projects.overview.about_updated'), formatDate(project.updated_at, locale, time_zone)],
  ];

  return (
    <div className={styles.dash}>
      <div className={styles.zone}>
        <Section id="progress" title={t('projects.overview.progress_title')}>
          {total_cards === 0 ? (
            <p className={styles.muted}>{t('projects.overview.progress_empty')}</p>
          ) : (
            <>
              <div
                className={styles.bar}
                role="img"
                aria-label={data.lanes
                  .map((lane) => `${laneLabel(lane, t)}: ${String(lane.card_count)}`)
                  .join(', ')}
              >
                {data.lanes
                  .filter((lane) => lane.card_count > 0)
                  .map((lane) => (
                    <span
                      key={lane.lane_id}
                      style={{ flex: lane.card_count, background: lane.color }}
                    />
                  ))}
              </div>
              <ul className={styles.legend}>
                {data.lanes.map((lane) => (
                  <li key={lane.lane_id}>
                    <span className={styles.dot} style={{ background: lane.color }} />
                    {laneLabel(lane, t)} <strong className={styles.num}>{lane.card_count}</strong>
                  </li>
                ))}
              </ul>
              <p className={styles.muted}>
                {t('projects.overview.progress_text', { done: done_cards, total: total_cards })}
              </p>
            </>
          )}
        </Section>
        <Section id="due" title={t('projects.overview.due_title')}>
          {data.upcoming_due.length === 0 ? (
            <p className={styles.muted}>{t('projects.overview.due_empty')}</p>
          ) : (
            <ul className={styles.list}>
              {data.upcoming_due.map((card) => (
                <CardRow
                  key={card.card_id}
                  project_id={project.id}
                  card_id={card.card_id}
                  title={card.title}
                  sub={t(
                    card.overdue ? 'projects.overview.due_overdue' : 'projects.overview.due_until',
                    {
                      date: formatDay(card.due_date, locale),
                    },
                  )}
                  lane={lane_of(card.lane_id)}
                  t={t}
                />
              ))}
            </ul>
          )}
        </Section>
        <Section id="doing" title={t('projects.overview.doing_title')}>
          {data.in_progress.length === 0 ? (
            <p className={styles.muted}>{t('projects.overview.doing_empty')}</p>
          ) : (
            <ul className={styles.list}>
              {data.in_progress.map((card) => {
                const parts = [
                  card.checklist_total > 0
                    ? t('projects.overview.doing_checklist', {
                        done: card.checklist_done,
                        total: card.checklist_total,
                      })
                    : '',
                  isPriority(card.priority) ? t(`projects.priority_badge.${card.priority}`) : '',
                ].filter((part) => part !== '');
                return (
                  <CardRow
                    key={card.card_id}
                    project_id={project.id}
                    card_id={card.card_id}
                    title={card.title}
                    sub={
                      parts.length > 0
                        ? parts.join(' · ')
                        : t('projects.overview.doing_no_checklist')
                    }
                    lane={lane_of(card.lane_id)}
                    t={t}
                  />
                );
              })}
            </ul>
          )}
        </Section>
      </div>
      <div className={styles.zone}>
        <Section id="about" title={t('projects.overview.about_title')}>
          {project.description ? <p className={styles.longText}>{project.description}</p> : null}
          <dl className={styles.about}>
            {record.map(([name, value]) => (
              <div key={name}>
                <dt>{name}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </Section>
        {high.length > 0 ? (
          <Section id="high" title={t('projects.overview.high_title')}>
            <ul className={styles.list}>
              {high.map((card) => (
                <CardRow
                  key={card.id}
                  project_id={project.id}
                  card_id={card.id}
                  title={card.title}
                  sub={
                    card.due_date
                      ? t('projects.overview.due_until', { date: formatDay(card.due_date, locale) })
                      : t('projects.overview.high_no_due')
                  }
                  lane={lane_of(card.lane_id)}
                  t={t}
                />
              ))}
            </ul>
          </Section>
        ) : null}
        <Section id="links" title={t('projects.overview.links_title')}>
          {linked.length === 0 && !links_slot ? (
            <>
              <p className={styles.muted}>{t('projects.overview.links_empty')}</p>
              <Link to={`/projects/${project.id}`} search={{ tab: 'connections' }}>
                {t('projects.overview.links_connect')}
              </Link>
            </>
          ) : (
            <>
              {linked.length > 0 ? (
                <ul className={styles.list}>
                  {linked.map(({ card, task }) => (
                    <li key={card.id} className={styles.row}>
                      <div className={styles.rowMain}>
                        <Link to={`/tasks/${task.task_id}`} className={styles.rowTitle}>
                          {task.title}
                        </Link>
                        <span className={styles.rowSub}>
                          {t('projects.overview.linked_task_of', { card: card.title })}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : null}
              {links_slot}
            </>
          )}
        </Section>
      </div>
    </div>
  );
}
