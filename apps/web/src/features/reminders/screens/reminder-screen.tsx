import {
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
import { formatDateTime } from '../../../shared/format/intl';
import { useT } from '../../../shared/i18n/i18n';
import { StickyPageHeader } from '../../../shared/layout/sticky-page-header';
import { BackLink } from '../../../shared/navigation/back-link';
import { usePreferences } from '../../../shared/preferences/preferences-context';
import { useDeleteReminder, useReminder } from '../hooks/use-reminders';
import { ReminderOverview, useRepetitionText } from './reminder-overview';
import styles from './reminder-screen.module.css';

export interface ExtraTab {
  id: string;
  label: string;
  render: () => ReactNode;
}

export interface ReminderScreenProps {
  reminder_id: string;
  tab: string;
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

export function ReminderScreen({
  reminder_id,
  tab,
  on_tab_change,
  extra_tabs = [],
}: ReminderScreenProps) {
  const t = useT();
  const { locale, time_zone } = usePreferences();
  const navigate = useNavigate();
  const remove = useDeleteReminder();
  const [confirming, setConfirming] = useState(false);
  const query = useReminder(reminder_id);
  const reminder = query.data;
  const repetition = useRepetitionText(reminder);

  if (query.isPending) return <LoadingState label={t('common.loading')} />;
  if (reminder === undefined) {
    const missing = query.error instanceof ApiProblem && query.error.status === 404;
    return missing ? (
      <EmptyState
        title={t('reminders.detail.not_found_title')}
        description={t('reminders.detail.not_found_description')}
      />
    ) : (
      <ErrorState
        title={t('reminders.detail.error_title')}
        retryLabel={t('common.retry')}
        onRetry={() => {
          void query.refetch();
        }}
      />
    );
  }

  const subtitle = [
    reminder.next_fire_at
      ? t('reminders.detail.subtitle_next', {
          date: formatDateTime(reminder.next_fire_at, locale, time_zone),
        })
      : t('reminders.detail.no_next'),
    reminder.kind === 'recurring' ? repetition : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const tabs = [
    {
      id: 'overview',
      label: t('reminders.detail.tab_overview'),
      panel: <ReminderOverview reminder={reminder} />,
    },
    ...extra_tabs.map((extra) => ({ id: extra.id, label: extra.label, panel: extra.render() })),
  ];
  const selected = tabs.some((item) => item.id === tab) ? tab : 'overview';

  return (
    <div className={styles.screen}>
      <StickyPageHeader
        back={<BackLink module="reminders" fallback_to="/reminders" />}
        eyebrow={t('reminders.detail.eyebrow')}
        title={reminder.title}
        subtitle={subtitle}
        actions={
          <div className={styles.actions}>
            <Button
              onClick={() => {
                void navigate({
                  to: '/reminders/$reminderId/edit',
                  params: { reminderId: reminder.id },
                });
              }}
            >
              <span className={styles.icon}>
                <PencilIcon />
              </span>
              {t('reminders.detail.edit')}
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
                  label: t('reminders.detail.delete'),
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
      <Tabs
        label={t('reminders.detail.tabs')}
        tabs={tabs}
        value={selected}
        onChange={on_tab_change}
      />
      <ConfirmDialog
        open={confirming}
        title={t('reminders.detail.delete_title')}
        description={t('reminders.detail.delete_description')}
        confirmLabel={t('reminders.detail.delete')}
        cancelLabel={t('common.cancel')}
        onCancel={() => {
          setConfirming(false);
        }}
        onConfirm={() => {
          setConfirming(false);
          remove.mutate(reminder.id, {
            onSuccess: () => {
              void navigate({ to: '/reminders' });
            },
          });
        }}
      />
    </div>
  );
}
