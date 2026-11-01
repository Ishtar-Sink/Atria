import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  LoadingState,
  MenuButton,
  Tabs,
} from '@atria/ui';
import { useNavigate } from '@tanstack/react-router';
import { useState, type ReactNode } from 'react';
import { ApiProblem } from '../../../shared/api/problem';
import { formatDate } from '../../../shared/format/intl';
import { useT } from '../../../shared/i18n/i18n';
import { StickyPageHeader } from '../../../shared/layout/sticky-page-header';
import { BackLink } from '../../../shared/navigation/back-link';
import { usePreferences } from '../../../shared/preferences/preferences-context';
import { CompleteButton } from '../components/complete-button';
import { useToggleCompletion } from '../hooks/use-task-completion';
import {
  OCCURRENCE_DAYS,
  addDays,
  todayIn,
  useDeleteTask,
  useTask,
  useTaskOccurrences,
  type Task,
  type TaskOccurrence,
} from '../hooks/use-tasks';
import { TaskOverview, useRepetitionText } from './task-overview';
import styles from './task-screen.module.css';

export interface ExtraTab {
  id: string;
  label: string;
  render: () => ReactNode;
}

export type TaskTab = 'overview' | 'occurrences' | (string & {});

export interface TaskScreenProps {
  task_id: string;
  tab: TaskTab;
  on_tab_change: (tab: string) => void;
  /** Abas de outras features (Conexões), montadas pela TASK-35. */
  extra_tabs?: readonly ExtraTab[];
}

