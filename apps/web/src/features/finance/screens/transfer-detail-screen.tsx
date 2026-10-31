import { ConfirmDialog, ErrorState, LoadingState, MenuButton } from '@atria/ui';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { formatDate, formatMoney } from '../../../shared/format/intl';
import { useT } from '../../../shared/i18n/i18n';
import { StickyPageHeader } from '../../../shared/layout/sticky-page-header';
import { BackLink } from '../../../shared/navigation/back-link';
import { usePreferences } from '../../../shared/preferences/preferences-context';
import { pushToast } from '../../../shared/toast/toast-store';
import styles from '../components/finance.module.css';
import { MoreIcon } from '../components/icons';
import { DataCard, DetailGrid, Facts, RecordCard } from '../components/record-card';
import { useAccounts } from '../hooks/use-accounts';
import { useDeleteTransfer, useTransfer } from '../hooks/use-transfers';

export interface TransferDetailScreenProps {
  transfer_id: string;
}

/** Detalhe da transferência, com "Mais ações" e "Excluir" (PD-14). */
export function TransferDetailScreen({ transfer_id }: TransferDetailScreenProps) {
  const t = useT();
  const navigate = useNavigate();
  const { locale } = usePreferences();
  const query = useTransfer(transfer_id);
  const accounts = useAccounts();
  const remove = useDeleteTransfer();
  const [confirming, setConfirming] = useState(false);

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
  const transfer = query.data;
  const name = (id: string) => accounts.data?.find((item) => item.id === id)?.name ?? '–';

  async function onDelete() {
    setConfirming(false);
    try {
      await remove.mutateAsync(transfer.id);
      pushToast({ tone: 'success', message_key: 'finance.transfer_detail.deleted' });
      await navigate({ to: '/finance/transfers' });
    } catch {
      // A recusa já restaurou a lista e avisou.
    }
  }

  return (
    <div className={styles.screen}>
      <StickyPageHeader
        back={<BackLink module="finance" fallback_to="/finance/transfers" />}
        eyebrow={t('finance.transfer_detail.eyebrow')}
        title={t('finance.transfers.route', {
          from: name(transfer.from_account_id),
          to: name(transfer.to_account_id),
        })}
        subtitle={formatDate(transfer.transferred_on, locale, 'UTC')}
        actions={
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
                  setConfirming(true);
                },
              },
            ]}
          />
        }
      />
      <DetailGrid
        main={
          <DataCard title={t('finance.transfer_detail.data')}>
            <Facts
              items={[
                { label: t('finance.transfer_detail.from'), value: name(transfer.from_account_id) },
                { label: t('finance.transfer_detail.to'), value: name(transfer.to_account_id) },
                {
                  label: t('finance.transfer_detail.amount'),
                  value: (
                    <span className={styles.num}>
                      {formatMoney(transfer.amount, transfer.currency, locale)}
                    </span>
                  ),
                },
                {
                  label: t('finance.transfer_detail.date'),
                  value: formatDate(transfer.transferred_on, locale, 'UTC'),
                },
                transfer.description
                  ? { label: t('finance.transfer_detail.description'), value: transfer.description }
                  : null,
              ]}
            />
          </DataCard>
        }
        aside={
          <RecordCard
            visibility={transfer.visibility}
            created_at={transfer.created_at}
            updated_at={transfer.updated_at}
          />
        }
      />
      <ConfirmDialog
        open={confirming}
        title={t('finance.transfer_detail.delete_title')}
        description={t('finance.transfer_detail.delete_description')}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        onConfirm={() => {
          void onDelete();
        }}
        onCancel={() => {
          setConfirming(false);
        }}
      />
    </div>
  );
}
