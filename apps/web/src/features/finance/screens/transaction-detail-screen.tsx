import { Button, ConfirmDialog, ErrorState, LoadingState, MenuButton } from '@atria/ui';
import { Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { formatDate, formatMoney } from '../../../shared/format/intl';
import { useT } from '../../../shared/i18n/i18n';
import { StickyPageHeader } from '../../../shared/layout/sticky-page-header';
import { BackLink } from '../../../shared/navigation/back-link';
import { usePreferences } from '../../../shared/preferences/preferences-context';
import { pushToast } from '../../../shared/toast/toast-store';
import { AdjustmentsBreakdown, breakdownItems } from '../components/adjustments-breakdown';
import styles from '../components/finance.module.css';
import { DetailTabs, type FinanceExtraTab } from './account-detail-screen';
import { MoreIcon, PencilIcon } from '../components/icons';
import { DataCard, DetailGrid, Facts, RecordCard } from '../components/record-card';
import { SettlementCard } from '../components/settlement-card';
import { useTransactionTitle } from '../components/transaction-row';
import { useIdempotencyKey } from '../hooks/finance-cache';
import { useAccount } from '../hooks/use-accounts';
import { useCategory } from '../hooks/use-categories';
import { useRecurringTransaction } from '../hooks/use-recurring-transactions';
import {
  useDeleteTransaction,
  type Transaction,
  useSettleTransaction,
  useTransaction,
  useUndoSettlement,
} from '../hooks/use-transactions';
import { todayInTimeZone } from '../lib/finance-period';

export interface TransactionDetailScreenProps {
  transaction_id: string;
  extra_tabs?: readonly FinanceExtraTab<Transaction>[];
}

/**
 * Detalhe da movimentação, com "Editar", "Desfazer liquidação" e a liquidação (PD-14, PD-59); a
 * cópia de uma recorrência só oferece "Desfazer liquidação" (RF-04).
 */
export function TransactionDetailScreen({
  transaction_id,
  extra_tabs = [],
}: TransactionDetailScreenProps) {
  const t = useT();
  const navigate = useNavigate();
  const { locale, time_zone } = usePreferences();
  const title = useTransactionTitle();
  const query = useTransaction(transaction_id);
  const data = query.data;
  const account = useAccount(data?.account_id);
  const category = useCategory(data?.category_id ?? undefined);
  const recurrence = useRecurringTransaction(data?.generated_from ?? undefined);
  const settle = useSettleTransaction();
  const undo = useUndoSettlement(transaction_id, { time_zone });
  const remove = useDeleteTransaction();
  const idempotency = useIdempotencyKey();
  const [confirm, setConfirm] = useState<'delete' | 'undo' | null>(null);

  if (query.isError) {
    return (
      <ErrorState
        title={t('finance.detail.error_title')}
        description={t('finance.detail.error_description')}
        retryLabel={t('common.retry')}
        onRetry={() => {
          void query.refetch();
        }}
      />
    );
  }
  if (!data) return <LoadingState label={t('common.loading')} />;
  const item = data;
  const today = todayInTimeZone(new Date(), time_zone);
  const settled = item.status === 'settled' && item.settled_amount != null && item.settled_at;
  const copy = Boolean(item.generated_from);
  const money = (value: number) => (
    <span className={styles.num}>{formatMoney(value, item.currency, locale)}</span>
  );
  const fallback = item.kind === 'income' ? '/finance/income' : '/finance/expenses';
  const settled_items = item.settled_adjustments ?? [];

  // A aba só existe com itens; a liquidação continua na visão geral (RN-11, decisão 16).
  const adjustments_tab: FinanceExtraTab<Transaction> | null =
    item.adjustments.length > 0 || settled_items.length > 0
      ? {
          id: 'adjustments',
          label: t('finance.adjustments.title'),
          render: () => (
            <DataCard title={t('finance.adjustments.title')}>
              <h3 className={styles.breakdownTitle}>{t('finance.adjustments.expected')}</h3>
              <AdjustmentsBreakdown
                currency={item.currency}
                gross_amount={item.gross_amount}
                items={breakdownItems(item.adjustments)}
                net_amount={item.expected_amount}
                net_label={t('finance.adjustments.net_expected')}
              />
              {settled && settled_items.length > 0 ? (
                <>
                  <h3 className={styles.breakdownTitle}>{t('finance.adjustments.settled')}</h3>
                  <AdjustmentsBreakdown
                    currency={item.currency}
                    gross_amount={item.settled_gross_amount ?? item.settled_amount ?? 0}
                    items={breakdownItems(settled_items)}
                    net_amount={item.settled_amount ?? 0}
                    net_label={t('finance.adjustments.net_settled')}
                  />
                </>
              ) : null}
            </DataCard>
          ),
        }
      : null;

  function undoNow() {
    undo.mutate(item, {
      onSuccess: () => {
        pushToast({ tone: 'warning', message_key: 'finance.transaction_detail.undone' });
        if (item.generated_from) {
          void navigate({
            to: '/finance/recurring-transactions/$recurrenceId',
            params: { recurrenceId: item.generated_from },
          });
        }
      },
    });
  }

  async function deleteNow() {
    setConfirm(null);
    try {
      await remove.mutateAsync({ id: item.id });
      pushToast({ tone: 'success', message_key: 'finance.transaction_detail.deleted' });
      await navigate({ to: fallback });
    } catch {
      // A recusa já restaurou a movimentação e avisou.
    }
  }

  return (
    <div className={styles.screen}>
      <StickyPageHeader
        back={<BackLink module="finance" fallback_to={fallback} />}
        eyebrow={t(`finance.transaction_detail.eyebrow_${item.kind}`)}
        title={title(item)}
        subtitle={[
          t(`finance.status.${item.status}`),
          formatDate(item.effective_date, locale, 'UTC'),
        ].join(' · ')}
        actions={
          <div className={styles.actions}>
            <Button
              onClick={() => {
                void navigate({
                  to: '/finance/transactions/$transactionId/edit',
                  params: { transactionId: item.id },
                });
              }}
            >
              <PencilIcon />
              {t('common.edit')}
            </Button>
            {settled ? (
              <Button
                variant="muted"
                loading={undo.isPending}
                onClick={() => {
                  if (copy) setConfirm('undo');
                  else undoNow();
                }}
              >
                {t('finance.transaction_detail.undo_settlement')}
              </Button>
            ) : null}
            {copy ? null : (
              <MenuButton
                label={t('common.more_actions')}
                trigger={<MoreIcon />}
                placement="bottom-end"
                items={[
                  {
                    id: 'delete',
                    label: t('common.delete'),
                    tone: 'danger',
                    onSelect: () => {
                      setConfirm('delete');
                    },
                  },
                ]}
              />
            )}
          </div>
        }
      />
      <DetailTabs
        label={t('finance.transaction_detail.tabs_label')}
        overview_label={t('finance.account_detail.overview')}
        entity={item}
        extra_tabs={adjustments_tab ? [adjustments_tab, ...extra_tabs] : extra_tabs}
        overview={
          <DetailGrid
            main={
              <>
                <DataCard title={t('finance.transaction_detail.data')}>
                  <Facts
                    items={[
                      {
                        label: t('finance.transaction_detail.kind'),
                        value: t(`finance.kind.${item.kind}`),
                      },
                      {
                        label: t('finance.transaction_detail.account'),
                        value: account.data ? (
                          <Link
                            to="/finance/accounts/$accountId"
                            params={{ accountId: item.account_id }}
                            className={styles.inlineLink}
                          >
                            {account.data.name}
                          </Link>
                        ) : (
                          '–'
                        ),
                      },
                      {
                        label: t('finance.transaction_detail.category'),
                        value: category.data?.name ?? t('finance.transactions.no_category'),
                      },
                      {
                        label: t('finance.transaction_detail.expected_amount'),
                        value: money(item.expected_amount),
                      },
                      {
                        label: t('finance.transaction_detail.expected_date'),
                        value: formatDate(item.expected_date, locale, 'UTC'),
                      },
                    ]}
                  />
                </DataCard>
                <SettlementCard
                  kind={item.kind}
                  currency={item.currency}
                  expected_amount={item.expected_amount}
                  gross_amount={item.gross_amount}
                  adjustments={item.adjustments}
                  today={today}
                  pending={settle.isPending}
                  settled={
                    settled
                      ? {
                          settled_amount: item.settled_amount ?? 0,
                          settled_at: item.settled_at ?? item.effective_date,
                          difference_kind: item.difference_kind,
                          difference_amount: item.difference_amount,
                        }
                      : null
                  }
                  onSettle={(values) => {
                    settle.mutate(
                      { transaction: item, ...values, idempotency_key: idempotency.key },
                      {
                        onSuccess: () => {
                          idempotency.renew();
                        },
                      },
                    );
                  }}
                />
              </>
            }
            aside={
              <RecordCard
                visibility={item.visibility}
                created_at={item.created_at}
                updated_at={item.updated_at}
                extra={[
                  {
                    label: t('finance.record.date'),
                    value: formatDate(item.effective_date, locale, 'UTC'),
                  },
                ]}
              >
                {item.generated_from ? (
                  <p className={styles.cardHelp}>
                    <Link
                      to="/finance/recurring-transactions/$recurrenceId"
                      params={{ recurrenceId: item.generated_from }}
                      className={styles.inlineLink}
                    >
                      {t('finance.record.generated_from', {
                        description: recurrence.data?.description ?? '',
                      })}
                    </Link>
                  </p>
                ) : null}
              </RecordCard>
            }
          />
        }
      />
      <ConfirmDialog
        open={confirm === 'delete'}
        title={t('finance.transaction_detail.delete_title')}
        description={t('finance.transaction_detail.delete_description')}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        onConfirm={() => {
          void deleteNow();
        }}
        onCancel={() => {
          setConfirm(null);
        }}
      />
      <ConfirmDialog
        open={confirm === 'undo'}
        title={t('finance.transaction_detail.undo_copy_title')}
        description={t('finance.transaction_detail.undo_copy_description', {
          date: formatDate(item.occurrence_date ?? item.effective_date, locale, 'UTC'),
        })}
        confirmLabel={t('finance.transaction_detail.undo_settlement')}
        cancelLabel={t('common.cancel')}
        onConfirm={() => {
          setConfirm(null);
          undoNow();
        }}
        onCancel={() => {
          setConfirm(null);
        }}
      />
    </div>
  );
}
