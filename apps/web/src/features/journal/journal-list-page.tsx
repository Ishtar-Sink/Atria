import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  LoadingState,
  MenuButton,
  PeriodField,
  SelectField,
  Toolbar,
  ViewSwitcher,
  type PeriodPreset,
  type PeriodValue,
} from '@atria/ui';
import { Link, useNavigate, useRouterState } from '@tanstack/react-router';
import { useEffect, useMemo } from 'react';
import { formatDate } from '../../shared/format/intl';
import { useT } from '../../shared/i18n/i18n';
import { useScreenInfo } from '../../shared/layout/screen-info';
import { StickyPageHeader } from '../../shared/layout/sticky-page-header';
import { rememberListLocation } from '../../shared/navigation/back-target';
import { usePreferences } from '../../shared/preferences/preferences-context';
import { useListSearch } from '../../shared/url-state/use-list-search';
import { JOURNAL_REPORTS, journalReportHref } from './journal-reports';
import styles from './journal-list-page.module.css';
import { emotionLabel, useEmotions } from './use-emotions';
import {
  dayOf,
  journalSearchSchema,
  toPeriodValue,
  todayIn,
  useJournalEntries,
  type JournalEntry,
} from './use-journal-entries';

/** Sem "Próximos 30 dias": o diário só tem o que já passou (PD-55). */
const PRESETS: readonly PeriodPreset[] = [
  'this_month',
  'last_month',
  'last_30_days',
  'this_year',
  'all',
];

interface DayGroup {
  day: string;
  entries: JournalEntry[];
}

function groupByDay(entries: readonly JournalEntry[], time_zone: string): DayGroup[] {
  const groups = new Map<string, JournalEntry[]>();
  for (const entry of entries) {
    const day = dayOf(entry.occurred_at, time_zone);
    groups.set(day, [...(groups.get(day) ?? []), entry]);
  }
  return [...groups.entries()].map(([day, items]) => ({ day, entries: items }));
}

function formatTime(iso: string, locale: string, time_zone: string): string {
  return new Intl.DateTimeFormat(locale, { timeStyle: 'short', timeZone: time_zone }).format(
    new Date(iso),
  );
}

