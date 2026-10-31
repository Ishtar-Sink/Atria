import { Badge, PageHeader, ProgressBar } from '@atria/ui';
import type { UseQueryResult } from '@tanstack/react-query';
import { Fragment, type ReactNode } from 'react';
import { formatDateTime, formatMoney } from '../../../shared/format/intl';
import { registerMessages, useT } from '../../../shared/i18n/i18n';
import { usePreferences } from '../../../shared/preferences/preferences-context';
import { useCurrentUser } from '../../../shared/session/current-user';
import { DASHBOARD_BLOCKS, DASH_TODAY_LIMIT, type DashboardBlockId } from '../blocks';
import { CalmMessage } from '../components/calm-message';
import { CompleteTaskButton } from '../components/complete-task-button';
import { DashboardBlock, type BlockStatus } from '../components/dashboard-block';
import { DashboardLink } from '../components/dashboard-link';
import styles from '../components/dashboard.module.css';
import { GreetingCard } from '../components/greeting-card';
import messages from '../i18n/pt-br.json';
import {
  useCompleteTask,
  useLastJournalEntry,
  useMoneyBlock,
  useReadingNow,
  useTodayReminders,
  useTodayTasks,
  useUpcomingDays,
  type DayPeriod,
} from '../hooks/use-dashboard-data';
import { useHiddenBlocks } from '../hooks/use-hidden-blocks';
import { useMaskedBlocks } from '../hooks/use-masked-blocks';

registerMessages('dashboard', messages);

const MASK = '•••••';

function statusOf(query: UseQueryResult, is_empty: boolean): BlockStatus {
  if (query.isError) return 'error';
  if (query.isPending) return 'loading';
  return is_empty ? 'empty' : 'ready';
}

function useFormats() {
  const { locale, time_zone, currency } = usePreferences();
  return {
    locale,
    time_zone,
    currency,
    /** `AAAA-MM-DD` mostrado como dia, sem deslocar pelo fuso. */
    day: (ymd: string) =>
      new Intl.DateTimeFormat(locale, {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        timeZone: 'UTC',
      }).format(new Date(`${ymd}T00:00:00Z`)),
    month: (ymd: string) =>
      new Intl.DateTimeFormat(locale, { month: 'long', timeZone: 'UTC' }).format(
        new Date(`${ymd}T00:00:00Z`),
      ),
    time: (iso: string) =>
      new Intl.DateTimeFormat(locale, {
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
        timeZone: time_zone,
      }).format(new Date(iso)),
    money: (cents: number, currency_code: string, masked = false) => {
      if (!masked) return formatMoney(cents, currency_code, locale);
      const symbol =
        new Intl.NumberFormat(locale, { style: 'currency', currency: currency_code })
          .formatToParts(0)
          .find((part) => part.type === 'currency')?.value ?? currency_code;
      return `${symbol} ${MASK}`;
    },
  };
}

function Row({ children }: { children: ReactNode }) {
  return <li className={styles.row}>{children}</li>;
}

function Period({ children }: { children: ReactNode }) {
  return <h3 className={styles.period}>{children}</h3>;
}

// ---- Blocos ----

function TodayBlock() {
  const t = useT();
  const f = useFormats();
  const query = useTodayTasks(true);
  const complete = useCompleteTask();
  const data = query.data;
  const shown = (data?.items ?? []).slice(0, DASH_TODAY_LIMIT);
  const total = data?.total_today ?? 0;
  const more = (
    <p className={styles.more}>
      <DashboardLink to="/tasks" className={styles.link}>
        {t('dashboard.today.see_all', { n: total })}
      </DashboardLink>
    </p>
  );
  return (
    <DashboardBlock
      id="today"
      title={t('dashboard.today.title')}
      status={statusOf(query, total === 0 && shown.length === 0)}
      empty={<CalmMessage>{t('dashboard.today.none')}</CalmMessage>}
      onRetry={() => void query.refetch()}
    >
      {shown.length === 0 ? (
        <>
          <CalmMessage>{t('dashboard.today.all_done')}</CalmMessage>
          {more}
        </>
      ) : (
        <>
          <ul className={styles.list}>
            {shown.map((task) => (
              <Row key={task.task_id}>
                <div className={styles.rowMain}>
                  <DashboardLink to={`/tasks/${task.task_id}`} className={styles.rowTitle}>
                    {task.title}
                  </DashboardLink>
                  {task.overdue && task.due_on !== null ? (
                    <span className={styles.rowSub}>
                      {t('dashboard.today.was_due', { date: f.day(task.due_on) })}
                    </span>
                  ) : null}
                </div>
                <CompleteTaskButton
                  title={task.title}
                  recurring={task.recurring}
                  onComplete={() => {
                    complete.mutate(task);
                  }}
                />
              </Row>
            ))}
          </ul>
          {more}
        </>
      )}
    </DashboardBlock>
  );
}

