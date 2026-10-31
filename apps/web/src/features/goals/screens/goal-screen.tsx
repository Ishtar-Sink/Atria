import {
  Button,
  Checkbox,
  ConfirmDialog,
  ErrorState,
  LoadingState,
  MenuButton,
  ProgressBar,
  TextField,
  Tabs,
} from '@atria/ui';
import { Link, useParams } from '@tanstack/react-router';
import { useState, type ReactNode } from 'react';
import { z } from 'zod';
import { useT } from '../../../shared/i18n/i18n';
import { StickyPageHeader } from '../../../shared/layout/sticky-page-header';
import { BackLink } from '../../../shared/navigation/back-link';
import { usePreferences } from '../../../shared/preferences/preferences-context';
import { useListSearch } from '../../../shared/url-state/use-list-search';
import { useDeleteGoal, useGoal } from '../hooks/use-goals';
import {
  useCreateMilestone,
  useDeleteMilestone,
  useMilestones,
  useToggleMilestone,
} from '../hooks/use-milestones';
import { goalReportHref } from '../lib/goal-reports';
import {
  formatDeadline,
  formatProgress,
  goalProgress,
  type Goal,
  type Milestone,
} from '../lib/goal-progress';
import { GoalOverview } from './goal-overview';
import styles from './goals.module.css';

/** Aba que outra feature acrescenta à meta (por exemplo, Conexões, montada na TASK-35). */
export interface GoalExtraTab {
  id: string;
  label: string;
  render: (goal: Goal) => ReactNode;
}

export const goalTabSearchSchema = z.object({
  tab: z.string().default('overview'),
});