export function JournalListPage() {
  const t = useT();
  const { locale, time_zone } = usePreferences();
  const navigate = useNavigate();
  const { search, setSearch } = useListSearch(journalSearchSchema, { view_key: 'journal' });
  const { set_items } = useScreenInfo();
  const href = useRouterState({ select: (state) => state.location.href });
  const emotions = useEmotions();
  const list = useJournalEntries(search);

  useEffect(() => {
    rememberListLocation('journal', href);
  }, [href]);

  const total = list.entries.length;
  useEffect(() => {
    if (list.is_loading || list.is_error) return;
    set_items([{ label: t('journal.list.total'), value: String(total) }]);
    return () => {
      set_items([]);
    };
  }, [list.is_loading, list.is_error, total, set_items, t]);

  const groups = useMemo(() => groupByDay(list.entries, time_zone), [list.entries, time_zone]);
  const today = todayIn(time_zone);
  const filtered = search.q !== '' || search.emotion !== '' || search.period !== 'all';

  const period_labels = {
    presets: {
      this_month: t('journal.list.period_this_month'),
      last_month: t('journal.list.period_last_month'),
      next_30_days: t('common.period_next_30_days'),
      last_30_days: t('journal.list.period_last_30_days'),
      this_year: t('journal.list.period_this_year'),
      all: t('journal.list.period_all'),
    },
    title: t('common.period_title'),
    custom: t('common.period_custom'),
    apply: t('common.period_apply'),
    first_day: t('common.period_first_day'),
    last_day: t('common.period_last_day'),
    first_day_error: t('common.period_first_day_error'),
    previous: t('common.previous_month'),
    next: t('common.next_month'),
    today_marker: t('common.today_marker'),
  };

  function changePeriod(value: PeriodValue) {
    // O diário não oferece "Próximos 30 dias": se chegar, vale "Qualquer período".
    setSearch({
      period: value.preset === 'next_30_days' ? 'all' : value.preset,
      from: value.preset === 'custom' ? value.from : undefined,
      to: value.preset === 'custom' ? value.to : undefined,
    });
  }

  const filters = (
    <div role="group" aria-label={t('journal.list.filters_label')} className={styles.filters}>
      <SelectField
        label={t('journal.list.filter_emotion')}
        value={search.emotion}
        onChange={(emotion) => {
          setSearch({ emotion });
        }}
        options={[
          { value: '', label: t('journal.list.filter_emotion_all') },
          ...(emotions.data?.items ?? []).map((emotion) => ({
            value: emotion.id,
            label: emotionLabel(emotion, t),
          })),
        ]}
      />
      <PeriodField
        label={t('journal.list.filter_period')}
        value={toPeriodValue(search)}
        onChange={changePeriod}
        presets={PRESETS}
        allow_custom
        placement="toolbar"
        today={today}
        locale={locale}
        labels={period_labels}
      />
    </div>
  );

  function renderBody() {
    if (list.is_error) {
      return (
        <ErrorState
          title={t('journal.list.error')}
          description={t('journal.list.error_text')}
          retryLabel={t('common.retry')}
          onRetry={list.refetch}
        />
      );
    }
    if (list.is_loading) return <LoadingState label={t('journal.list.loading')} />;
    if (list.entries.length === 0) {
      return filtered ? (
        <EmptyState
          title={t('journal.list.empty_filtered_title')}
          description={t('journal.list.empty_filtered_text')}
        />
      ) : (
        <EmptyState
          title={t('journal.list.empty_title')}
          description={t('journal.list.empty_text')}
          action={
            <Button
              variant="primary"
              onClick={() => {
                void navigate({ to: '/journal/new' });
              }}
            >
              {t('journal.list.new')}
            </Button>
          }
        />
      );
    }
    return (
      <div className={styles.days} data-view={search.view}>
        {groups.map((group) => {
          const heading = formatDate(`${group.day}T12:00:00Z`, locale, 'UTC');
          return (
            <section key={group.day} className={styles.day} aria-label={heading}>
              <h2 className={styles.dayTitle}>{heading}</h2>
              <ul className={styles.entries}>
                {group.entries.map((entry) => (
                  <li key={entry.id} className={styles.entry}>
                    <time className={styles.time} dateTime={entry.occurred_at}>
                      {formatTime(entry.occurred_at, locale, time_zone)}
                    </time>
                    <div className={styles.body}>
                      <Link
                        to="/journal/$entryId"
                        params={{ entryId: entry.id }}
                        className={styles.text}
                      >
                        {entry.text}
                      </Link>
                      {entry.emotions.length > 0 ? (
                        <ul
                          className={styles.emotions}
                          aria-label={t('journal.list.entry_emotions')}
                        >
                          {entry.emotions.map((item) => (
                            <li key={item.emotion_id}>
                              <Badge tone="accent">{emotionLabel(item, t)}</Badge>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    );
  }

  return (
    <div className={styles.screen}>
      <StickyPageHeader
        eyebrow={t('journal.list.eyebrow')}
        title={t('journal.list.title')}
        subtitle={t('journal.list.subtitle')}
        actions={
          <div className={styles.actions}>
            <MenuButton
              label={t('journal.list.reports')}
              trigger={t('journal.list.reports')}
              items={JOURNAL_REPORTS.map((report) => ({
                id: report.id,
                label: t(report.title_key),
                href: journalReportHref(report.id),
              }))}
            />
            <Button
              onClick={() => {
                void navigate({ to: '/journal/emotions' });
              }}
            >
              {t('journal.list.emotions')}
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                void navigate({ to: '/journal/new' });
              }}
            >
              {t('journal.list.new')}
            </Button>
          </div>
        }
      />
      <Toolbar
        searchLabel={t('journal.list.search_label')}
        searchPlaceholder={t('journal.list.search_placeholder')}
        searchValue={search.q}
        onSearchChange={(q) => {
          setSearch({ q });
        }}
        filters={filters}
      >
        <ViewSwitcher
          label={t('journal.list.view_label')}
          value={search.view}
          onChange={(view) => {
            setSearch({ view: view as typeof search.view });
          }}
          options={[
            { value: 'list', label: t('journal.list.view_list') },
            { value: 'timeline', label: t('journal.list.view_timeline') },
          ]}
        />
      </Toolbar>
      {renderBody()}
    </div>
  );
}
