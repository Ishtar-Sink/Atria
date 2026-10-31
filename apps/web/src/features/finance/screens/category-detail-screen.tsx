import {
  Button,
  ConfirmDialog,
  ErrorState,
  LoadingState,
  MenuButton,
  SelectField,
  type MenuItem,
} from '@atria/ui';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useT } from '../../../shared/i18n/i18n';
import { StickyPageHeader } from '../../../shared/layout/sticky-page-header';
import { BackLink } from '../../../shared/navigation/back-link';
import { pushToast } from '../../../shared/toast/toast-store';
import { FinanceDialog } from '../components/finance-dialog';
import styles from '../components/finance.module.css';
import { MoreIcon, PencilIcon } from '../components/icons';
import { DataCard, DetailGrid, Facts, RecordCard } from '../components/record-card';
import { toneClass } from '../components/tone';
import { useCategories, useCategory, useDeleteCategory } from '../hooks/use-categories';

/** Relatório de gastos já filtrado pela categoria (PD-61). */
export function categoryReportHref(category_id: string): string {
  return `/reports/fin-cat?category_id=${encodeURIComponent(category_id)}&run=1`;
}

export interface CategoryDetailScreenProps {
  category_id: string;
}

/** Página da categoria: "Editar", "Mais ações" e a exclusão com destino (PD-14, PD-49, CB-15). */
export function CategoryDetailScreen({ category_id }: CategoryDetailScreenProps) {
  const t = useT();
  const navigate = useNavigate();
  const query = useCategory(category_id);
  const siblings = useCategories(query.data?.kind);
  const remove = useDeleteCategory();
  const [step, setStep] = useState<'closed' | 'confirm' | 'destination'>('closed');
  const [destination, setDestination] = useState('');
  const [missing, setMissing] = useState(false);

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
  const category = query.data;
  const others = (siblings.data ?? []).filter(
    (item) => item.id !== category.id && item.kind === category.kind,
  );

  async function onDelete(replacement_id?: string) {
    try {
      await remove.mutateAsync({
        id: category.id,
        ...(replacement_id ? { replacement_id } : {}),
      });
      setStep('closed');
      pushToast({ tone: 'success', message_key: 'finance.category_detail.deleted' });
      await navigate({ to: '/finance/settings' });
    } catch {
      // Em uso: o mesmo diálogo pede a categoria de destino.
      setStep('destination');
    }
  }

  const items: MenuItem[] = [
    ...(category.kind === 'expense'
      ? [
          {
            id: 'fin-cat',
            label: t('finance.reports.fin_cat'),
            href: categoryReportHref(category.id),
          },
        ]
      : []),
    {
      id: 'delete',
      label: t('common.delete'),
      tone: 'danger',
      onSelect: () => {
        setStep('confirm');
      },
    },
  ];

  return (
    <div className={styles.screen}>
      <StickyPageHeader
        back={<BackLink module="finance" fallback_to="/finance/settings" />}
        eyebrow={t('finance.category_detail.eyebrow')}
        title={category.name}
        subtitle={t(`finance.category_form.kind_${category.kind}`)}
        actions={
          <div className={styles.actions}>
            <Button
              onClick={() => {
                void navigate({
                  to: '/finance/categories/$categoryId/edit',
                  params: { categoryId: category.id },
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
      <DetailGrid
        main={
          <DataCard title={t('finance.category_detail.data')}>
            <Facts
              items={[
                {
                  label: t('finance.category_detail.kind'),
                  value: t(`finance.category_form.kind_${category.kind}`),
                },
                {
                  label: t('finance.category_detail.color'),
                  value: (
                    <span className={styles.actions}>
                      <span
                        className={`${styles.dot ?? ''} ${toneClass(category.color)}`}
                        aria-hidden="true"
                      />
                      {t(`finance.colors.${category.color}`)}
                    </span>
                  ),
                },
              ]}
            />
          </DataCard>
        }
        aside={
          <RecordCard
            visibility={category.visibility}
            created_at={category.created_at}
            updated_at={category.updated_at}
          />
        }
      />
      <ConfirmDialog
        open={step === 'confirm'}
        title={t('finance.category_detail.delete_title')}
        description={t('finance.category_detail.delete_description', { name: category.name })}
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
        title={t('finance.category_detail.delete_title')}
        cancel_label={t('common.cancel')}
        onCancel={() => {
          setStep('closed');
          setMissing(false);
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
            {t('common.delete')}
          </Button>
        }
      >
        <p>{t('finance.category_detail.in_use')}</p>
        {others.length === 0 ? (
          <p>{t('finance.category_detail.no_destination')}</p>
        ) : (
          <SelectField
            label={t('finance.category_detail.destination')}
            value={destination}
            onChange={(value) => {
              setDestination(value);
              setMissing(false);
            }}
            options={others.map((item) => ({ value: item.id, label: item.name }))}
            {...(missing ? { error: t('finance.category_detail.destination_required') } : {})}
          />
        )}
        {remove.state === 'kind_mismatch' ? (
          <p role="alert" className={styles.formError}>
            {t('finance.errors.category_kind_mismatch')}
          </p>
        ) : null}
      </FinanceDialog>
    </div>
  );
}