function Svg({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

function MilestonesPanel({
  goal,
  milestones,
  percent,
}: {
  goal: Goal;
  milestones: readonly Milestone[];
  percent: number;
}) {
  const t = useT();
  const { locale } = usePreferences();
  const create = useCreateMilestone(goal.id);
  const toggle = useToggleMilestone(goal.id);
  const remove = useDeleteMilestone(goal.id);
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string>();
  const [removing, setRemoving] = useState<Milestone>();

  return (
    <div className={styles.stack}>
      <ProgressBar label={t('goals.milestones.progress_bar')} value={percent} />
      <p className={styles.muted}>
        {milestones.length > 0
          ? t('goals.milestones.summary', { percent: formatProgress(percent, locale) })
          : t('goals.milestones.summary_by_status')}
      </p>
      {milestones.length === 0 ? (
        <p className={styles.muted}>{t('goals.milestones.empty')}</p>
      ) : (
        <ul aria-label={t('goals.milestones.list')} className={styles.list}>
          {milestones.map((milestone) => (
            <li key={milestone.id} className={styles.milestoneRow}>
              <Checkbox
                label={milestone.title}
                checked={milestone.completed}
                onChange={(event) => {
                  toggle.mutate({ id: milestone.id, completed: event.target.checked });
                }}
              />
              <Button
                variant="muted"
                aria-label={t('goals.milestones.remove', { title: milestone.title })}
                onClick={() => {
                  setRemoving(milestone);
                }}
              >
                <Svg>
                  <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
                </Svg>
              </Button>
            </li>
          ))}
        </ul>
      )}
      <form
        noValidate
        className={styles.addForm}
        onSubmit={(event) => {
          event.preventDefault();
          const clean = title.trim();
          if (clean === '') {
            setError(t('goals.milestones.add_error'));
            return;
          }
          setError(undefined);
          setTitle('');
          create.mutate({ title: clean });
        }}
      >
        <TextField
          className={styles.addField}
          label={t('goals.milestones.add_label')}
          value={title}
          autoComplete="off"
          onChange={(event) => {
            setTitle(event.target.value);
          }}
          {...(error ? { error } : {})}
        />
        <Button type="submit" className={styles.addSubmit}>
          {t('goals.milestones.add_submit')}
        </Button>
      </form>
      <ConfirmDialog
        open={removing !== undefined}
        title={t('goals.milestones.remove_title')}
        description={t('goals.milestones.remove_description', { title: removing?.title ?? '' })}
        confirmLabel={t('goals.milestones.remove_confirm')}
        cancelLabel={t('goals.milestones.remove_cancel')}
        onCancel={() => {
          setRemoving(undefined);
        }}
        onConfirm={() => {
          if (removing) remove.mutate({ id: removing.id });
          setRemoving(undefined);
        }}
      />
    </div>
  );
}

export interface GoalScreenProps {
  extra_tabs?: readonly GoalExtraTab[];
}

/** Tela da meta: cabeçalho, Visão geral, Marcos e as abas extras (RF-37, PD-14). */
export function GoalScreen({ extra_tabs = [] }: GoalScreenProps) {
  const t = useT();
  const { locale } = usePreferences();
  const goalId = useParams({
    strict: false,
    select: (params: Record<string, unknown>) =>
      typeof params.goalId === 'string' ? params.goalId : undefined,
  });
  const id = goalId ?? '';
  const goal = useGoal(id);
  const milestones = useMilestones(id);
  const remove = useDeleteGoal();
  const { search, setSearch } = useListSearch(goalTabSearchSchema);
  const [confirming, setConfirming] = useState(false);

  if (goal.isPending) return <LoadingState label={t('goals.detail.loading')} />;
  if (goal.isError) {
    return (
      <ErrorState
        title={t('goals.detail.error_title')}
        description={t('goals.detail.error_description')}
        retryLabel={t('goals.detail.retry')}
        onRetry={() => {
          void goal.refetch();
        }}
      />
    );
  }

  const data = goal.data;
  // O progresso vem dos marcos que a tela mostra; assim muda na hora, sem esperar o servidor.
  const percent = milestones.data ? goalProgress(data, milestones.data) : data.progress_percent;
  const deadline = data.deadline
    ? t('goals.list.deadline', { date: formatDeadline(data.deadline, locale) })
    : t('goals.list.no_deadline');

  const tabs = [
    {
      id: 'overview',
      label: t('goals.detail.tab_overview'),
      panel: <GoalOverview goal={data} percent={percent} />,
    },
    {
      id: 'milestones',
      label: t('goals.detail.tab_milestones'),
      panel: milestones.isError ? (
        <ErrorState
          title={t('goals.milestones.error_title')}
          retryLabel={t('goals.milestones.retry')}
          onRetry={() => {
            void milestones.refetch();
          }}
        />
      ) : milestones.isPending ? (
        <LoadingState label={t('goals.milestones.loading')} />
      ) : (
        <MilestonesPanel goal={data} milestones={milestones.data} percent={percent} />
      ),
    },
    ...extra_tabs.map((tab) => ({ id: tab.id, label: tab.label, panel: tab.render(data) })),
  ];
  const current = tabs.some((tab) => tab.id === search.tab) ? search.tab : 'overview';

  return (
    <div>
      <StickyPageHeader
        back={<BackLink module="goals" fallback_to="/goals" />}
        eyebrow={t('goals.detail.eyebrow')}
        title={data.title}
        subtitle={t('goals.detail.subtitle', {
          deadline,
          percent: formatProgress(percent, locale),
        })}
        actions={
          <>
            <Link to={`/goals/${data.id}/edit`} className={styles.linkButton}>
              <Svg>
                <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
              </Svg>
              {t('common.edit')}
            </Link>
            <MenuButton
              label={t('common.more_actions')}
              trigger={
                <Svg>
                  <circle cx="5" cy="12" r="1" />
                  <circle cx="12" cy="12" r="1" />
                  <circle cx="19" cy="12" r="1" />
                </Svg>
              }
              items={[
                {
                  id: 'report',
                  label: t('goals.reports.goals_progress'),
                  href: goalReportHref(data.id),
                },
                {
                  id: 'delete',
                  label: t('common.delete'),
                  tone: 'danger',
                  onSelect: () => {
                    setConfirming(true);
                  },
                },
              ]}
            />
          </>
        }
      />
      <Tabs
        label={t('goals.detail.tabs')}
        tabs={tabs}
        value={current}
        onChange={(tab) => {
          setSearch({ tab });
        }}
      />
      <ConfirmDialog
        open={confirming}
        title={t('goals.detail.delete_title')}
        description={t('goals.detail.delete_description')}
        confirmLabel={t('goals.detail.delete_confirm')}
        cancelLabel={t('goals.detail.delete_cancel')}
        onCancel={() => {
          setConfirming(false);
        }}
        onConfirm={() => {
          setConfirming(false);
          remove.mutate({ id: data.id });
        }}
      />
    </div>
  );
}
