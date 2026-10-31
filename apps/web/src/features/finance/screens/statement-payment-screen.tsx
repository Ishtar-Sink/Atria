import { zodResolver } from '@hookform/resolvers/zod';
import { ConfirmDialog, ErrorState, FormActions, FormGrid, LoadingState } from '@atria/ui';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { formatMoney } from '../../../shared/format/intl';
import { FormDate, FormSelect } from '../../../shared/forms/form-fields';
import { useT } from '../../../shared/i18n/i18n';
import { FormScreen } from '../../../shared/layout/form-screen';
import { StickyPageHeader } from '../../../shared/layout/sticky-page-header';
import { BackLink } from '../../../shared/navigation/back-link';
import { usePreferences } from '../../../shared/preferences/preferences-context';
import { pushToast } from '../../../shared/toast/toast-store';
import styles from '../components/finance.module.css';
import { useIdempotencyKey } from '../hooks/finance-cache';
import { useAccounts, type Account } from '../hooks/use-accounts';
import { usePayStatement, useStatements, type Statement } from '../hooks/use-statements';
import { todayInTimeZone } from '../lib/finance-period';
import { formatStatementPeriod } from './statements-screen';

const form_schema = z.object({
  from_account_id: z.string().min(1, 'finance.transaction_form.account_required'),
  paid_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'finance.transaction_form.date_required'),
});

type FormValues = z.input<typeof form_schema>;

interface PaymentFormProps {
  card: Account;
  statement: Statement;
  sources: readonly Account[];
}

function PaymentForm({ card, statement, sources }: PaymentFormProps) {
  const t = useT();
  const navigate = useNavigate();
  const { locale, time_zone } = usePreferences();
  const pay = usePayStatement(card.id, statement.period);
  const idempotency = useIdempotencyKey();
  const [pending, setPending] = useState<FormValues | null>(null);
  const { control, handleSubmit, formState } = useForm<FormValues>({
    resolver: zodResolver(form_schema),
    defaultValues: {
      from_account_id: sources.find((item) => item.is_default)?.id ?? sources[0]?.id ?? '',
      paid_on: todayInTimeZone(new Date(), time_zone),
    },
  });
  const value = formatMoney(statement.outstanding_amount, card.currency, locale);
  const back_to = `/finance/statements?card_id=${card.id}&statement=${statement.period}`;
  const source_name = sources.find((item) => item.id === pending?.from_account_id)?.name ?? '';

  function confirm() {
    if (!pending) return;
    const values = pending;
    setPending(null);
    pay.mutate(
      {
        from_account_id: values.from_account_id,
        paid_on: values.paid_on,
        idempotency_key: idempotency.key,
      },
      {
        onSuccess: () => {
          idempotency.renew();
          pushToast({ tone: 'success', message_key: 'finance.statement_payment.paid' });
        },
      },
    );
    // Otimista: a fatura já aparece paga na aba Faturas.
    void navigate({
      to: '/finance/statements',
      search: { card_id: card.id, statement: statement.period },
    });
  }

  return (
    <FormScreen>
      <StickyPageHeader
        back={<BackLink module="finance" fallback_to="/finance/statements" to={back_to} />}
        eyebrow={t('finance.shell.title')}
        title={t('finance.statement_payment.title')}
        subtitle={t('finance.statement_payment.subtitle', {
          period: formatStatementPeriod(statement.period, locale),
          card: card.name,
          value,
        })}
      />
      <form
        noValidate
        onSubmit={(event) => {
          void handleSubmit((values) => {
            setPending(values);
          })(event);
        }}
      >
        <FormGrid>
          <FormSelect
            control={control}
            name="from_account_id"
            label={t('finance.statement_payment.from_account')}
            options={sources.map((item) => ({ value: item.id, label: item.name }))}
          />
          <FormDate control={control} name="paid_on" label={t('finance.statement_payment.date')} />
          {sources.length === 0 ? (
            <p role="alert" data-span="full" className={styles.formError}>
              {t('finance.statement_payment.no_accounts')}
            </p>
          ) : null}
          <FormActions
            cancel_label={t('common.cancel')}
            submit_label={t('finance.statement_payment.submit')}
            loading={formState.isSubmitting}
            submit_disabled={sources.length === 0}
            onCancel={() => {
              void navigate({ to: back_to });
            }}
          />
        </FormGrid>
      </form>
      <ConfirmDialog
        open={pending !== null}
        title={t('finance.statement_payment.confirm_title')}
        description={t('finance.statement_payment.confirm_description', {
          value,
          account: source_name,
        })}
        confirmLabel={t('finance.statement_payment.submit')}
        cancelLabel={t('common.cancel')}
        onConfirm={confirm}
        onCancel={() => {
          setPending(null);
        }}
      />
    </FormScreen>
  );
}

export interface StatementPaymentScreenProps {
  card_id: string;
  period: string;
}

/** Pagamento da fatura escolhendo a conta de origem, com confirmação (RF-34). */
export function StatementPaymentScreen({ card_id, period }: StatementPaymentScreenProps) {
  const t = useT();
  const accounts = useAccounts();
  const statements = useStatements(card_id);
  if (accounts.isError || statements.isError) {
    return (
      <ErrorState
        title={t('finance.detail.error_title')}
        description={t('finance.form.load_error')}
        retryLabel={t('common.retry')}
        onRetry={() => {
          void accounts.refetch();
          void statements.refetch();
        }}
      />
    );
  }
  const card = accounts.data?.find((item) => item.id === card_id);
  const statement = statements.data?.find((item) => item.period === period);
  if (!accounts.data || !statements.data) return <LoadingState label={t('common.loading')} />;
  if (!card || !statement) {
    return (
      <ErrorState
        title={t('finance.detail.error_title')}
        description={t('finance.detail.error_description')}
      />
    );
  }
  const sources = accounts.data.filter((item) => item.kind === 'standard');
  return <PaymentForm card={card} statement={statement} sources={sources} />;
}
