import { zodResolver } from '@hookform/resolvers/zod';
import { ErrorState, FormActions, FormGrid, LoadingState, TextField } from '@atria/ui';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useT } from '../../../shared/i18n/i18n';
import { FormScreen } from '../../../shared/layout/form-screen';
import { StickyPageHeader } from '../../../shared/layout/sticky-page-header';
import { BackLink } from '../../../shared/navigation/back-link';
import { pushToast } from '../../../shared/toast/toast-store';
import styles from '../components/finance.module.css';
import { VisibilityField } from '../components/visibility-field';
import { errorMessageKey } from '../hooks/finance-cache';
import {
  useAccount,
  useCreateAccount,
  useRenameAccount,
  type Account,
} from '../hooks/use-accounts';

const form_schema = z.object({
  name: z.string().trim().min(1, 'finance.form.name_required').max(100),
  visibility: z.enum(['personal', 'shared']),
});

type FormValues = z.input<typeof form_schema>;

function toValues(account: Account | undefined): FormValues {
  return {
    name: account?.name ?? '',
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
  const message = (value: string | undefined) => (value ? t(value) : undefined);

  async function onSubmit(values: FormValues) {
    setError(null);
    try {
      const saved = editing
        ? await rename.mutateAsync({
            id: account.id,
            patch: { name: values.name.trim(), visibility: values.visibility },
          })
        : await create.mutateAsync({
            name: values.name.trim(),
            visibility: values.visibility,
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

/** Criar e editar conta em rota própria (RF-24, RF-26). */
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
