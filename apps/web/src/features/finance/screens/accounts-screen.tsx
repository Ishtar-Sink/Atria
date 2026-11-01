import { Badge, EmptyState, ErrorState, ItemSwatch, LoadingState } from '@atria/ui';
import { Link, useRouterState } from '@tanstack/react-router';
import { useEffect } from 'react';
import { z } from 'zod';
import { formatMoney } from '../../../shared/format/intl';
import { useT } from '../../../shared/i18n/i18n';
import { rememberListLocation } from '../../../shared/navigation/back-target';
import { usePreferences } from '../../../shared/preferences/preferences-context';
import { useListSearch } from '../../../shared/url-state/use-list-search';
import styles from '../components/finance.module.css';
import { Chips, ListToolbar } from '../components/list-toolbar';
import { useAccounts, type Account } from '../hooks/use-accounts';
import { searchText } from '../lib/finance-period';

export const accountsSearchSchema = z.object({
  visibility: z.enum(['all', 'personal', 'shared']).catch('all'),
  q: searchText(100),
  view: z.enum(['list', 'grid']).catch('list'),
});

function matches(account: Account, visibility: string, q: string): boolean {
  if (visibility !== 'all' && account.visibility !== visibility) return false;
  const needle = q.trim().toLocaleLowerCase();
  return needle === '' || account.name.toLocaleLowerCase().includes(needle);
}

/** Aba Contas: contas com o saldo, filtro por visibilidade, busca e visualização. */
export function AccountsScreen() {
  const t = useT();
  const { locale } = usePreferences();
  const { search, setSearch } = useListSearch(accountsSearchSchema, {
    view_key: 'finance:accounts',
  });
  const href = useRouterState({ select: (state) => state.location.href });
  const accounts = useAccounts();

  useEffect(() => {
    rememberListLocation('finance', href);
  }, [href]);

  const items = (accounts.data ?? []).filter((account) =>
    matches(account, search.visibility, search.q),
  );
  const filtered = search.visibility !== 'all' || search.q !== '';

  function body() {
    if (accounts.isError) {
      return (
        <ErrorState
          title={t('finance.list.error_title')}
          description={t('finance.list.error_description')}
          retryLabel={t('common.retry')}
          onRetry={() => {
            void accounts.refetch();
          }}
        />
      );
    }
    if (accounts.isPending) return <LoadingState label={t('common.loading')} />;
    if (items.length === 0) {
      return filtered ? (
        <EmptyState
          title={t('finance.list.filtered_empty_title')}
          description={t('finance.list.filtered_empty_description')}
        />
      ) : (
        <EmptyState
          title={t('finance.accounts.empty_title')}
          description={t('finance.accounts.empty_description')}
          action={
            <Link to="/finance/accounts/new" className={styles.inlineLink}>
              {t('finance.accounts.new')}
            </Link>
          }
        />
      );
    }
    return (
      <ul className={search.view === 'grid' ? styles.grid : styles.list}>
        {items.map((account) => (
          <li key={account.id} className={styles.row}>
            <div className={styles.rowMain}>
              <ItemSwatch id={account.id} className={styles.swatch} />
              <div className={styles.rowText}>
                <Link
                  to="/finance/accounts/$accountId"
                  params={{ accountId: account.id }}
                  className={styles.rowTitle}
                >
                  {account.name}
                </Link>
                <span className={styles.rowSub}>
                  {t(`finance.visibility.${account.visibility}`)}
                </span>
              </div>
            </div>
            <div className={styles.rowMeta}>
              <span className={styles.rowEnd}>
                {formatMoney(account.balance_amount, account.currency, locale)}
              </span>
              {account.is_default ? (
                <div className={styles.badges}>
                  <Badge tone="accent">{t('finance.accounts.default')}</Badge>
                </div>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <section className={styles.screen} aria-label={t('finance.tabs.accounts')}>
      <ListToolbar
        search={search.q}
        onSearch={(q) => {
          setSearch({ q });
        }}
        search_placeholder={t('finance.accounts.search_placeholder')}
        view={search.view}
        onView={(view) => {
          setSearch({ view });
        }}
        filters={
          <Chips
            legend={t('finance.accounts.visibility_filter')}
            value={search.visibility}
            options={[
              { value: 'all', label: t('finance.accounts.visibility_all') },
              { value: 'personal', label: t('finance.accounts.visibility_personal') },
              { value: 'shared', label: t('finance.accounts.visibility_shared') },
            ]}
            onChange={(visibility) => {
              setSearch({ visibility });
            }}
          />
        }
      />
      {body()}
    </section>
  );
}
