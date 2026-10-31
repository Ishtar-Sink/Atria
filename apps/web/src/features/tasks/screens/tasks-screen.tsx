import {
  Button,
  EmptyState,
  ErrorState,
  LoadingState,
  MenuButton,
  SelectField,
  TextField,
  Toolbar,
  ViewSwitcher,
} from '@atria/ui';
import { useNavigate, useRouterState } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { formatDate } from '../../../shared/format/intl';
import { useT } from '../../../shared/i18n/i18n';
import { useScreenInfo } from '../../../shared/layout/screen-info';
import { StickyPageHeader } from '../../../shared/layout/sticky-page-header';
import { rememberListLocation } from '../../../shared/navigation/back-target';
import { usePreferences } from '../../../shared/preferences/preferences-context';
import { useListSearch } from '../../../shared/url-state/use-list-search';
import { TaskItem } from '../components/task-item';
import { useToggleCompletion } from '../hooks/use-task-completion';
import { tasksSearchSchema, useTaskRows, type TaskRow } from '../hooks/use-tasks';
import { TASKS_REPORTS, tasksReportHref } from '../lib/task-reports';
import styles from './tasks-screen.module.css';

function groupByDay(rows: readonly TaskRow[]) {
  const groups = new Map<string, TaskRow[]>();
  for (const row of rows) {
    const key = row.date ?? '';
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return [...groups.entries()].map(([date, items]) => ({ date, items }));
}

export function TasksScreen() {
  const t = useT();
  const { locale } = usePreferences();
  const navigate = useNavigate();
  const { search, setSearch } = useListSearch(tasksSearchSchema, { view_key: 'tasks' });
  const { set_items } = useScreenInfo();
  const href = useRouterState({ select: (state) => state.location.href });
  const toggle = useToggleCompletion();
  const [label_draft, setLabelDraft] = useState(search.label);
  const list = useTaskRows(search, search.view);

  useEffect(() => {
    rememberListLocation('tasks', href);
  }, [href]);

  // A etiqueta volta da URL (limpar filtros, voltar no histórico): o rascunho a acompanha.
  const [seen_label, setSeenLabel] = useState(search.label);
  if (seen_label !== search.label) {
    setSeenLabel(search.label);
    setLabelDraft(search.label);
  }

  const total = list.rows.length;
  useEffect(() => {
    if (list.is_loading || list.is_error) return;
    set_items([{ label: t('tasks.list.total'), value: String(total) }]);
    return () => {
      set_items([]);
    };
  }, [list.is_loading, list.is_error, total, set_items, t]);

  const filtered =
    search.q !== '' ||
    search.label !== '' ||
    search.recurring !== 'any' ||
    search.status !== 'open' ||
    search.range !== 'today';

  const filters = (
    <div role="group" aria-label={t('common.filters')} className={styles.filters}>
      <SelectField
        label={t('tasks.list.filter_status')}
        value={search.status}
        onChange={(status) => {
          setSearch({ status: status as typeof search.status });
        }}
        options={[
          { value: 'open', label: t('tasks.list.status_open') },
          { value: 'completed', label: t('tasks.list.status_completed') },
          { value: 'all', label: t('tasks.list.status_all') },
        ]}
      />
      <SelectField
        label={t('tasks.list.filter_kind')}
        value={search.recurring}
        onChange={(recurring) => {
          setSearch({ recurring: recurring as typeof search.recurring });
        }}
        options={[
          { value: 'any', label: t('tasks.list.kind_any') },
          { value: 'single', label: t('tasks.list.kind_single') },
          { value: 'recurring', label: t('tasks.list.kind_recurring') },
        ]}
      />
      <TextField
        label={t('tasks.list.filter_label')}
        help={t('tasks.list.filter_label_help')}
        value={label_draft}
        onChange={(event) => {
          setLabelDraft(event.target.value);
          if (event.target.value === '') setSearch({ label: '' });
        }}
        onKeyDown={(event) => {
          if (event.key !== 'Enter') return;
          event.preventDefault();
          setSearch({ label: label_draft.trim() });
        }}
      />
      <SelectField
        label={t('tasks.list.filter_range')}
        value={search.range}
        onChange={(range) => {
          setSearch({ range: range as typeof search.range });
        }}
        options={[
          { value: 'today', label: t('tasks.list.range_today') },
          { value: 'week', label: t('tasks.list.range_week') },
          { value: 'all', label: t('tasks.list.range_all') },
        ]}
      />
    </div>
  );

  function renderRow(row: TaskRow) {
    return (
      <TaskItem
        key={row.key}
        row={row}
        today={list.today}
        onToggle={() => {
          toggle(
            {
              task: { id: row.task.id, is_recurring: row.task.is_recurring },
              occurrence_date: row.occurrence_date ?? undefined,
            },
            row.done,
          );
        }}
      />
    );
  }

  function renderBody() {
    if (list.is_error) {
      return (
        <ErrorState
          title={t('tasks.list.error_title')}
          description={t('tasks.list.error_description')}
          retryLabel={t('common.retry')}
          onRetry={list.refetch}
        />
      );
    }
    if (list.is_loading) return <LoadingState label={t('common.loading')} />;
    if (list.rows.length === 0) {
      return filtered ? (
        <EmptyState
          title={t('tasks.list.empty_filtered_title')}
          description={t('tasks.list.empty_filtered_description')}
        />
      ) : (
        <EmptyState
          title={t('tasks.list.empty_title')}
          description={t('tasks.list.empty_description')}
          action={
            <Button
              variant="primary"
              onClick={() => {
                void navigate({ to: '/tasks/new' });
              }}
            >
              {t('tasks.list.new')}
            </Button>
          }
        />
      );
    }
    if (search.view === 'list') return <ul className={styles.list}>{list.rows.map(renderRow)}</ul>;
    return (
      <div className={styles.screen}>
        {groupByDay(list.rows).map((group) => {
          const heading =
            group.date === ''
              ? t('tasks.list.group_undated')
              : group.date === list.today
                ? t('tasks.list.group_today')
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
        eyebrow={t('tasks.list.eyebrow')}
        title={t('tasks.list.title')}
        subtitle={t('tasks.list.subtitle')}
        actions={
          <div className={styles.actions}>
            <MenuButton
              label={t('tasks.list.reports')}
              trigger={t('tasks.list.reports')}
              items={TASKS_REPORTS.map((report) => ({
                id: report.id,
                label: t(report.title_key),
                href: tasksReportHref(report.id),
              }))}
            />
            <Button
              variant="primary"
              onClick={() => {
                void navigate({ to: '/tasks/new' });
              }}
            >
              {t('tasks.list.new')}
            </Button>
          </div>
        }
      />
      <Toolbar
        searchLabel={t('common.search')}
        searchPlaceholder={t('tasks.list.search_placeholder')}
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
            { value: 'list', label: t('tasks.list.view_list') },
            { value: 'day', label: t('tasks.list.view_day') },
          ]}
        />
      </Toolbar>
      <p className={styles.help}>{t('tasks.list.range_help')}</p>
      {renderBody()}
    </div>
  );
}
