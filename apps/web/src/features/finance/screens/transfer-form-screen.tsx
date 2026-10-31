import { zodResolver } from '@hookform/resolvers/zod';
import { ErrorState, FormActions, FormGrid, LoadingState, TextField } from '@atria/ui';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { FormDate, FormSelect } from '../../../shared/forms/form-fields';
import { useT } from '../../../shared/i18n/i18n';
import { FormScreen } from '../../../shared/layout/form-screen';
import { StickyPageHeader } from '../../../shared/layout/sticky-page-header';
import { BackLink } from '../../../shared/navigation/back-link';
import { usePreferences } from '../../../shared/preferences/preferences-context';
import styles from '../components/finance.module.css';
import { MoneyField } from '../components/money-field';
import { VisibilityField } from '../components/visibility-field';
import { errorMessageKey, useIdempotencyKey } from '../hooks/finance-cache';
import { useAccounts, type Account } from '../hooks/use-accounts';
import { useCreateTransfer } from '../hooks/use-transfers';
import { todayInTimeZone } from '../lib/finance-period';

const form_schema = z
  .object({
    from_account_id: z.string().min(1, 'finance.transaction_form.account_required'),
    to_account_id: z.string().min(1, 'finance.transaction_form.account_required'),
    amount: z.number().int().positive('finance.transaction_form.amount_invalid').nullable(),
    transferred_on: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'finance.transaction_form.date_required'),
    description: z.string().max(200),
    visibility: z.enum(['personal', 'shared']),
  })
  .superRefine((values, context) => {
    if (values.amount === null) {
      context.addIssue({
        code: 'custom',
        path: ['amount'],
        message: 'finance.transaction_form.amount_invalid',
      });
    }
    if (values.to_account_id !== '' && values.to_account_id === values.from_account_id) {
      context.addIssue({
        code: 'custom',
        path: ['to_account_id'],
        message: 'finance.transfer_form.same_account',
      });
    }
  });

type FormValues = z.input<typeof form_schema>;

function TransferForm({ accounts }: { accounts: readonly Account[] }) {
  const t = useT();
  const navigate = useNavigate();
  const { time_zone } = usePreferences();
  const create = useCreateTransfer();
  const idempotency = useIdempotencyKey();
  const [error, setError] = useState<string | null>(null);
  const { control, register, handleSubmit, formState } = useForm<FormValues>({
    resolver: zodResolver(form_schema),
    defaultValues: {
      from_account_id: '',
      to_account_id: '',
      amount: null,
      transferred_on: todayInTimeZone(new Date(), time_zone),
      description: '',
      visibility: 'personal',
    },
  });
  const options = accounts.map((item) => ({ value: item.id, label: item.name }));

  async function onSubmit(values: FormValues) {
    setError(null);
    try {
      const created = await create.mutateAsync({
        idempotency_key: idempotency.key,
        input: {
          from_account_id: values.from_account_id,
          to_account_id: values.to_account_id,
          amount: values.amount ?? 0,
          transferred_on: values.transferred_on,
          description: values.description.trim() || null,
          visibility: values.visibility,
        },
      });
      idempotency.renew();
      await navigate({ to: '/finance/transfers/$transferId', params: { transferId: created.id } });
    } catch (failure) {
      setError(errorMessageKey(failure));
    }
  }

  return (
    <FormScreen>
      <StickyPageHeader
        back={<BackLink module="finance" fallback_to="/finance/transfers" />}
        eyebrow={t('finance.shell.title')}
        title={t('finance.transfer_form.title')}
        subtitle={t('finance.transfer_form.subtitle')}
      />
      <form
        noValidate
        onSubmit={(event) => {
          void handleSubmit(onSubmit)(event);
        }}
      >
        <FormGrid>
          <FormSelect
            control={control}
            name="from_account_id"
            label={t('finance.transfer_form.from')}
            options={options}
          />
          <FormSelect
            control={control}
            name="to_account_id"
            label={t('finance.transfer_form.to')}
            options={options}
          />
          <MoneyField control={control} name="amount" label={t('finance.transfer_form.amount')} />
          <FormDate
            control={control}
            name="transferred_on"
            label={t('finance.transfer_form.date')}
          />
          <div data-span="full">
            <TextField
              label={t('finance.transfer_form.description')}
              autoComplete="off"
              maxLength={200}
              {...register('description')}
            />
          </div>
          <VisibilityField control={control} name="visibility" />
          {error ? (
            <p role="alert" data-span="full" className={styles.formError}>
              {t(error)}
            </p>
          ) : null}
          <FormActions
            cancel_label={t('common.cancel')}
            submit_label={t('common.save')}
            loading={formState.isSubmitting}
            onCancel={() => {
              void navigate({ to: '/finance/transfers' });
            }}
          />
        </FormGrid>
      </form>
    </FormScreen>
  );
}

/** Transferência entre duas contas diferentes (RF-29). */
export function TransferFormScreen() {
  const t = useT();
  const accounts = useAccounts();
  if (accounts.isError) {
    return (
      <ErrorState
        title={t('finance.detail.error_title')}
        description={t('finance.form.load_error')}
        retryLabel={t('common.retry')}
        onRetry={() => {
          void accounts.refetch();
        }}
      />
    );
  }
  if (!accounts.data) return <LoadingState label={t('common.loading')} />;
  return <TransferForm accounts={accounts.data} />;
}
