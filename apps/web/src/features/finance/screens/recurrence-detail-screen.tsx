import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  LoadingState,
  MenuButton,
  Tabs,
} from '@atria/ui';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { formatDate, formatMoney } from '../../../shared/format/intl';
import { summarizeRule } from '../../../shared/forms/recurrence-fields';
import { useT } from '../../../shared/i18n/i18n';
import { StickyPageHeader } from '../../../shared/layout/sticky-page-header';
import { BackLink } from '../../../shared/navigation/back-link';
import { usePreferences } from '../../../shared/preferences/preferences-context';
import { pushToast } from '../../../shared/toast/toast-store';
import { AdjustmentsBreakdown, breakdownItems } from '../components/adjustments-breakdown';
import { differenceKey } from '../components/difference-badge';
import styles from '../components/finance.module.css';
import { MoreIcon, PencilIcon } from '../components/icons';
import { PayrollLoansCard } from '../components/payroll-loans-field';
import { LoadMore } from '../components/list-toolbar';
import { DataCard, DetailGrid, Facts, RecordCard } from '../components/record-card';
import { SettlementCard, type SettlementValues } from '../components/settlement-card';
import { STATUS_TONE, TransactionRow } from '../components/transaction-row';
import { problemCode, useIdempotencyKey, type Transaction } from '../hooks/finance-cache';
import { useAccount } from '../hooks/use-accounts';
import { useCategory } from '../hooks/use-categories';
import { periodInstallments, usePayrollLoans } from '../hooks/use-payroll-loans';
import {
  toFormRule,
  useDeleteRecurringTransaction,
  useRecurringTransaction,
  useSettledCopies,
  useSettleOccurrence,
  useSkipOccurrence,
  type RecurringTransaction,
} from '../hooks/use-recurring-transactions';
import { listItemKey } from '../hooks/use-transactions';
import { todayInTimeZone } from '../lib/finance-period';

export type RecurrenceDetailTab = 'overview' | 'adjustments' | 'payroll_loans' | 'settlements';

const RECURRENCE_TABS: readonly string[] = [
  'overview',
  'adjustments',
  'payroll_loans',
  'settlements',
];

function isRecurrenceTab(value: string): value is RecurrenceDetailTab {
  return RECURRENCE_TABS.includes(value);
}

function Copies({ recurrence }: { recurrence: RecurringTransaction }) {
  const t = useT();
  const copies = useSettledCopies(recurrence.id);
  if (copies.isError) {
    return (
      <ErrorState
        title={t('finance.list.error_title')}
        description={t('finance.list.error_description')}
        retryLabel={t('common.retry')}
        onRetry={() => {
          void copies.refetch();
        }}
      />
    );
  }
  if (copies.isPending) return <LoadingState label={t('common.loading')} />;
  if (copies.items.length === 0) {
    return (
      <EmptyState
        title={t('finance.recurrence_detail.copies_empty')}
        description={t('finance.recurrence_detail.copies_empty_description')}
      />
    );
  }
  return (
    <>
      <ul className={styles.list}>
        {copies.items.map((item) => (
          <TransactionRow key={listItemKey(item)} item={item} />
        ))}
      </ul>
      <LoadMore
        visible={copies.hasNextPage}
        loading={copies.isFetchingNextPage}
        onClick={() => {
          void copies.fetchNextPage();
        }}
      />
    </>
  );
}

type Notice = { kind: 'settled'; copy: Transaction } | { kind: 'stale' } | { kind: 'ended' } | null;

export interface RecurrenceDetailScreenProps {
  recurrence_id: string;
  tab: RecurrenceDetailTab;
  on_tab_change: (tab: RecurrenceDetailTab) => void;
}

/**
 * Detalhe da recorrente (PD-51, DEC-003): só a ocorrência aberta, que fica atrasada até ser
 * liquidada ou pulada; a tela nunca avança sozinha. Excluir a recorrência tira a ocorrência aberta
 * e mantém as cópias liquidadas (RF-01, RF-03).
 */