const PERIODS: readonly DayPeriod[] = ['morning', 'afternoon', 'night'];

function RemindersBlock() {
  const t = useT();
  const f = useFormats();
  const query = useTodayReminders(true);
  const items = query.data?.items ?? [];
  const shown = items.slice(0, DASH_TODAY_LIMIT);
  return (
    <DashboardBlock
      id="reminders"
      title={t('dashboard.reminders.title')}
      status={statusOf(query, items.length === 0)}
      empty={<CalmMessage>{t('dashboard.reminders.none')}</CalmMessage>}
      onRetry={() => void query.refetch()}
    >
      {PERIODS.map((period) => {
        const group = shown.filter((reminder) => reminder.period === period);
        if (group.length === 0) return null;
        return (
          <Fragment key={period}>
            <Period>{t(`dashboard.reminders.${period}`)}</Period>
            <ul className={styles.list}>
              {group.map((reminder) => (
                <Row key={`${reminder.reminder_id}:${reminder.fire_at}`}>
                  <div className={styles.rowMain}>
                    <DashboardLink
                      to={`/reminders/${reminder.reminder_id}`}
                      className={styles.rowTitle}
                    >
                      {reminder.title}
                    </DashboardLink>
                  </div>
                  <span className={styles.rowEnd}>{f.time(reminder.fire_at)}</span>
                </Row>
              ))}
            </ul>
          </Fragment>
        );
      })}
      <p className={styles.more}>
        <DashboardLink to="/reminders" className={styles.link}>
          {t('dashboard.reminders.see_all', { n: query.data?.total ?? 0 })}
        </DashboardLink>
      </p>
    </DashboardBlock>
  );
}

function UpcomingBlock() {
  const t = useT();
  const f = useFormats();
  const query = useUpcomingDays(true);
  const items = query.data ?? [];
  const dates = [...new Set(items.map((item) => item.date))];
  return (
    <DashboardBlock
      id="upcoming"
      title={t('dashboard.upcoming.title')}
      status={statusOf(query, items.length === 0)}
      empty={<CalmMessage>{t('dashboard.upcoming.none')}</CalmMessage>}
      onRetry={() => void query.refetch()}
    >
      {dates.map((date) => (
        <Fragment key={date}>
          <Period>{f.day(date)}</Period>
          <ul className={styles.list}>
            {items
              .filter((item) => item.date === date)
              .map((item) => (
                <Row key={`${item.kind}:${item.key}`}>
                  <div className={styles.rowMain}>
                    <DashboardLink to={item.href} className={styles.rowTitle}>
                      {item.title}
                    </DashboardLink>
                    {item.at !== undefined ? (
                      <span className={styles.rowSub}>{f.time(item.at)}</span>
                    ) : null}
                  </div>
                  {item.amount !== undefined ? (
                    <span className={styles.rowEnd}>
                      {f.money(item.amount, item.currency ?? f.currency)}
                    </span>
                  ) : null}
                </Row>
              ))}
          </ul>
        </Fragment>
      ))}
      <p className={styles.more}>
        <DashboardLink to="/finance/expenses?period=next_30_days" className={styles.link}>
          {t('dashboard.upcoming.see_more')}
        </DashboardLink>
      </p>
    </DashboardBlock>
  );
}

function firstLine(text: string, max: number): string {
  const line = text.split('\n').find((part) => part.trim() !== '') ?? '';
  return line.length > max ? `${line.slice(0, max).trimEnd()}…` : line;
}

