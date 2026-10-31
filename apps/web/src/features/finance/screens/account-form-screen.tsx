import { zodResolver } from '@hookform/resolvers/zod';
import { ErrorState, FormActions, FormGrid, LoadingState, TextField } from '@atria/ui';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { FormSegmented } from '../../../shared/forms/form-fields';
import { useT } from '../../../shared/i18n/i18n';
import { FormScreen } from '../../../shared/layout/form-screen';
import { StickyPageHeader } from '../../../shared/layout/sticky-page-header';
import { BackLink } from '../../../shared/navigation/back-link';
import { pushToast } from '../../../shared/toast/toast-store';
import styles from '../components/finance.module.css';
import { MoneyField } from '../components/money-field';
import { VisibilityField } from '../components/visibility-field';
import { errorMessageKey } from '../hooks/finance-cache';
import {
  useAccount,
  useCreateAccount,
  useRenameAccount,
  type Account,
} from '../hooks/use-accounts';

const DAY = /^(?:[1-9]|[12]\d|3[01])$/;

const form_schema = z
  .object({
    name: z.string().trim().min(1, 'finance.form.name_required').max(100),
    kind: z.enum(['standard', 'credit_card']),
    credit_limit_amount: z.number().int().min(0).nullable(),
    closing_day: z.string(),
    due_day: z.string(),
    visibility: z.enum(['personal', 'shared']),
  })
  .superRefine((values, context) => {
    if (values.kind !== 'credit_card') return;
    if (values.credit_limit_amount === null) {
      context.addIssue({
        code: 'custom',
        path: ['credit_limit_amount'],
        message: 'finance.transaction_form.amount_invalid',
      });
    }
    for (const field of ['closing_day', 'due_day'] as const) {
      if (!DAY.test(values[field].trim())) {
        context.addIssue({
          code: 'custom',
          path: [field],
          message: 'finance.account_form.day_help',
        });
      }
    }
  });

type FormValues = z.input<typeof form_schema>;

function toValues(account: Account | undefined): FormValues {
  return {
    name: account?.name ?? '',
    kind: account?.kind ?? 'standard',
    credit_limit_amount: account?.credit_limit_amount ?? null,
    closing_day: account?.closing_day ? String(account.closing_day) : '',
    due_day: account?.due_day ? String(account.due_day) : '',
    visibility: account?.visibility ?? 'personal',
  };
}

function AccountForm({ account }: { account?: Account }) {
  const t = useT();
  const navigate = useNavigate();
  const create = useCreateAccount();
  const rename = useRenameAccount();
  const [error, setError] = useState<string | null>(null);
  const editing = account !== undefined;
  const { control, register, handleSubmit, formState } = useForm<FormValues>({
    resolver: zodResolver(form_schema),
    defaultValues: toValues(account),
  });
  const kind = useWatch({ control, name: 'kind' });
  const message = (value: string | undefined) => (value ? t(value) : undefined);

  async function onSubmit(values: FormValues) {
    setError(null);
    const card = values.kind === 'credit_card';
    const card_fields = card
      ? {
          credit_limit_amount: values.credit_limit_amount,
          closing_day: Number(values.closing_day),
          due_day: Number(values.due_day),
        }
      : {};
    try {
      const saved = editing
        ? await rename.mutateAsync({
            id: account.id,
            patch: { name: values.name.trim(), visibility: values.visibility, ...card_fields },
          })
        : await create.mutateAsync({
            name: values.name.trim(),
            kind: values.kind,
            visibility: values.visibility,
            ...card_fields,
          });
      pushToast({ tone: 'success', message_key: 'finance.account_form.saved' });
      await navigate({ to: '/finance/accounts/$accountId', params: { accountId: saved.id } });
    } catch (failure) {
      setError(errorMessageKey(failure));
    }
  }

  const back_to = editing ? `/finance/accounts/${account.id}` : undefined;
  return (
    <FormScreen>
      <StickyPageHeader
        back={
          <BackLink
            module="finance"
            fallback_to="/finance/accounts"
            {...(back_to ? { to: back_to } : {})}
          />
        }
        eyebrow={t('finance.shell.title')}
        title={t(editing ? 'finance.account_form.edit_title' : 'finance.account_form.new_title')}
        subtitle={t('finance.account_form.subtitle')}
      />
      <form
        noValidate
        onSubmit={(event) => {
          void handleSubmit(onSubmit)(event);
        }}
      >
        <FormGrid>
          <div data-span="full">
            <TextField
              label={t('finance.account_form.name')}
              autoComplete="off"
              maxLength={100}
              {...register('name')}
              {...(formState.errors.name ? { error: message(formState.errors.name.message) } : {})}
            />
          </div>
          {editing ? (
            <p data-span="full" className={styles.cardHelp}>
              {t('finance.account_form.kind')}: {t(`finance.account_kind.${account.kind}`)}
            </p>
          ) : (
            <div data-span="full">
              <FormSegmented
                control={control}
                name="kind"
                label={t('finance.account_form.kind')}
                options={[
                  { value: 'standard', label: t('finance.account_form.kind_standard') },
                  { value: 'credit_card', label: t('finance.account_form.kind_credit_card') },
                ]}
              />
            </div>
          )}
          {kind === 'credit_card' ? (
            <>
              <div data-span="full">
                <MoneyField
                  control={control}
                  name="credit_limit_amount"
                  label={t('finance.account_form.credit_limit')}
                />
              </div>
              <TextField
                label={t('finance.account_form.closing_day')}
                help={t('finance.account_form.day_help')}
                inputMode="numeric"
                autoComplete="off"
                maxLength={2}
                {...register('closing_day')}
                {...(formState.errors.closing_day
                  ? { error: message(formState.errors.closing_day.message) }
                  : {})}
              />
              <TextField
                label={t('finance.account_form.due_day')}
                help={t('finance.account_form.day_help')}
                inputMode="numeric"
                autoComplete="off"
                maxLength={2}
                {...register('due_day')}
                {...(formState.errors.due_day
                  ? { error: message(formState.errors.due_day.message) }
                  : {})}
              />
            </>
          ) : null}
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
              void navigate({ to: back_to ?? '/finance/accounts' });
            }}
          />
        </FormGrid>
      </form>
    </FormScreen>
  );
}

export interface AccountFormScreenProps {
  account_id?: string;
}

/** Criar e editar conta ou cartão em rota própria (RF-24, RF-26). */
export function AccountFormScreen({ account_id }: AccountFormScreenProps) {
  const t = useT();
  const account = useAccount(account_id);
  if (account_id === undefined) return <AccountForm />;
  if (account.isError) {
    return (
      <ErrorState
        title={t('finance.detail.error_title')}
        description={t('finance.form.load_error')}
        retryLabel={t('common.retry')}
        onRetry={() => {
          void account.refetch();
        }}
      />
    );
  }
  if (!account.data) return <LoadingState label={t('common.loading')} />;
  return <AccountForm account={account.data} />;
}
