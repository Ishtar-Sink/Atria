import {
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  LoadingState,
  MenuButton,
  Tabs,
  type MenuItem,
} from '@atria/ui';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { formatMoney } from '../../../shared/format/intl';
import { useT } from '../../../shared/i18n/i18n';
import { StickyPageHeader } from '../../../shared/layout/sticky-page-header';
import { BackLink } from '../../../shared/navigation/back-link';
import { usePreferences } from '../../../shared/preferences/preferences-context';
import { pushToast } from '../../../shared/toast/toast-store';
import { FinanceDialog } from '../components/finance-dialog';
import { FINANCE_REPORTS, reportKey } from '../components/finance-shell';
import styles from '../components/finance.module.css';
import { MoreIcon, PencilIcon } from '../components/icons';
import { LoadMore } from '../components/list-toolbar';
import { DataCard, DetailGrid, Facts, RecordCard } from '../components/record-card';
import { TransactionRow } from '../components/transaction-row';
import { canDelete, useAccount, useDeleteAccount, type Account } from '../hooks/use-accounts';
import { useCategories } from '../hooks/use-categories';
import { listItemKey, useTransactions } from '../hooks/use-transactions';

export type AccountDetailTab = 'overview' | 'transactions';

/** Relatório do módulo já filtrado pela conta, em "Qualquer período" (PD-61). */
export function accountReportHref(report: string, account_id: string): string {
  return `/reports/${report}?account_id=${encodeURIComponent(account_id)}&period=all&run=1`;
}