interface MaskProps {
  masked: boolean;
  onToggleMask: () => void;
}

function JournalBlock({ masked, onToggleMask }: MaskProps) {
  const t = useT();
  const f = useFormats();
  const query = useLastJournalEntry(true);
  const entry = query.data;
  return (
    <DashboardBlock
      id="journal"
      title={t('dashboard.journal.title')}
      status={statusOf(query, entry === null)}
      empty={
        <>
          <CalmMessage>{t('dashboard.journal.none')}</CalmMessage>
          <p className={styles.more}>
            <DashboardLink to="/journal/new" className={styles.link}>
              {t('dashboard.journal.write_first')}
            </DashboardLink>
          </p>
        </>
      }
      onRetry={() => void query.refetch()}
      sensitive
      masked={masked}
      onToggleMask={onToggleMask}
    >
      {entry ? (
        <>
          <span className={styles.rowSub}>
            {formatDateTime(entry.occurred_at, f.locale, f.time_zone)}
          </span>
          {masked ? (
            <div className={styles.excerpt}>
              <CalmMessage>{t('dashboard.journal.masked')}</CalmMessage>
            </div>
          ) : (
            <>
              <p className={styles.excerpt}>{firstLine(entry.text, 160)}</p>
              {entry.emotions.length > 0 ? (
                <p className={styles.chips}>
                  {entry.emotions.map((emotion) => (
                    <Badge key={emotion.id} tone="primary">
                      {emotion.name}
                    </Badge>
                  ))}
                </p>
              ) : null}
            </>
          )}
          <p className={styles.more}>
            <DashboardLink to={`/journal/${entry.id}`} className={styles.link}>
              {t('dashboard.journal.open')}
            </DashboardLink>
          </p>
        </>
      ) : null}
    </DashboardBlock>
  );
}

function MoneyBlockView({ masked, onToggleMask }: MaskProps) {
  const t = useT();
  const f = useFormats();
  const query = useMoneyBlock(true);
  const data = query.data;
  const m = (cents: number) => f.money(cents, data?.currency ?? f.currency, masked);
  const next_name = data ? f.month(data.next_month.from) : '';
  return (
    <DashboardBlock
      id="balance"
      title={t('dashboard.balance.title')}
      status={statusOf(query, false)}
      onRetry={() => void query.refetch()}
      sensitive
      masked={masked}
      onToggleMask={onToggleMask}
    >
      {data ? (
        <>
          <p className={styles.total}>{m(data.total)}</p>
          <span className={styles.rowSub}>
            {data.month_left.income === 0 && data.month_left.expense === 0
              ? t('dashboard.balance.month_nothing')
              : t('dashboard.balance.month_left', {
                  income: m(data.month_left.income),
                  expense: m(data.month_left.expense),
                })}
          </span>
          <Period>{t('dashboard.balance.forecast_title', { month: next_name })}</Period>
          {data.next_month.income === 0 &&
          data.next_month.expense === 0 &&
          data.bills.length === 0 ? (
            <CalmMessage>{t('dashboard.balance.no_bills')}</CalmMessage>
          ) : (
            <>
              <p className={styles.sum}>
                <span>
                  {t('dashboard.balance.income')} <strong>{m(data.next_month.income)}</strong>
                </span>
                <span>
                  {t('dashboard.balance.bills')} <strong>{m(data.next_month.expense)}</strong>
                </span>
                <span>
                  {t('dashboard.balance.surplus')} <strong>{m(data.next_month.surplus)}</strong>
                </span>
              </p>
              {data.bills.length > 0 ? (
                <ul className={styles.list}>
                  {data.bills.map((bill) => (
                    <Row key={bill.key}>
                      <div className={styles.rowMain}>
                        <span className={styles.rowTitle}>{bill.title}</span>
                        <span className={styles.rowSub}>{f.day(bill.date)}</span>
                      </div>
                      <span className={styles.rowEnd}>
                        {f.money(bill.amount, bill.currency, masked)}
                      </span>
                    </Row>
                  ))}
                </ul>
              ) : null}
              {data.has_more_bills ? (
                <p className={styles.more}>
                  <DashboardLink
                    to={`/finance/expenses?period=custom&from=${data.next_month.from}&to=${data.next_month.to}`}
                    className={styles.link}
                  >
                    {t('dashboard.balance.see_all_bills', { month: next_name })}
                  </DashboardLink>
                </p>
              ) : null}
            </>
          )}
          <details className={styles.details}>
            <summary>{t('dashboard.balance.by_account')}</summary>
            <ul className={styles.list}>
              {data.accounts.map((account) => (
                <Row key={account.id}>
                  <div className={styles.rowMain}>
                    <DashboardLink
                      to={`/finance/accounts/${account.id}`}
                      className={styles.rowTitle}
                    >
                      {account.name}
                    </DashboardLink>
                  </div>
                  <span className={styles.rowEnd}>{m(account.amount)}</span>
                </Row>
              ))}
            </ul>
          </details>
        </>
      ) : null}
    </DashboardBlock>
  );
}

