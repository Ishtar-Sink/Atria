import { lazy, Suspense, useId, type ReactNode } from 'react';
import { Button, EmptyState, ErrorState, LoadingState, SegmentedField } from '@atria/ui';
import { Link, useNavigate } from '@tanstack/react-router';
import { z } from 'zod';
import { formatDate, formatMoney } from '../../../shared/format/intl';
import { useT } from '../../../shared/i18n/i18n';
import { usePreferences } from '../../../shared/preferences/preferences-context';
import { useListSearch } from '../../../shared/url-state/use-list-search';
import { adjustmentText } from '../components/adjustments-breakdown';
import { MoneyAmount, type MoneyKind } from '../components/money-amount';
import type { BarItem } from '../components/panel-charts';
import { DataCard } from '../components/record-card';
import { useFinancialSummary, type FinancialSummary } from '../hooks/use-financial-summary';
import { listItemHref, listItemKey } from '../hooks/use-transactions';
import {
  financePeriodSearchSchema,
  periodSearch,
  resolveFinancePeriod,
  toPeriodValue,
} from '../lib/finance-period';
import styles from './finance-panel-screen.module.css';

// A biblioteca de gráficos fica num chunk carregado só pelo painel (RNF-04).
const HorizontalBars = lazy(() =>
  import('../components/panel-charts').then((m) => ({ default: m.HorizontalBars })),
);
const ExpectedVsSettledBars = lazy(() =>
  import('../components/panel-charts').then((m) => ({ default: m.ExpectedVsSettledBars })),
);
const MonthlyChart = lazy(() =>
  import('../components/monthly-chart').then((m) => ({ default: m.MonthlyChart })),
);

const period_shape = financePeriodSearchSchema.shape;

export const panelSearchSchema = z.object({
  period: period_shape.period.catch('this_month'),
  from: period_shape.from.catch(undefined),
  to: period_shape.to.catch(undefined),
  monthly: z.enum(['flow', 'balance']).catch('flow'),
});

export const UPCOMING_LIMIT = 5;

type Search = z.output<typeof panelSearchSchema>;

function ChartFallback() {
  const t = useT();
  return <LoadingState label={t('common.loading')} rows={2} />;
}

function usePeriodLabel(search: Search): string {
  const t = useT();
  const { locale } = usePreferences();
  const value = toPeriodValue(search);
  if (value.preset === 'custom' && value.from && value.to) {
    return t('finance.period.custom_range', {
      from: formatDate(value.from, locale, 'UTC'),
      to: formatDate(value.to, locale, 'UTC'),
    });
  }
  return t(`finance.period.${value.preset}`).toLocaleLowerCase(locale);
}

interface BlockProps {
  summary: FinancialSummary;
  search: Search;
}

function Closing({ summary, search }: BlockProps) {
  const t = useT();
  const { locale } = usePreferences();
  const label = usePeriodLabel(search);
  const money = (value: number) => formatMoney(value, summary.currency, locale);
  const { income, expense, surplus } = summary.totals;
  const previous = summary.previous_totals;
  let compare: string | null = null;
  if (previous && previous.expense.forecast > 0) {
    const delta = expense.forecast - previous.expense.forecast;
    compare =
      delta === 0
        ? t('finance.panel.spent_same')
        : t(delta < 0 ? 'finance.panel.spent_less' : 'finance.panel.spent_more', {
            value: money(Math.abs(delta)),
          });
  }
  const fig = (title: string, realized: number, forecast: number, kind: MoneyKind) => (
    <div className={styles.fig}>
      <span className={styles.figLabel}>{title}</span>
      <strong className={styles.figValue}>
        <MoneyAmount amount={realized} currency={summary.currency} kind={kind} />
      </strong>
      <span className={styles.sub}>
        {t('finance.panel.of_forecast', { value: money(forecast) })}
      </span>
    </div>
  );
  return (
    <DataCard title={t('finance.panel.closing', { period: label })}>
      <div className={styles.figs}>
        {fig(t('finance.panel.income'), income.realized, income.forecast, 'income')}
        {fig(t('finance.panel.expense'), expense.realized, expense.forecast, 'expense')}
        <div className={styles.fig}>
          <span className={styles.figLabel}>{t('finance.panel.surplus')}</span>
          <strong className={styles.figValue}>
            <MoneyAmount amount={surplus.forecast} currency={summary.currency} kind="balance" />
          </strong>
          <span className={styles.sub}>{t('finance.panel.surplus_help')}</span>
        </div>
      </div>
      {compare ? <p className={styles.compare}>{compare}</p> : null}
    </DataCard>
  );
}

