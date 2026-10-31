import { Button, EmptyState, ErrorState, LoadingState, SelectField } from '@atria/ui';
import { Link, useNavigate, useRouterState } from '@tanstack/react-router';
import { useEffect } from 'react';
import { z } from 'zod';
import { formatDate, formatMoney } from '../../../shared/format/intl';
import { useT } from '../../../shared/i18n/i18n';
import { rememberListLocation } from '../../../shared/navigation/back-target';
import { usePreferences } from '../../../shared/preferences/preferences-context';
import { useListSearch } from '../../../shared/url-state/use-list-search';
import styles from '../components/finance.module.css';
import { ListToolbar, LoadMore } from '../components/list-toolbar';
import { useAccounts } from '../hooks/use-accounts';
import { SEARCH_MAX } from '../hooks/use-transactions';
import { useTransfers } from '../hooks/use-transfers';
import { financePeriodSearchSchema, resolveFinancePeriod, searchText } from '../lib/finance-period';

const period_shape = financePeriodSearchSchema.shape;

export const transfersSearchSchema = z.object({
  period: period_shape.period.catch('this_month'),
  from: period_shape.from.catch(undefined),
  to: period_shape.to.catch(undefined),
  account_id: searchText(),
  q: searchText(SEARCH_MAX),
  view: z.enum(['list', 'grid']).catch('list'),
});

/** Aba Transferências, no período global (PD-48, PD-55), com a busca no servidor (DEC-005). */
export function TransfersScreen() {
  const t = useT();
  const navigate = useNavigate();
  const { locale, time_zone } = usePreferences();
  const { search, setSearch } = useListSearch(transfersSearchSchema, {
    view_key: 'finance:transfers',
  });
  const href = useRouterState({ select: (state) => state.location.href });
  const accounts = useAccounts();
  const range = resolveFinancePeriod(search, new Date(), time_zone);
  const list = useTransfers({
    account_id: search.account_id,
    q: search.q,
    ...(range ? { from: range.from, to: range.to } : {}),
  });

  useEffect(() => {
    rememberListLocation('finance', href);
  }, [href]);

  const names = new Map((accounts.data ?? []).map((item) => [item.id, item.name]));
  const searching = search.q.trim() !== '';

  function body() {
    if (list.isError) {
      return (
        <ErrorState
          title={t('finance.list.error_title')}
          description={t('finance.list.error_description')}
          retryLabel={t('common.retry')}
          onRetry={() => {
            void list.refetch();
          }}
        />
      );
    }
    if (list.isPending) return <LoadingState label={t('common.loading')} />;
    if (list.items.length === 0) {
      if (searching) {
        return (
          <EmptyState
            title={t('finance.list.no_results_title', { search: search.q.trim() })}
            description={t('finance.list.no_results_description')}
            action={
              <Button
                onClick={() => {
                  setSearch({ q: '' });
                }}
              >
                {t('finance.list.clear_search')}
              </Button>
            }
          />
        );
      }
      return (
        <EmptyState
          title={t('finance.transfers.empty_title')}
          description={t('finance.transfers.empty_description')}
          action={
            <Button
              variant="primary"
              onClick={() => {
                void navigate({ to: '/finance/transfers/new' });
              }}
            >
              {t('finance.new_record.button')}
            </Button>
          }
        />
      );
    }
    return (
      <>
        <ul className={search.view === 'grid' ? styles.grid : styles.list}>
          {list.items.map((item) => (
            <li key={item.id} className={styles.row}>
              <div className={styles.rowText}>
                <Link
                  to="/finance/transfers/$transferId"
                  params={{ transferId: item.id }}
                  className={styles.rowTitle}
                >
                  {t('finance.transfers.route', {
                    from: names.get(item.from_account_id) ?? '–',
                    to: names.get(item.to_account_id) ?? '–',
                  })}
                </Link>
                <span className={styles.rowSub}>
                  {[formatDate(item.transferred_on, locale, 'UTC'), item.description]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </div>
              <div className={styles.rowMeta}>
                <span className={styles.rowEnd}>
                  {formatMoney(item.amount, item.currency, locale)}
                </span>
              </div>
            </li>
          ))}
        </ul>
        <LoadMore
          visible={list.hasNextPage}
          loading={list.isFetchingNextPage}
          onClick={() => {
            void list.fetchNextPage();
          }}
        />
      </>
    );
  }

  return (
    <section className={styles.screen} aria-label={t('finance.tabs.transfers')}>
      <ListToolbar
        search={search.q}
        onSearch={(q) => {
          setSearch({ q });
        }}
        search_placeholder={t('finance.transfers.search_placeholder')}
        view={search.view}
        onView={(view) => {
          setSearch({ view });
        }}
        filters={
          <SelectField
            label={t('finance.transfers.account')}
            value={search.account_id}
            onChange={(account_id) => {
              setSearch({ account_id });
            }}
            options={[
              { value: '', label: t('finance.list.all') },
              ...(accounts.data ?? []).map((item) => ({ value: item.id, label: item.name })),
            ]}
          />
        }
      />
      {body()}
    </section>
  );
}