function PencilIcon() {
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
      <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function OccurrencesTab({
  task,
  occurrences,
  next_occurrence,
  today,
  onToggle,
}: {
  task: Task;
  occurrences: readonly TaskOccurrence[];
  next_occurrence: string | null;
  today: string;
  onToggle: (occurrence: TaskOccurrence) => void;
}) {
  const t = useT();
  const { locale } = usePreferences();
  return (
    <div>
      <p className={styles.help}>{t('tasks.detail.occurrences_help')}</p>
      {occurrences.length === 0 ? (
        <EmptyState
          title={t('tasks.detail.occurrences_empty')}
          description={
            next_occurrence
              ? t('tasks.detail.occurrences_next', {
                  date: formatDate(next_occurrence, locale, 'UTC'),
                })
              : t('tasks.detail.occurrences_help')
          }
        />
      ) : (
        <ul className={styles.occurrences}>
          {occurrences.map((occurrence) => {
            const is_today = occurrence.occurrence_date === today;
            return (
              <li key={occurrence.occurrence_date} className={styles.occurrence}>
                <span>{formatDate(occurrence.occurrence_date, locale, 'UTC')}</span>
                <span className={styles.occurrenceMeta}>
                  <Badge tone={occurrence.completed ? 'success' : 'primary'}>
                    {t(
                      is_today
                        ? occurrence.completed
                          ? 'tasks.item.completed_today'
                          : 'tasks.item.open_today'
                        : occurrence.completed
                          ? 'tasks.item.completed'
                          : 'tasks.item.open',
                    )}
                  </Badge>
                  <CompleteButton
                    title={task.title}
                    done={occurrence.completed}
                    when={is_today ? 'today' : { date: occurrence.occurrence_date }}
                    onToggle={() => {
                      onToggle(occurrence);
                    }}
                  />
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function TaskScreen({ task_id, tab, on_tab_change, extra_tabs = [] }: TaskScreenProps) {
  const t = useT();
  const { locale, time_zone } = usePreferences();
  const navigate = useNavigate();
  const toggle = useToggleCompletion();
  const remove = useDeleteTask();
  const [confirming, setConfirming] = useState(false);
  const task_query = useTask(task_id);
  const task = task_query.data;
  const today = todayIn(time_zone);
  const occurrences_query = useTaskOccurrences(
    today,
    addDays(today, OCCURRENCE_DAYS - 1),
    task?.is_recurring === true,
  );
  const occurrences = (occurrences_query.data?.items ?? [])
    .filter((item) => item.task_id === task_id)
    .sort((a, b) => a.occurrence_date.localeCompare(b.occurrence_date));
  const today_occurrence = occurrences.find((item) => item.occurrence_date === today);
  const repetition = useRepetitionText(task);

  if (task_query.isPending) return <LoadingState label={t('common.loading')} />;
  if (task === undefined) {
    const missing = task_query.error instanceof ApiProblem && task_query.error.status === 404;
    return missing ? (
      <EmptyState
        title={t('tasks.detail.not_found_title')}
        description={t('tasks.detail.not_found_description')}
      />
    ) : (
      <ErrorState
        title={t('tasks.detail.error_title')}
        retryLabel={t('common.retry')}
        onRetry={() => {
          void task_query.refetch();
        }}
      />
    );
  }

  const next = task.next_occurrence ?? null;
  const subtitle = task.is_recurring
    ? [
        repetition,
        today_occurrence === undefined && next !== null && next !== today
          ? t('tasks.detail.next_date', { date: formatDate(next, locale, 'UTC') })
          : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : task.due_on
      ? t('tasks.detail.subtitle_single', { date: formatDate(task.due_on, locale, 'UTC') })
      : t('tasks.detail.subtitle_undated');

  // Sem ocorrência hoje (uma semanal fora do dia) o botão não aparece.
  const can_toggle = !task.is_recurring || today_occurrence !== undefined;
  const done = task.is_recurring
    ? today_occurrence?.completed === true
    : (task.completed_at ?? null) !== null;
  const toggle_label = task.is_recurring
    ? done
      ? 'tasks.detail.reopen_today'
      : 'tasks.detail.complete_today'
    : done
      ? 'tasks.detail.reopen'
      : 'tasks.detail.complete';

  const tabs = [
    {
      id: 'overview',
      label: t('tasks.detail.tab_overview'),
      panel: <TaskOverview task={task} today_occurrence={today_occurrence} />,
    },
    ...(task.is_recurring
      ? [
          {
            id: 'occurrences',
            label: t('tasks.detail.tab_occurrences'),
            panel: (
              <OccurrencesTab
                task={task}
                occurrences={occurrences}
                next_occurrence={task.next_occurrence ?? null}
                today={today}
                onToggle={(occurrence) => {
                  toggle(
                    {
                      task: { id: task.id, is_recurring: true },
                      occurrence_date: occurrence.occurrence_date,
                    },
                    occurrence.completed,
                  );
                }}
              />
            ),
          },
        ]
      : []),
    ...extra_tabs.map((extra) => ({ id: extra.id, label: extra.label, panel: extra.render() })),
  ];
  const selected = tabs.some((item) => item.id === tab) ? tab : 'overview';

  return (
    <div className={styles.screen}>
      <StickyPageHeader
        back={<BackLink module="tasks" fallback_to="/tasks" />}
        eyebrow={t('tasks.detail.eyebrow')}
        title={task.title}
        subtitle={subtitle}
        actions={
          <div className={styles.actions}>
            {can_toggle ? (
              <Button
                variant="success"
                onClick={() => {
                  toggle(
                    {
                      task: { id: task.id, is_recurring: task.is_recurring },
                      occurrence_date: task.is_recurring ? today : undefined,
                    },
                    done,
                  );
                }}
              >
                {t(toggle_label)}
              </Button>
            ) : null}
            <Button
              onClick={() => {
                void navigate({
                  to: '/tasks/$taskId/edit',
                  params: { taskId: task.id },
                  search: task.is_recurring ? { from: today } : {},
                });
              }}
            >
              <span className={styles.icon}>
                <PencilIcon />
              </span>
              {t('tasks.detail.edit')}
            </Button>
            <MenuButton
              label={t('common.more_actions')}
              trigger={
                <>
                  <span aria-hidden="true">⋯</span> {t('common.more_actions')}
                </>
              }
              items={[
                {
                  id: 'delete',
                  label: t('tasks.detail.delete'),
                  tone: 'danger',
                  onSelect: () => {
                    setConfirming(true);
                  },
                },
              ]}
            />
          </div>
        }
      />
      <Tabs label={t('tasks.detail.tabs')} tabs={tabs} value={selected} onChange={on_tab_change} />
      <ConfirmDialog
        open={confirming}
        title={t('tasks.detail.delete_title')}
        description={t('tasks.detail.delete_description')}
        confirmLabel={t('tasks.detail.delete')}
        cancelLabel={t('common.cancel')}
        onCancel={() => {
          setConfirming(false);
        }}
        onConfirm={() => {
          setConfirming(false);
          remove.mutate(task.id, {
            onSuccess: () => {
              void navigate({ to: '/tasks' });
            },
          });
        }}
      />
    </div>
  );
}