function WhereItWent({ summary, search }: BlockProps) {
  const t = useT();
  const period = periodSearch(search);
  const items: BarItem[] = summary.where_it_went.map((entry, index) => {
    if (entry.group === 'category' && entry.category_id) {
      return {
        id: entry.category_id,
        label: entry.name ?? t('finance.panel.uncategorized'),
        value: entry.amount,
        ...(entry.color ? { color: entry.color } : {}),
        href: '/finance/expenses',
        search: { ...period, category_id: entry.category_id },
      };
    }
    return {
      id: `${entry.group}-${String(index)}`,
      label: t(entry.group === 'others' ? 'finance.panel.others' : 'finance.panel.uncategorized'),
      value: entry.amount,
    };
  });
  return (
    <DataCard title={t('finance.panel.where_it_went')}>
      {items.length === 0 ? (
        <p className={styles.sub}>{t('finance.panel.where_empty')}</p>
      ) : (
        <Suspense fallback={<ChartFallback />}>
          <HorizontalBars
            label={t('finance.panel.where_label')}
            items={items}
            currency={summary.currency}
          />
        </Suspense>
      )}
    </DataCard>
  );
}

function Monthly({ summary, search }: BlockProps) {
  const t = useT();
  const { setSearch } = useListSearch(panelSearchSchema);
  return (
    <DataCard title={t('finance.panel.monthly')}>
      <div className={styles.monthlyHead}>
        <SegmentedField
          label={t('finance.panel.monthly_mode')}
          options={[
            { value: 'flow', label: t('finance.panel.monthly_flow') },
            { value: 'balance', label: t('finance.panel.monthly_balance') },
          ]}
          value={search.monthly}
          onChange={(value) => {
            setSearch({ monthly: value === 'balance' ? 'balance' : 'flow' });
          }}
        />
      </div>
      <Suspense fallback={<ChartFallback />}>
        <MonthlyChart
          label={t('finance.panel.monthly_label')}
          months={summary.monthly}
          currency={summary.currency}
          mode={search.monthly}
        />
      </Suspense>
    </DataCard>
  );
}

function ExpectedVsSettled({ summary }: { summary: FinancialSummary }) {
  const t = useT();
  const { income, expense } = summary.expected_vs_settled;
  return (
    <DataCard title={t('finance.panel.expected_vs_settled')}>
      <Suspense fallback={<ChartFallback />}>
        <ExpectedVsSettledBars
          label={t('finance.panel.expected_vs_settled_label')}
          currency={summary.currency}
          expected_label={t('finance.panel.expected')}
          settled_label={t('finance.panel.settled')}
          groups={[
            {
              id: 'income',
              label: t('finance.panel.income'),
              expected: income.expected_amount,
              settled: income.settled_amount,
            },
            {
              id: 'expense',
              label: t('finance.panel.expense'),
              expected: expense.expected_amount,
              settled: expense.settled_amount,
            },
          ]}
        />
      </Suspense>
    </DataCard>
  );
}

function Balance({ summary }: { summary: FinancialSummary }) {
  const t = useT();
  const { locale } = usePreferences();
  const money = (value: number) => formatMoney(value, summary.currency, locale);
  const { balance } = summary;
  return (
    <DataCard title={t('finance.panel.balance')}>
      <p className={styles.total}>
        <MoneyAmount amount={balance.current} currency={summary.currency} kind="balance" />
      </p>
      {balance.forecast_at_period_end != null ? (
        <p className={styles.sub}>
          {t('finance.panel.balance_forecast', {
            date: formatDate(summary.period.to, locale, 'UTC'),
            value: money(balance.forecast_at_period_end),
          })}
        </p>
      ) : null}
      <ul className={styles.about} aria-label={t('finance.panel.balance_accounts')}>
        {balance.accounts.map((account) => (
          <li key={account.id}>
            <Link to="/finance/accounts/$accountId" params={{ accountId: account.id }}>
              {account.name}
            </Link>
            <MoneyAmount
              amount={account.balance_amount}
              currency={summary.currency}
              kind="balance"
            />
          </li>
        ))}
      </ul>
    </DataCard>
  );
}