function AccountTransactions({ account }: { account: Account }) {
  const t = useT();
  const list = useTransactions({ account_id: account.id });
  const categories = useCategories();
  const category_names = new Map((categories.data ?? []).map((item) => [item.id, item.name]));
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
    return (
      <EmptyState
        title={t('finance.account_detail.transactions_empty')}
        description={t('finance.account_detail.transactions_empty_description')}
      />
    );
  }
  return (
    <>
      <ul className={styles.list}>
        {list.items.map((item) => (
          <TransactionRow
            key={listItemKey(item)}
            item={item}
            account_name={account.name}
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

function Overview({ account }: { account: Account }) {
  const t = useT();
  const { locale } = usePreferences();
  const money = (value: number) => (
    <span className={styles.num}>{formatMoney(value, account.currency, locale)}</span>
  );
  const card = account.kind === 'credit_card';
  return (
    <DetailGrid
      main={
        <DataCard title={t('finance.account_detail.data')}>
          <Facts
            items={[
              {
                label: t('finance.account_detail.kind'),
                value: t(`finance.account_kind.${account.kind}`),
              },
              { label: t('finance.account_detail.balance'), value: money(account.balance_amount) },
              card && account.credit_limit_amount != null
                ? {
                    label: t('finance.account_detail.credit_limit'),
                    value: money(account.credit_limit_amount),
                  }
                : null,
              card
                ? {
                    label: t('finance.account_detail.closing_due'),
                    value: t('finance.account_detail.closing_due_value', {
                      closing: account.closing_day ?? '–',
                      due: account.due_day ?? '–',
                    }),
                  }
                : null,
            ]}
          />
          {canDelete(account) ? null : (
            <p className={styles.callout}>{t('finance.account_detail.default_hint')}</p>
          )}
        </DataCard>
      }
      aside={
        <RecordCard
          visibility={account.visibility}
          created_at={account.created_at}
          updated_at={account.updated_at}
        />
      }
    />
  );
}

export interface AccountDetailScreenProps {
  account_id: string;
  tab: AccountDetailTab;
  on_tab_change: (tab: AccountDetailTab) => void;
}

/** Detalhe da conta: "Editar", "Ver fatura" no cartão e "Mais ações" (PD-14, PD-59, PD-61). */
export function AccountDetailScreen({ account_id, tab, on_tab_change }: AccountDetailScreenProps) {
  const t = useT();
  const navigate = useNavigate();
  const account = useAccount(account_id);
  const remove = useDeleteAccount();
  const [confirming, setConfirming] = useState(false);
  const [blocked, setBlocked] = useState(false);

  if (account.isError) {
    return (
      <ErrorState
        title={t('finance.detail.error_title')}
        description={t('finance.detail.error_description')}
        retryLabel={t('common.retry')}
        onRetry={() => {
          void account.refetch();
        }}
      />
    );
  }
  if (!account.data) return <LoadingState label={t('common.loading')} />;
  const data = account.data;

  async function onDelete() {
    setConfirming(false);
    try {
      await remove.mutateAsync(data.id);
      pushToast({ tone: 'success', message_key: 'finance.account_detail.deleted' });
      await navigate({ to: '/finance/accounts' });
    } catch {
      // A recusa já desfez a exclusão; a conta com movimentações ganha a explicação.
      setBlocked(true);
    }
  }

  const items: MenuItem[] = [
    ...FINANCE_REPORTS.map((report) => ({
      id: report,
      label: t('finance.account_detail.reports', { name: t(reportKey(report)) }),
      href: accountReportHref(report, data.id),
    })),
    ...(canDelete(data)
      ? [
          {
            id: 'delete',
            label: t('common.delete'),
            tone: 'danger' as const,
            onSelect: () => {
              setConfirming(true);
            },
          },
        ]
      : []),
  ];

  return (
    <div className={styles.screen}>
      <StickyPageHeader
        back={<BackLink module="finance" fallback_to="/finance/accounts" />}
        eyebrow={t('finance.account_detail.eyebrow')}
        title={data.name}
        subtitle={t(`finance.account_kind.${data.kind}`)}
        actions={
          <div className={styles.actions}>
            <Button
              onClick={() => {
                void navigate({
                  to: '/finance/accounts/$accountId/edit',
                  params: { accountId: data.id },
                });
              }}
            >
              <PencilIcon />
              {t('common.edit')}
            </Button>
            {data.kind === 'credit_card' ? (
              <Button
                onClick={() => {
                  void navigate({ to: '/finance/statements', search: { card_id: data.id } });
                }}
              >
                {t('finance.account_detail.view_statement')}
              </Button>
            ) : null}
            <MenuButton
              label={t('common.more_actions')}
              trigger={<MoreIcon />}
              placement="bottom-end"
              items={items}
            />
          </div>
        }
      />
      <Tabs
        label={t('finance.account_detail.tabs_label')}
        value={tab}
        onChange={(next) => {
          on_tab_change(next === 'transactions' ? 'transactions' : 'overview');
        }}
        tabs={[
          {
            id: 'overview',
            label: t('finance.account_detail.overview'),
            panel: <Overview account={data} />,
          },
          {
            id: 'transactions',
            label: t('finance.account_detail.transactions'),
            panel: <AccountTransactions account={data} />,
          },
        ]}
      />
      <ConfirmDialog
        open={confirming}
        title={t('finance.account_detail.delete_title')}
        description={t('finance.account_detail.delete_description', { name: data.name })}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        onConfirm={() => {
          void onDelete();
        }}
        onCancel={() => {
          setConfirming(false);
        }}
      />
      <FinanceDialog
        open={blocked && remove.state === 'has_transactions'}
        title={t('finance.account_detail.has_transactions_title')}
        cancel_label={t('common.cancel')}
        onCancel={() => {
          setBlocked(false);
        }}
        actions={
          <>
            <Button
              onClick={() => {
                setBlocked(false);
                void navigate({
                  to: '/finance/accounts/$accountId/edit',
                  params: { accountId: data.id },
                });
              }}
            >
              {t('finance.account_detail.rename')}
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setBlocked(false);
                on_tab_change('transactions');
              }}
            >
              {t('finance.account_detail.view_transactions')}
            </Button>
          </>
        }
      >
        <p>{t('finance.account_detail.has_transactions')}</p>
      </FinanceDialog>
    </div>
  );
}