export function RecurrenceDetailScreen({
  recurrence_id,
  tab,
  on_tab_change,
}: RecurrenceDetailScreenProps) {
  const t = useT();
  const navigate = useNavigate();
  const { locale, time_zone } = usePreferences();
  const query = useRecurringTransaction(recurrence_id);
  const account = useAccount(query.data?.account_id);
  const category = useCategory(query.data?.category_id ?? undefined);
  const loans = usePayrollLoans(
    query.data?.kind === 'income' ? { income_recurrence_id: recurrence_id } : undefined,
  );
  const loan_items = loans.data ?? [];
  const settle = useSettleOccurrence(recurrence_id);
  const skip = useSkipOccurrence(recurrence_id);
  const remove = useDeleteRecurringTransaction(recurrence_id);
  const idempotency = useIdempotencyKey();
  const [skipping, setSkipping] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

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
  if (!query.data) return <LoadingState label={t('common.loading')} />;
  const recurrence = query.data;
  const fallback = recurrence.kind === 'income' ? '/finance/income' : '/finance/expenses';
  const open = recurrence.open_occurrence ?? null;
  const ended = open === null || notice?.kind === 'ended';
  const date = (iso: string) => formatDate(iso, locale, 'UTC');
  const money = (value: number) => formatMoney(value, recurrence.currency, locale);
  const description = recurrence.description?.trim() || t(`finance.kind.${recurrence.kind}`);

  function onRefused(error: unknown) {
    const code = problemCode(error);
    if (code === 'occurrence_not_open') setNotice({ kind: 'stale' });
    if (code === 'recurrence_ended') setNotice({ kind: 'ended' });
  }

  function onSettle(values: SettlementValues) {
    if (!open) return;
    setNotice(null);
    settle.mutate(
      { occurrence_date: open.occurrence_date, ...values, idempotency_key: idempotency.key },
      {
        onSuccess: (copy) => {
          idempotency.renew();
          setNotice({ kind: 'settled', copy });
        },
        onError: onRefused,
      },
    );
  }

  function onSkip() {
    setSkipping(false);
    if (!open) return;
    setNotice(null);
    skip.mutate(
      { occurrence_date: open.occurrence_date, idempotency_key: idempotency.key },
      {
        onSuccess: () => {
          idempotency.renew();
          pushToast({ tone: 'info', message_key: 'finance.recurrence_detail.skipped' });
        },
        onError: onRefused,
      },
    );
  }

  async function deleteNow() {
    setDeleting(false);
    try {
      await remove.mutateAsync();
      pushToast({ tone: 'success', message_key: 'finance.recurrence_detail.deleted' });
      await navigate({ to: fallback });
    } catch {
      // A recusa já restaurou as listas e avisou.
    }
  }

  function settledText(copy: Transaction): string {
    const key = differenceKey(copy.kind, copy.difference_kind);
    const difference =
      key && copy.difference_amount
        ? `${t(key, { value: money(Math.abs(copy.difference_amount)) })}.`
        : '';
    if (open && !ended) {
      return t('finance.recurrence_detail.settled_next', {
        difference,
        date: date(open.occurrence_date),
      });
    }
    return t('finance.recurrence_detail.settled_ended', { difference });
  }

  // A aba dos descontos só existe com itens (RN-11).
  const has_adjustments = recurrence.adjustments.length > 0;
  const adjustments_panel = (
    <DataCard title={t('finance.adjustments.title')}>
      <AdjustmentsBreakdown
        currency={recurrence.currency}
        gross_amount={recurrence.gross_amount}
        items={breakdownItems(recurrence.adjustments)}
        net_amount={recurrence.expected_amount}
        net_label={t('finance.adjustments.net_expected')}
      />
    </DataCard>
  );
  const overview = (
    <DetailGrid
      main={
        <>
          <DataCard title={t('finance.recurrence_detail.data')}>
            <Facts
              items={[
                { label: t('finance.recurrence_detail.description'), value: description },
                {
                  label: t('finance.recurrence_detail.account'),
                  value: account.data?.name ?? '–',
                },
                {
                  label: t('finance.recurrence_detail.category'),
                  value: category.data?.name ?? t('finance.transactions.no_category'),
                },
                {
                  label: t('finance.recurrence_detail.amount'),
                  value: <span className={styles.num}>{money(recurrence.expected_amount)}</span>,
                },
                {
                  label: t('finance.recurrence_detail.rule'),
                  value: summarizeRule(toFormRule(recurrence.rule), locale),
                },
                open && !ended
                  ? {
                      label: t('finance.recurrence_detail.open_occurrence'),
                      value: (
                        <span className={styles.actions}>
                          <span>{date(open.occurrence_date)}</span>
                          <Badge tone={STATUS_TONE[open.status]}>
                            {t(`finance.status.${open.status}`)}
                          </Badge>
                          {open.status === 'overdue' ? (
                            <span>
                              {t('finance.recurrence_detail.overdue_since', {
                                date: date(open.occurrence_date),
                              })}
                            </span>
                          ) : null}
                        </span>
                      ),
                    }
                  : null,
              ]}
            />
          </DataCard>
          {notice?.kind === 'settled' ? (
            <p role="status" className={`${styles.notice ?? ''} ${styles.noticeSuccess ?? ''}`}>
              {settledText(notice.copy)}
            </p>
          ) : null}
          {notice?.kind === 'stale' ? (
            <p role="status" className={`${styles.notice ?? ''} ${styles.noticeInfo ?? ''}`}>
              {t('finance.recurrence_detail.stale')}
            </p>
          ) : null}
          {ended ? (
            <p role="status" className={`${styles.notice ?? ''} ${styles.noticeInfo ?? ''}`}>
              {t('finance.recurrence_detail.ended')}
            </p>
          ) : (
            <SettlementCard
              // Remonta quando os consignados chegam, para o valor sugerido descontar as parcelas.
              key={`${open.occurrence_date}-${String(loan_items.length)}`}
              kind={recurrence.kind}
              currency={recurrence.currency}
              expected_amount={recurrence.expected_amount}
              gross_amount={recurrence.gross_amount}
              adjustments={recurrence.adjustments}
              payroll_loans={periodInstallments(loan_items, open.occurrence_date)}
              today={todayInTimeZone(new Date(), time_zone)}
              caption={t('finance.settlement.occurrence', { date: date(open.occurrence_date) })}
              pending={settle.isPending}
              onSettle={onSettle}
            />
          )}
        </>
      }
      aside={
        <RecordCard
          visibility={recurrence.visibility}
          created_at={recurrence.created_at}
          updated_at={recurrence.updated_at}
          extra={[
            {
              label: t('finance.record.recurrence'),
              value: summarizeRule(toFormRule(recurrence.rule), locale),
            },
          ]}
        />
      }
    />
  );

  return (
    <div className={styles.screen}>
      <StickyPageHeader
        back={<BackLink module="finance" fallback_to={fallback} />}
        eyebrow={t('finance.recurrence_detail.eyebrow')}
        title={description}
        subtitle={summarizeRule(toFormRule(recurrence.rule), locale)}
        actions={
          <div className={styles.actions}>
            <Button
              onClick={() => {
                void navigate({
                  to: '/finance/recurring-transactions/$recurrenceId/edit',
                  params: { recurrenceId: recurrence.id },
                });
              }}
            >
              <PencilIcon />
              {t('common.edit')}
            </Button>
            {ended ? null : (
              <Button
                variant="muted"
                loading={skip.isPending}
                onClick={() => {
                  setSkipping(true);
                }}
              >
                {t('finance.recurrence_detail.skip')}
              </Button>
            )}
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
                    setDeleting(true);
                  },
                },
              ]}
            />
          </div>
        }
      />
      <Tabs
        label={t('finance.recurrence_detail.tabs_label')}
        value={
          (tab === 'adjustments' && !has_adjustments) ||
          (tab === 'payroll_loans' && loan_items.length === 0)
            ? 'overview'
            : tab
        }
        onChange={(next) => {
          on_tab_change(isRecurrenceTab(next) ? next : 'overview');
        }}
        tabs={[
          { id: 'overview', label: t('finance.recurrence_detail.overview'), panel: overview },
          ...(has_adjustments
            ? [
                {
                  id: 'adjustments',
                  label: t('finance.adjustments.title'),
                  panel: adjustments_panel,
                },
              ]
            : []),
          ...(loan_items.length > 0
            ? [
                {
                  id: 'payroll_loans',
                  label: t('finance.payroll_loans.title'),
                  panel: (
                    <PayrollLoansCard
                      loans={loan_items}
                      currency={recurrence.currency}
                      settled={false}
                    />
                  ),
                },
              ]
            : []),
          {
            id: 'settlements',
            label: t('finance.recurrence_detail.settlements'),
            panel: <Copies recurrence={recurrence} />,
          },
        ]}
      />
      <ConfirmDialog
        open={skipping && open !== null}
        title={t('finance.recurrence_detail.skip_title')}
        description={t('finance.recurrence_detail.skip_description', {
          date: open ? date(open.occurrence_date) : '',
        })}
        confirmLabel={t('finance.recurrence_detail.skip')}
        cancelLabel={t('common.cancel')}
        onConfirm={onSkip}
        onCancel={() => {
          setSkipping(false);
        }}
      />
      <ConfirmDialog
        open={deleting}
        title={t('finance.recurrence_detail.delete_title')}
        description={t('finance.recurrence_detail.delete_description')}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        onConfirm={() => {
          void deleteNow();
        }}
        onCancel={() => {
          setDeleting(false);
        }}
      />
    </div>
  );
}