function Upcoming({ summary }: { summary: FinancialSummary }) {
  const t = useT();
  const { locale } = usePreferences();
  const items = summary.upcoming_bills;
  return (
    <DataCard title={t('finance.panel.upcoming')}>
      {items.length === 0 ? (
        <p className={styles.sub}>{t('finance.panel.upcoming_empty')}</p>
      ) : (
        <>
          <ul className={styles.about}>
            {items.slice(0, UPCOMING_LIMIT).map((entry) => {
              const date = formatDate(entry.expected_date, locale, 'UTC');
              return (
                <li key={listItemKey(entry)}>
                  <span>
                    <Link to={listItemHref(entry)}>
                      {entry.description ?? t(`finance.transactions.no_description_${entry.kind}`)}
                    </Link>
                    <br />
                    <span className={styles.sub}>
                      {entry.status === 'overdue'
                        ? t('finance.panel.upcoming_overdue', { date })
                        : `${t(`finance.kind.${entry.kind}`)} · ${date}`}
                    </span>
                  </span>
                  <MoneyAmount
                    amount={entry.expected_amount}
                    currency={entry.currency}
                    kind={entry.kind}
                  />
                </li>
              );
            })}
          </ul>
          <p className={styles.more}>
            <Link to="/finance/income" search={{ period: 'next_30_days' }}>
              {t('finance.panel.upcoming_all_income')}
            </Link>
            <Link to="/finance/expenses" search={{ period: 'next_30_days' }}>
              {t('finance.panel.upcoming_all_expense')}
            </Link>
          </p>
        </>
      )}
    </DataCard>
  );
}

function Savings({ summary }: { summary: FinancialSummary }) {
  const t = useT();
  const { locale } = usePreferences();
  const money = (value: number) => formatMoney(value, summary.currency, locale);
  const { savings_amount, gains_amount, losses_amount } = summary.savings_and_losses;
  return (
    <DataCard title={t('finance.panel.savings')}>
      <ul className={styles.about}>
        <li>
          <span>{t('finance.panel.savings_gain')}</span>
          <strong className={styles.positive}>{money(savings_amount + gains_amount)}</strong>
        </li>
        <li>
          <span>{t('finance.panel.savings_loss')}</span>
          <strong className={styles.negative}>{money(losses_amount)}</strong>
        </li>
      </ul>
    </DataCard>
  );
}

/**
 * Descontos e acréscimos do período por nome, como o servidor agrupou (RN-11, CB-07): o
 * liquidado na cor do texto, com o sinal do sentido, e o previsto abaixo (RF-14).
 */