function ReadingBlock() {
  const t = useT();
  const query = useReadingNow(true);
  const books = query.data ?? [];
  return (
    <DashboardBlock
      id="reading"
      title={t('dashboard.reading.title')}
      status={statusOf(query, books.length === 0)}
      empty={<CalmMessage>{t('dashboard.reading.none')}</CalmMessage>}
      onRetry={() => void query.refetch()}
    >
      <ul className={styles.list}>
        {books.map((book) => (
          <Row key={book.id}>
            <div className={styles.rowMain}>
              <DashboardLink to={`/library/books/${book.id}`} className={styles.rowTitle}>
                {book.title}
              </DashboardLink>
              <ProgressBar
                label={t('dashboard.reading.progress', { title: book.title })}
                value={book.percent}
              />
            </div>
            <span className={styles.rowEnd}>{String(book.percent)}%</span>
          </Row>
        ))}
      </ul>
    </DashboardBlock>
  );
}

// ---- Tela ----

export function DashboardScreen() {
  const t = useT();
  const me = useCurrentUser();
  const user_id = me.data?.id;
  const { isHidden } = useHiddenBlocks(user_id);
  const { isMasked, toggleMask } = useMaskedBlocks(user_id);

  function renderBlock(id: DashboardBlockId): ReactNode {
    const mask = {
      masked: isMasked(id),
      onToggleMask: () => {
        toggleMask(id);
      },
    };
    switch (id) {
      case 'today':
        return <TodayBlock key={id} />;
      case 'reminders':
        return <RemindersBlock key={id} />;
      case 'upcoming':
        return <UpcomingBlock key={id} />;
      case 'journal':
        return <JournalBlock key={id} {...mask} />;
      case 'balance':
        return <MoneyBlockView key={id} {...mask} />;
      case 'reading':
        return <ReadingBlock key={id} />;
    }
  }

  const visible = DASHBOARD_BLOCKS.filter((block) => !isHidden(block.id));
  const main = visible.filter((block) => block.zone === 'main');
  const side = visible.filter((block) => block.zone === 'side');
  const zone_class = [
    styles.zones,
    main.length === 0 || side.length === 0 ? styles.zonesSingle : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div>
      <PageHeader
        eyebrow={t('dashboard.eyebrow')}
        title={t('dashboard.title')}
        subtitle={t('dashboard.subtitle')}
      />
      <GreetingCard name={me.data?.display_name ?? null} />
      {me.isPending ? null : visible.length === 0 ? (
        <div className={styles.empty}>
          <strong>{t('dashboard.all_hidden.title')}</strong>
          <p>{t('dashboard.all_hidden.description')}</p>
          <DashboardLink to="/settings/dashboard" className={styles.link}>
            {t('dashboard.all_hidden.link')}
          </DashboardLink>
        </div>
      ) : (
        <div className={zone_class}>
          {main.length > 0 ? (
            <div className={styles.zone} data-zone="main">
              {main.map((block) => renderBlock(block.id))}
            </div>
          ) : null}
          {side.length > 0 ? (
            <div className={styles.zone} data-zone="side">
              {side.map((block) => renderBlock(block.id))}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
