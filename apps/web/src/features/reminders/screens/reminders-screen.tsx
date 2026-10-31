import {
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  LoadingState,
  SelectField,
  Toolbar,
  ViewSwitcher,
} from '@atria/ui';
import { Link, useNavigate, useRouterState } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { formatDate, formatDateTime } from '../../../shared/format/intl';
import { useT } from '../../../shared/i18n/i18n';
import { useScreenInfo } from '../../../shared/layout/screen-info';
import { StickyPageHeader } from '../../../shared/layout/sticky-page-header';
import { rememberListLocation } from '../../../shared/navigation/back-target';
import { usePreferences } from '../../../shared/preferences/preferences-context';
import { useListSearch } from '../../../shared/url-state/use-list-search';
import { NotificationSettingsCard } from '../components/notification-settings-card';
import {
  localDay,
  remindersSearchSchema,
  useDeleteReminder,
  useReminderRows,
  type Reminder,
} from '../hooks/use-reminders';
import styles from './reminders-screen.module.css';

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

function groupByDay(rows: readonly Reminder[], time_zone: string) {
  const groups = new Map<string, Reminder[]>();
  for (const row of rows) {
    const key = row.next_fire_at ? localDay(row.next_fire_at, time_zone) : '';
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return [...groups.entries()].map(([date, items]) => ({ date, items }));
}

interface ItemProps {
  reminder: Reminder;
  onDelete: (reminder: Reminder) => void;
}

function ReminderItem({ reminder, onDelete }: ItemProps) {
  const t = useT();
  const { locale, time_zone } = usePreferences();
  const next = reminder.next_fire_at
    ? t('reminders.list.next', { date: formatDateTime(reminder.next_fire_at, locale, time_zone) })
    : t('reminders.list.no_next');
  return (
    <li className={styles.item}>
      <div className={styles.main}>
        <Link
          to="/reminders/$reminderId"
          params={{ reminderId: reminder.id }}
          className={styles.title}
        >
          {reminder.title}
        </Link>
        <div className={styles.sub}>
          <span>{next}</span>
          {reminder.kind === 'recurring' ? (
            <span className={styles.repeat}>
              <RepeatIcon />
              <span className={styles.srOnly}>{t('reminders.list.repeats')}</span>
            </span>
          ) : null}
        </div>
      </div>
      <Button
        variant="ghost"
        aria-label={t('reminders.list.delete', { title: reminder.title })}
        onClick={() => {
          onDelete(reminder);
        }}
      >
        {t('reminders.detail.delete')}
      </Button>
    </li>
  );
}

export function RemindersScreen() {
  const t = useT();
  const { locale, time_zone } = usePreferences();
  const navigate = useNavigate();
  const { search, setSearch } = useListSearch(remindersSearchSchema, { view_key: 'reminders' });
  const { set_items } = useScreenInfo();
  const href = useRouterState({ select: (state) => state.location.href });
  const list = useReminderRows(search);
  const remove = useDeleteReminder();
  const [pending_delete, setPendingDelete] = useState<Reminder | null>(null);

  useEffect(() => {
    rememberListLocation('reminders', href);
  }, [href]);

  const total = list.rows.length;
  useEffect(() => {
    if (list.is_loading || list.is_error) return;
    set_items([{ label: t('reminders.list.total'), value: String(total) }]);
    return () => {
      set_items([]);
    };
  }, [list.is_loading, list.is_error, total, set_items, t]);

  const filtered = search.q !== '' || search.kind !== 'any';

  const filters = (
    <div role="group" aria-label={t('common.filters')} className={styles.filters}>
      <SelectField
        label={t('reminders.list.filter_kind')}
        value={search.kind}
        onChange={(kind) => {
          setSearch({ kind: kind as typeof search.kind });
        }}
        options={[
          { value: 'any', label: t('reminders.list.kind_any') },
          { value: 'one_off', label: t('reminders.list.kind_one_off') },
          { value: 'recurring', label: t('reminders.list.kind_recurring') },
        ]}
      />
    </div>
  );

  function renderRow(reminder: Reminder) {
    return <ReminderItem key={reminder.id} reminder={reminder} onDelete={setPendingDelete} />;
  }

  function renderBody() {
    if (list.is_error) {
      return (
        <ErrorState
          title={t('reminders.list.error_title')}
          description={t('reminders.list.error_description')}
          retryLabel={t('common.retry')}
          onRetry={list.refetch}
        />
      );
    }
    if (list.is_loading) return <LoadingState label={t('common.loading')} />;
    if (list.rows.length === 0) {
      return filtered ? (
        <EmptyState
          title={t('reminders.list.empty_filtered_title')}
          description={t('reminders.list.empty_filtered_description')}
        />
      ) : (
        <EmptyState
          title={t('reminders.list.empty_title')}
          description={t('reminders.list.empty_description')}
          action={
            <Button
              variant="primary"
              onClick={() => {
                void navigate({ to: '/reminders/new' });
              }}
            >
              {t('reminders.list.new')}
            </Button>
          }
        />
      );
    }
    if (search.view === 'list') return <ul className={styles.list}>{list.rows.map(renderRow)}</ul>;
    return (
      <div className={styles.screen}>
        {groupByDay(list.rows, time_zone).map((group) => {
          const heading =
            group.date === ''
              ? t('reminders.list.group_undated')
              : formatDate(group.date, locale, 'UTC');
          return (
            <section key={group.date} className={styles.group} aria-label={heading}>
              <h2 className={styles.groupTitle}>{heading}</h2>
              <ul className={styles.list}>{group.items.map(renderRow)}</ul>
            </section>
          );
        })}
      </div>
    );
  }

  return (
    <div className={styles.screen}>
      <StickyPageHeader
        eyebrow={t('reminders.list.eyebrow')}
        title={t('reminders.list.title')}
        subtitle={t('reminders.list.subtitle')}
        actions={
          <Button
            variant="primary"
            onClick={() => {
              void navigate({ to: '/reminders/new' });
            }}
          >
            {t('reminders.list.new')}
          </Button>
        }
      />
      <NotificationSettingsCard />
      <Toolbar
        searchLabel={t('common.search')}
        searchPlaceholder={t('reminders.list.search_placeholder')}
        searchValue={search.q}
        onSearchChange={(q) => {
          setSearch({ q });
        }}
        filters={filters}
      >
        <ViewSwitcher
          label={t('common.view')}
          value={search.view}
          onChange={(view) => {
            setSearch({ view: view as typeof search.view });
          }}
          options={[
            { value: 'list', label: t('reminders.list.view_list') },
            { value: 'day', label: t('reminders.list.view_day') },
          ]}
        />
      </Toolbar>
      {renderBody()}
      <ConfirmDialog
        open={pending_delete !== null}
        title={t('reminders.list.delete_title')}
        description={t('reminders.list.delete_description')}
        confirmLabel={t('reminders.detail.delete')}
        cancelLabel={t('common.cancel')}
        onCancel={() => {
          setPendingDelete(null);
        }}
        onConfirm={() => {
          const target = pending_delete;
          setPendingDelete(null);
          if (target !== null) remove.mutate(target.id);
        }}
      />
    </div>
  );
}
