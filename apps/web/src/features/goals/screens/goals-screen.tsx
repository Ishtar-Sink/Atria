import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  ItemSwatch,
  LoadingState,
  MenuButton,
  ProgressBar,
  SelectField,
  TextField,
  Toolbar,
  ViewSwitcher,
} from '@atria/ui';
import { Link, useRouterState } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { useT, type Translate } from '../../../shared/i18n/i18n';
import { useScreenInfo } from '../../../shared/layout/screen-info';
import { StickyPageHeader } from '../../../shared/layout/sticky-page-header';
import { rememberListLocation } from '../../../shared/navigation/back-target';
import { usePreferences } from '../../../shared/preferences/preferences-context';
import { useListSearch } from '../../../shared/url-state/use-list-search';
import { goalsSearchSchema, searchToFilters, useGoals } from '../hooks/use-goals';
import { GOALS_REPORTS, goalsReportHref } from '../lib/goal-reports';
import {
  GOAL_STATUSES,
  STATUS_TONE,
  formatDeadline,
  formatProgress,
  type Goal,
} from '../lib/goal-progress';
import styles from './goals.module.css';

function Icon({ children }: { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
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

const ListIcon = () => (
  <Icon>
    <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
  </Icon>
);

const GridIcon = () => (
  <Icon>
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
  </Icon>
);

/** Etiqueta do filtro: grava na URL ao confirmar com Enter e limpa com o campo vazio (DEC-006). */
function LabelFilter({ value, onCommit }: { value: string; onCommit: (value: string) => void }) {
  const t = useT();
  const [draft, setDraft] = useState(value);
  const [seen, setSeen] = useState(value);
  if (seen !== value) {
    setSeen(value);
    setDraft(value);
  }
  return (
    <TextField
      className={styles.filterLabel}
      label={t('goals.list.filter_label')}
      value={draft}
      autoComplete="off"
      onChange={(event) => {
        setDraft(event.target.value);
        if (event.target.value === '') onCommit('');
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        onCommit(draft.trim());
      }}
    />
  );
}

function GoalMeta({ goal, t }: { goal: Goal; t: Translate }) {
  const { locale } = usePreferences();
  return (
    <>
      <Badge tone={STATUS_TONE[goal.status]}>{t(`goals.status.${goal.status}`)}</Badge>
      {goal.labels.map((label) => (
        <Badge key={label} tone="info">{`#${label}`}</Badge>
      ))}
      <span className={styles.rowEnd}>{formatProgress(goal.progress_percent, locale)}</span>
    </>
  );
}

function goalSub(goal: Goal, t: Translate, locale: string): string {
  const deadline = goal.deadline
    ? t('goals.list.deadline', { date: formatDeadline(goal.deadline, locale) })
    : t('goals.list.no_deadline');
  const milestones =
    goal.milestone_count > 0
      ? t('goals.list.milestones_count', {
          done: goal.completed_milestone_count,
          total: goal.milestone_count,
        })
      : t('goals.list.no_milestones');
  return `${deadline} · ${milestones}`;
}

function GoalRow({ goal }: { goal: Goal }) {
  const t = useT();
  const { locale } = usePreferences();
  return (
    <li className={styles.row}>
      <ItemSwatch id={goal.id} className={styles.swatch} />
      <div className={styles.rowMain}>
        <Link to={`/goals/${goal.id}`} className={styles.rowTitle}>
          {goal.title}
        </Link>
        <span className={styles.rowSub}>{goalSub(goal, t, locale)}</span>
      </div>
      <div className={styles.rowMeta}>
        <GoalMeta goal={goal} t={t} />
      </div>
      <div className={styles.rowProgress}>
        <ProgressBar
          label={t('goals.list.progress_label', { title: goal.title })}
          value={goal.progress_percent}
        />
      </div>
    </li>
  );
}

function GoalTile({ goal }: { goal: Goal }) {
  const t = useT();
  const { locale } = usePreferences();
  return (
    <li className={styles.tile}>
      <ItemSwatch id={goal.id} className={styles.art} />
      <Link to={`/goals/${goal.id}`} className={styles.rowTitle}>
        {goal.title}
      </Link>
      <span className={styles.rowSub}>{goalSub(goal, t, locale)}</span>
      <div className={styles.tileFoot}>
        <ProgressBar
          label={t('goals.list.progress_label', { title: goal.title })}
          value={goal.progress_percent}
        />
        <div className={styles.pills}>
          <GoalMeta goal={goal} t={t} />
        </div>
      </div>
    </li>
  );
}

export function GoalsScreen() {
  const t = useT();
  const { search, setSearch } = useListSearch(goalsSearchSchema, { view_key: 'goals' });
  const filters = searchToFilters(search);
  const query = useGoals(filters);
  const { set_items } = useScreenInfo();
  const href = useRouterState({ select: (state) => state.location.href });

  useEffect(() => {
    rememberListLocation('goals', href);
  }, [href]);

  const goals = query.data?.pages.flatMap((page) => page.items) ?? [];
  const total = goals.length;
  useEffect(() => {
    set_items(
      query.isSuccess
        ? [{ label: t('goals.list.items_label'), value: t('goals.list.items', { count: total }) }]
        : [],
    );
    return () => {
      set_items([]);
    };
  }, [query.isSuccess, total, set_items, t]);

  const filtered =
    search.status !== undefined ||
    search.label !== undefined ||
    search.has_deadline !== undefined ||
    search.q !== undefined;
  const deadline_value =
    search.has_deadline === undefined ? '' : search.has_deadline ? 'with' : 'without';

  const create = (
    <Link to="/goals/new" className={[styles.linkButton, styles.linkPrimary].join(' ')}>
      {t('goals.list.create')}
    </Link>
  );

  let body;
  if (query.isPending) {
    body = <LoadingState label={t('goals.list.loading')} />;
  } else if (query.isError) {
    body = (
      <ErrorState
        title={t('goals.list.error_title')}
        description={t('goals.list.error_description')}
        retryLabel={t('goals.list.retry')}
        onRetry={() => {
          void query.refetch();
        }}
      />
    );
  } else if (goals.length === 0) {
    body = filtered ? (
      <EmptyState
        title={t('goals.list.empty_filtered_title')}
        description={t('goals.list.empty_filtered_description')}
      />
    ) : (
      <EmptyState
        title={t('goals.list.empty_title')}
        description={t('goals.list.empty_description')}
        action={create}
      />
    );
  } else {
    body = (
      <>
        {search.view === 'grid' ? (
          <ul className={styles.grid}>
            {goals.map((goal) => (
              <GoalTile key={goal.id} goal={goal} />
            ))}
          </ul>
        ) : (
          <ul className={styles.list}>
            {goals.map((goal) => (
              <GoalRow key={goal.id} goal={goal} />
            ))}
          </ul>
        )}
        {query.hasNextPage ? (
          <div className={styles.more}>
            <Button
              loading={query.isFetchingNextPage}
              onClick={() => {
                void query.fetchNextPage();
              }}
            >
              {t('goals.list.more')}
            </Button>
          </div>
        ) : null}
      </>
    );
  }

  return (
    <div>
      <StickyPageHeader
        eyebrow={t('goals.list.eyebrow')}
        title={t('goals.list.title')}
        subtitle={t('goals.list.subtitle')}
        actions={
          <div className={styles.actions}>
            <MenuButton
              label={t('goals.reports.menu')}
              trigger={t('goals.reports.menu')}
              items={GOALS_REPORTS.map((report) => ({
                id: report.id,
                label: t(report.title_key),
                href: goalsReportHref(report.id),
              }))}
            />
            {create}
          </div>
        }
      />
      <Toolbar
        searchLabel={t('common.search')}
        searchPlaceholder={t('goals.list.search_placeholder')}
        searchValue={search.q ?? ''}
        onSearchChange={(value) => {
          setSearch({ q: value === '' ? undefined : value });
        }}
        filters={
          <div role="group" aria-label={t('common.filters')} className={styles.actions}>
            <SelectField
              label={t('goals.list.filter_status')}
              value={search.status ?? ''}
              options={[
                { value: '', label: t('goals.list.filter_status_all') },
                ...GOAL_STATUSES.map((status) => ({
                  value: status,
                  label: t(`goals.status.${status}`),
                })),
              ]}
              onChange={(value) => {
                setSearch({ status: GOAL_STATUSES.find((status) => status === value) });
              }}
            />
            <SelectField
              label={t('goals.list.filter_deadline')}
              value={deadline_value}
              options={[
                { value: '', label: t('goals.list.filter_deadline_any') },
                { value: 'with', label: t('goals.list.filter_deadline_with') },
                { value: 'without', label: t('goals.list.filter_deadline_without') },
              ]}
              onChange={(value) => {
                setSearch({ has_deadline: value === '' ? undefined : value === 'with' });
              }}
            />
            <LabelFilter
              value={search.label ?? ''}
              onCommit={(value) => {
                setSearch({ label: value === '' ? undefined : value });
              }}
            />
          </div>
        }
      >
        <ViewSwitcher
          label={t('common.view')}
          value={search.view}
          options={[
            { value: 'list', label: t('goals.list.view_list'), icon: <ListIcon /> },
            { value: 'grid', label: t('goals.list.view_grid'), icon: <GridIcon /> },
          ]}
          onChange={(value) => {
            setSearch({ view: value === 'grid' ? 'grid' : 'list' });
          }}
        />
      </Toolbar>
      <div aria-live="polite">{body}</div>
    </div>
  );
}
