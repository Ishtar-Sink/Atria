import {
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  LoadingState,
  MenuButton,
  SelectField,
  Tabs,
  type MenuItem,
} from '@atria/ui';
import { useNavigate } from '@tanstack/react-router';
import { useState, type ReactNode } from 'react';
import { z } from 'zod';
import { formatMoney } from '../../../shared/format/intl';
import { useT } from '../../../shared/i18n/i18n';
import { StickyPageHeader } from '../../../shared/layout/sticky-page-header';
import { BackLink } from '../../../shared/navigation/back-link';
import { usePreferences } from '../../../shared/preferences/preferences-context';
import { pushToast } from '../../../shared/toast/toast-store';
import { useListSearch } from '../../../shared/url-state/use-list-search';
import { FinanceDialog } from '../components/finance-dialog';
import { FINANCE_REPORTS, reportKey } from '../components/finance-shell';
import styles from '../components/finance.module.css';
import { MoreIcon, PencilIcon } from '../components/icons';
import { LoadMore } from '../components/list-toolbar';
import { DataCard, DetailGrid, Facts, RecordCard } from '../components/record-card';
import { TransactionRow } from '../components/transaction-row';
import { problemCode } from '../hooks/finance-cache';
import {
  canDelete,
  useAccount,
  useAccounts,
  useDeleteAccount,
  type Account,
} from '../hooks/use-accounts';
import { useCategories } from '../hooks/use-categories';
import { listItemKey, useTransactions } from '../hooks/use-transactions';

/** Aba que o app acrescenta depois das abas próprias da tela (Conexões, TASK-35). */
export interface FinanceExtraTab<T> {
  id: string;
  label: string;
  render: (entity: T) => ReactNode;
}

/** `overview`, `transactions` ou o id de uma aba extra. */
export type AccountDetailTab = string;

const detail_tab_search = z.object({ tab: z.string().catch('overview') });

export interface DetailTabsProps<T> {
  label: string;
  overview_label: string;
  overview: ReactNode;
  entity: T;
  extra_tabs: readonly FinanceExtraTab<T>[];
}

/** Sem abas extras, a visão geral aparece sozinha; com elas, ganha a barra de abas na URL (PD-59). */
export function DetailTabs<T>({
  label,
  overview_label,
  overview,
  entity,
  extra_tabs,
}: DetailTabsProps<T>) {
  const { search, setSearch } = useListSearch(detail_tab_search);
  if (extra_tabs.length === 0) return <>{overview}</>;
  const tabs = [
    { id: 'overview', label: overview_label, panel: overview },
    ...extra_tabs.map((extra) => ({
      id: extra.id,
      label: extra.label,
      panel: extra.render(entity),
    })),
  ];
  const current = tabs.some((tab) => tab.id === search.tab) ? search.tab : 'overview';
  return (
    <Tabs
      label={label}
      tabs={tabs}
      value={current}
      onChange={(tab) => {
        setSearch({ tab });
      }}
    />
  );
}

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
  return (
    <DetailGrid
      main={
        <DataCard title={t('finance.account_detail.data')}>
          <Facts
            items={[
              { label: t('finance.account_detail.balance'), value: money(account.balance_amount) },
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
  extra_tabs?: readonly FinanceExtraTab<Account>[];
}

/**
 * Detalhe da conta: "Editar" e "Mais ações"; a exclusão de uma conta com movimentações pede a
 * conta de destino (PD-14, PD-59, PD-61, RF-05).
 */
export function AccountDetailScreen({
  account_id,
  tab,
  on_tab_change,
  extra_tabs = [],
}: AccountDetailScreenProps) {
  const t = useT();
  const navigate = useNavigate();
  const account = useAccount(account_id);
  const remove = useDeleteAccount();
  const accounts = useAccounts();
  const [step, setStep] = useState<'closed' | 'confirm' | 'destination'>('closed');
  const [destination, setDestination] = useState('');
  const [missing, setMissing] = useState(false);

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
  const others = (accounts.data ?? []).filter((item) => item.id !== data.id);

  async function onDelete(move_to?: string) {
    try {
      await remove.mutateAsync({ id: data.id, ...(move_to ? { move_to } : {}) });
      setStep('closed');
      const target = others.find((item) => item.id === move_to);
      pushToast(
        target
          ? {
              tone: 'success',
              message_key: 'finance.account_detail.moved',
              params: { name: target.name },
            }
          : { tone: 'success', message_key: 'finance.account_detail.deleted' },
      );
      await navigate({ to: '/finance/accounts' });
    } catch (error) {
      // Com movimentações, o mesmo diálogo pede a conta de destino; a moeda diferente aparece nele (CB-03).
      const code = problemCode(error);
      setStep(
        code === 'account_has_transactions' || code === 'currency_mismatch'
          ? 'destination'
          : 'closed',
      );
    }
  }

  const tab_ids = ['overview', 'transactions', ...extra_tabs.map((extra) => extra.id)];
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
              setStep('confirm');
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
        value={tab_ids.includes(tab) ? tab : 'overview'}
        onChange={on_tab_change}
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
          ...extra_tabs.map((extra) => ({
            id: extra.id,
            label: extra.label,
            panel: extra.render(data),
          })),
        ]}
      />
      <ConfirmDialog
        open={step === 'confirm'}
        title={t('finance.account_detail.delete_title')}
        description={t('finance.account_detail.delete_description', { name: data.name })}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        onConfirm={() => {
          void onDelete();
        }}
        onCancel={() => {
          setStep('closed');
        }}
      />
      <FinanceDialog
        open={step === 'destination'}
        title={t('finance.account_detail.delete_title')}
        cancel_label={t('common.cancel')}
        onCancel={() => {
          setStep('closed');
          setMissing(false);
          remove.reset();
        }}
        actions={
          <Button
            variant="primary"
            loading={remove.isPending}
            disabled={others.length === 0}
            onClick={() => {
              if (destination === '') {
                setMissing(true);
                return;
              }
              void onDelete(destination);
            }}
          >
            {t('finance.account_detail.move_and_delete')}
          </Button>
        }
      >
        <p>{t('finance.account_detail.has_transactions')}</p>
        {others.length === 0 ? (
          <p>{t('finance.account_detail.no_destination')}</p>
        ) : (
          <SelectField
            label={t('finance.account_detail.destination')}
            value={destination}
            onChange={(value) => {
              setDestination(value);
              setMissing(false);
              remove.reset();
            }}
            options={others.map((item) => ({ value: item.id, label: item.name }))}
            {...(missing ? { error: t('finance.account_detail.destination_required') } : {})}
          />
        )}
        {remove.state === 'currency_mismatch' ? (
          <p role="alert" className={styles.formError}>
            {t('finance.errors.currency_mismatch')}
          </p>
        ) : null}
      </FinanceDialog>
    </div>
  );
}
