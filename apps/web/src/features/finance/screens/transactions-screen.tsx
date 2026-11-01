import { Autocomplete, Button, EmptyState, ErrorState, LoadingState, SelectField } from '@atria/ui';
import { useNavigate, useRouterState } from '@tanstack/react-router';
import { useEffect } from 'react';
import { z } from 'zod';
import { useT } from '../../../shared/i18n/i18n';
import { rememberListLocation } from '../../../shared/navigation/back-target';
import { usePreferences } from '../../../shared/preferences/preferences-context';
import { useListSearch } from '../../../shared/url-state/use-list-search';
import styles from '../components/finance.module.css';
import { Chips, ListToolbar, LoadMore } from '../components/list-toolbar';
import { TransactionRow } from '../components/transaction-row';
import type { TransactionKind } from '../hooks/finance-cache';
import { useAccounts } from '../hooks/use-accounts';
import { useCategories } from '../hooks/use-categories';
import { listItemKey, SEARCH_MAX, useTransactions } from '../hooks/use-transactions';
import { financePeriodSearchSchema, resolveFinancePeriod, searchText } from '../lib/finance-period';

const period_shape = financePeriodSearchSchema.shape;

export const transactionsSearchSchema = z.object({
  period: period_shape.period.catch('this_month'),
  from: period_shape.from.catch(undefined),
  to: period_shape.to.catch(undefined),
  repetition: z.enum(['all', 'recurring', 'one_off']).catch('all'),
  account_id: searchText(),
  category_id: searchText(),
  q: searchText(SEARCH_MAX),
  view: z.enum(['list', 'grid']).catch('list'),
});

export interface TransactionsScreenProps {
  kind: TransactionKind;
}

/** Abas Entradas e Saídas: uma tela parametrizada pelo tipo (PD-48, PD-52, DEC-005). */
export function TransactionsScreen({ kind }: TransactionsScreenProps) {
  const t = useT();
  const navigate = useNavigate();
  const { time_zone } = usePreferences();
  const { search, setSearch } = useListSearch(transactionsSearchSchema, {
    view_key: `finance:${kind}`,
  });
  const href = useRouterState({ select: (state) => state.location.href });
  const accounts = useAccounts();
  const categories = useCategories(kind);
  const range = resolveFinancePeriod(search, new Date(), time_zone);
  const list = useTransactions({
    kind,
    repetition: search.repetition,
    account_id: search.account_id,
    category_id: search.category_id,
    q: search.q,
    ...(range ? { from: range.from, to: range.to } : {}),
  });

  useEffect(() => {
    rememberListLocation('finance', href);
  }, [href]);

  const account_names = new Map((accounts.data ?? []).map((item) => [item.id, item.name]));
  const category_names = new Map((categories.data ?? []).map((item) => [item.id, item.name]));
  const searching = search.q.trim() !== '';
  const filtered =
    search.repetition !== 'all' || search.account_id !== '' || search.category_id !== '';

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
      if (filtered) {
        return (
          <EmptyState
            title={t('finance.list.filtered_empty_title')}
            description={t('finance.list.filtered_empty_description')}
          />
        );
      }
      return (
        <EmptyState
          title={t('finance.transactions.empty_title')}
          description={t('finance.transactions.empty_description')}
          action={
            <Button
              variant="primary"
              onClick={() => {
                void navigate({ to: '/finance/transactions/new', search: { kind } });
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
            <TransactionRow
              key={listItemKey(item)}
              item={item}
              account_name={account_names.get(item.account_id)}
              category_name={item.category_id ? category_names.get(item.category_id) : undefined}
            />
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
    <section
      className={styles.screen}
      aria-label={t(kind === 'income' ? 'finance.tabs.income' : 'finance.tabs.expenses')}
    >
      <ListToolbar
        search={search.q}
        onSearch={(q) => {
          setSearch({ q });
        }}
        search_placeholder={t('finance.transactions.search_placeholder')}
        view={search.view}
        onView={(view) => {
          setSearch({ view });
        }}
        filters={
          <>
            <Chips
              legend={t('finance.transactions.repetition')}
              value={search.repetition}
              options={[
                { value: 'all', label: t('finance.transactions.repetition_all') },
                { value: 'recurring', label: t('finance.transactions.repetition_recurring') },
                { value: 'one_off', label: t('finance.transactions.repetition_one_off') },
              ]}
              onChange={(repetition) => {
                setSearch({ repetition });
              }}
            />
            <SelectField
              label={t('finance.transactions.account')}
              value={search.account_id}
              onChange={(account_id) => {
                setSearch({ account_id });
              }}
              options={[
                { value: '', label: t('finance.list.all') },
                ...(accounts.data ?? []).map((item) => ({ value: item.id, label: item.name })),
              ]}
            />
            <Autocomplete
              label={t('finance.transactions.category')}
              value={search.category_id}
              onChange={(category_id) => {
                setSearch({ category_id: category_id ?? '' });
              }}
              options={[
                { value: '', label: t('finance.list.all') },
                ...(categories.data ?? []).map((item) => ({ value: item.id, label: item.name })),
              ]}
              empty_text={t('common.category_not_found')}
            />
          </>
        }
      />
      {body()}
    </section>
  );
}