function Adjustments({ summary }: { summary: FinancialSummary }) {
  const t = useT();
  const { locale } = usePreferences();
  const base_id = useId();
  const rows = summary.adjustments_by_name;
  const groups = (['deduction', 'addition'] as const)
    .map((direction) => ({ direction, items: rows.filter((row) => row.direction === direction) }))
    .filter((group) => group.items.length > 0);
  return (
    <DataCard title={t('finance.panel.adjustments.title')}>
      {groups.length === 0 ? (
        <p className={styles.sub}>{t('finance.panel.adjustments.empty')}</p>
      ) : (
        groups.map(({ direction, items }) => {
          const title_id = `${base_id}-${direction}`;
          return (
            <div key={direction}>
              <h3 id={title_id} className={styles.groupTitle}>
                {t(
                  direction === 'deduction'
                    ? 'finance.panel.adjustments.deductions'
                    : 'finance.panel.adjustments.additions',
                )}
              </h3>
              <ul className={styles.about} aria-labelledby={title_id}>
                {items.map((row) => (
                  <li key={row.name}>
                    <span>{row.name}</span>
                    <div>
                      <span className={styles.figValue}>
                        {adjustmentText(direction, row.settled, summary.currency, locale)}
                      </span>
                      <p className={styles.sub}>
                        {t('finance.panel.of_forecast', {
                          value: formatMoney(row.expected, summary.currency, locale),
                        })}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          );
        })
      )}
    </DataCard>
  );
}

function isEmpty(summary: FinancialSummary): boolean {
  const { income, expense } = summary.totals;
  return (
    summary.balance.accounts.length === 0 &&
    income.forecast === 0 &&
    expense.forecast === 0 &&
    summary.upcoming_bills.length === 0
  );
}

interface Block {
  id: string;
  node: ReactNode;
}

interface PanelCell extends Block {
  zone: 'main' | 'side';
  row: number;
  alone: boolean;
}

/** Pareia o N-ésimo bloco da zona principal com o da lateral; a ordem de saída é a de leitura (RF-09). */
function panelCells(main: readonly Block[], side: readonly Block[]): PanelCell[] {
  const cellsOf = (blocks: readonly Block[], zone: 'main' | 'side', other: readonly Block[]) =>
    blocks.map((block, index) => ({
      ...block,
      zone,
      row: index + 1,
      alone: index >= other.length,
    }));
  return [...cellsOf(main, 'main', side), ...cellsOf(side, 'side', main)];
}

function PanelZones({ label, cells }: { label: string; cells: readonly PanelCell[] }) {
  return (
    <section className={styles.zones} aria-label={label}>
      {cells.map((cell) => (
        <div
          key={cell.id}
          className={styles.cell}
          data-zone={cell.zone}
          data-row={cell.row}
          {...(cell.alone ? { 'data-alone': '' } : {})}
        >
          {cell.node}
        </div>
      ))}
    </section>
  );
}

/** Aba Painel: tudo vem do resumo do servidor; a tela não recalcula (RF-35, PD-58, RN-01). */
export function FinancePanelScreen() {
  const t = useT();
  const navigate = useNavigate();
  const { time_zone } = usePreferences();
  const { search } = useListSearch(panelSearchSchema);
  const range = resolveFinancePeriod(search, new Date(), time_zone);
  const query = useFinancialSummary(range);

  if (query.isPending) return <LoadingState label={t('common.loading')} />;
  if (query.isError) {
    const failed = (title: string) => (
      <DataCard title={title}>
        <ErrorState
          title={t('finance.panel.error_title')}
          description={t('finance.panel.error_description')}
          retryLabel={t('common.retry')}
          onRetry={() => {
            void query.refetch();
          }}
        />
      </DataCard>
    );
    return (
      <PanelZones
        label={t('finance.tabs.panel')}
        cells={panelCells(
          [
            { id: 'closing', node: failed(t('finance.panel.closing_short')) },
            { id: 'monthly', node: failed(t('finance.panel.monthly')) },
            { id: 'where', node: failed(t('finance.panel.where_it_went')) },
            { id: 'expected', node: failed(t('finance.panel.expected_vs_settled')) },
          ],
          [
            { id: 'balance', node: failed(t('finance.panel.balance')) },
            { id: 'upcoming', node: failed(t('finance.panel.upcoming')) },
            { id: 'savings', node: failed(t('finance.panel.savings')) },
            { id: 'adjustments', node: failed(t('finance.panel.adjustments.title')) },
          ],
        )}
      />
    );
  }
  const summary = query.data;
  if (isEmpty(summary)) {
    return (
      <EmptyState
        title={t('finance.panel.empty_title')}
        description={t('finance.panel.empty_description')}
        action={
          <Button
            variant="primary"
            onClick={() => {
              void navigate({ to: '/finance/transactions/new', search: { kind: 'expense' } });
            }}
          >
            {t('finance.new_record.button')}
          </Button>
        }
      />
    );
  }
  const main: Block[] = [
    { id: 'closing', node: <Closing summary={summary} search={search} /> },
    { id: 'monthly', node: <Monthly summary={summary} search={search} /> },
    { id: 'where', node: <WhereItWent summary={summary} search={search} /> },
    { id: 'expected', node: <ExpectedVsSettled summary={summary} /> },
  ];
  const side: Block[] = [
    { id: 'balance', node: <Balance summary={summary} /> },
    { id: 'upcoming', node: <Upcoming summary={summary} /> },
    { id: 'savings', node: <Savings summary={summary} /> },
    { id: 'adjustments', node: <Adjustments summary={summary} /> },
  ];
  return <PanelZones label={t('finance.tabs.panel')} cells={panelCells(main, side)} />;
}
