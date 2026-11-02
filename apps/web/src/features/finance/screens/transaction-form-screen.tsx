import { zodResolver } from '@hookform/resolvers/zod';
import {
  Checkbox,
  DateField,
  ErrorState,
  FormActions,
  FormGrid,
  LoadingState,
  SelectField,
  TextField,
} from '@atria/ui';
import { Link, useNavigate } from '@tanstack/react-router';
import { useRef, useState } from 'react';
import { Controller, useForm, useWatch, type Control } from 'react-hook-form';
import { z } from 'zod';
import { formatDate, formatMoney } from '../../../shared/format/intl';
import { FormDate, FormSelect, useDateLabels } from '../../../shared/forms/form-fields';
import {
  defaultRecurrenceRule,
  FormRecurrence,
  type RecurrenceRule,
} from '../../../shared/forms/recurrence-fields';
import { useT } from '../../../shared/i18n/i18n';
import { FormScreen } from '../../../shared/layout/form-screen';
import { StickyPageHeader } from '../../../shared/layout/sticky-page-header';
import { BackLink } from '../../../shared/navigation/back-link';
import { usePreferences } from '../../../shared/preferences/preferences-context';
import { pushToast } from '../../../shared/toast/toast-store';
import { AdjustmentsBreakdown, breakdownItems } from '../components/adjustments-breakdown';
import { AdjustmentsField } from '../components/adjustments-field';
import styles from '../components/finance.module.css';
import { MoneyField } from '../components/money-field';
import { VisibilityField } from '../components/visibility-field';
import {
  errorMessageKey,
  problemCode,
  useIdempotencyKey,
  type Transaction,
  type TransactionKind,
} from '../hooks/finance-cache';
import { useAccounts, type Account } from '../hooks/use-accounts';
import { useCategories, type Category } from '../hooks/use-categories';
import {
  toContractRule,
  toFormRule,
  useCreateRecurringTransaction,
  useRecurringTransaction,
  useUpdateRecurringTransaction,
  type RecurringTransaction,
} from '../hooks/use-recurring-transactions';
import {
  amountFields,
  changedFields,
  editableFields,
  useCreateTransaction,
  useTransaction,
  useUpdateTransaction,
  type EditableField,
} from '../hooks/use-transactions';
import { adjustments_schema, fromAdjustments, toAdjustments } from '../lib/adjustment-form';
import { computeNet } from '../lib/adjustments';
import { todayInTimeZone } from '../lib/finance-period';

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

const form_schema = z
  .object({
    description: z.string().max(200),
    account_id: z.string().min(1, 'finance.transaction_form.account_required'),
    category_id: z.string(),
    expected_amount: z
      .number()
      .int()
      .positive('finance.transaction_form.amount_invalid')
      .nullable(),
    expected_date: z.string(),
    repeat: z.boolean(),
    rule: z.custom<RecurrenceRule>(),
    visibility: z.enum(['personal', 'shared']),
    adjustments: adjustments_schema,
  })
  .superRefine((values, context) => {
    const items = values.adjustments.length > 0 ? toAdjustments(values.adjustments) : null;
    if (items && values.expected_amount !== null) {
      const result = computeNet(values.expected_amount, items);
      if (!result.ok && result.issue.code === 'net_not_positive') {
        context.addIssue({
          code: 'custom',
          path: ['adjustments'],
          message: 'finance.adjustments.net_not_positive',
        });
      }
    }
    if (values.expected_amount === null) {
      context.addIssue({
        code: 'custom',
        path: ['expected_amount'],
        message: 'finance.transaction_form.amount_invalid',
      });
    }
    if (!values.repeat && !ISO_DAY.test(values.expected_date)) {
      context.addIssue({
        code: 'custom',
        path: ['expected_date'],
        message: 'finance.transaction_form.date_required',
      });
    }
    if (values.repeat && !ISO_DAY.test(values.rule.starts_on)) {
      context.addIssue({
        code: 'custom',
        path: ['rule', 'starts_on'],
        message: 'finance.transaction_form.date_required',
      });
    }
  });

type FormValues = z.input<typeof form_schema>;

type Mode =
  | { type: 'create'; kind: TransactionKind }
  | { type: 'edit'; transaction: Transaction }
  | { type: 'recurrence'; recurrence: RecurringTransaction };

function kindOf(mode: Mode): TransactionKind {
  if (mode.type === 'create') return mode.kind;
  if (mode.type === 'edit') return mode.transaction.kind;
  return mode.recurrence.kind;
}

function titleKey(mode: Mode): string {
  const kind = kindOf(mode);
  if (mode.type === 'recurrence') return 'finance.transaction_form.edit_recurrence';
  if (mode.type === 'edit') return `finance.transaction_form.edit_${kind}`;
  return `finance.transaction_form.new_${kind}`;
}

function initialValues(mode: Mode, time_zone: string, today: string, locale: string): FormValues {
  if (mode.type === 'edit') {
    const item = mode.transaction;
    return {
      description: item.description ?? '',
      account_id: item.account_id,
      category_id: item.category_id ?? '',
      expected_amount: item.gross_amount,
      expected_date: item.expected_date,
      repeat: false,
      rule: defaultRecurrenceRule(time_zone, item.expected_date),
      visibility: item.visibility,
      adjustments: fromAdjustments(item.adjustments, locale),
    };
  }
  if (mode.type === 'recurrence') {
    const item = mode.recurrence;
    return {
      description: item.description ?? '',
      account_id: item.account_id,
      category_id: item.category_id ?? '',
      expected_amount: item.gross_amount,
      expected_date: item.rule.starts_on,
      repeat: true,
      rule: toFormRule(item.rule),
      visibility: item.visibility,
      adjustments: fromAdjustments(item.adjustments, locale),
    };
  }
  return {
    description: '',
    account_id: '',
    category_id: '',
    expected_amount: null,
    expected_date: today,
    repeat: false,
    rule: { ...defaultRecurrenceRule(time_zone, today), frequency: 'monthly' },
    visibility: 'personal',
    adjustments: [],
  };
}

/** Líquido previsto a cada mudança do bruto ou de um item, com a mesma regra do servidor (RF-13). */
function LiveNet({ control, currency }: { control: Control<FormValues>; currency: string }) {
  const t = useT();
  const { locale } = usePreferences();
  const gross = useWatch({ control, name: 'expected_amount' });
  const items = useWatch({ control, name: 'adjustments' });
  if (items.length === 0) return null;
  const inputs = toAdjustments(items);
  const result = gross != null && inputs ? computeNet(gross, inputs) : null;
  if (!result?.ok) {
    return (
      <p role="status" className={styles.cardHelp}>
        {t('finance.adjustments.net_incomplete')}
      </p>
    );
  }
  const { breakdown } = result;
  return (
    <>
      <AdjustmentsBreakdown
        currency={currency}
        gross_amount={breakdown.gross_amount}
        items={breakdown.adjustments}
        net_amount={breakdown.net_amount}
        net_label={t('finance.adjustments.net_expected')}
      />
      <p role="status" className={styles.srOnly}>
        {t('finance.adjustments.net_live', {
          value: formatMoney(breakdown.net_amount, currency, locale),
        })}
      </p>
    </>
  );
}

interface TransactionFormProps {
  mode: Mode;
  accounts: readonly Account[];
  categories: readonly Category[];
}

function TransactionForm({ mode, accounts, categories }: TransactionFormProps) {
  const t = useT();
  const navigate = useNavigate();
  const { locale, time_zone, currency } = usePreferences();
  const date_labels = useDateLabels();
  const today = todayInTimeZone(new Date(), time_zone);
  const kind = kindOf(mode);
  const idempotency = useIdempotencyKey();
  const in_flight = useRef(false);
  const create = useCreateTransaction();
  const create_recurring = useCreateRecurringTransaction();
  const update = useUpdateTransaction(mode.type === 'edit' ? mode.transaction.id : '');
  const update_recurring = useUpdateRecurringTransaction(
    mode.type === 'recurrence' ? mode.recurrence.id : '',
  );
  const [error, setError] = useState<string | null>(null);
  const {
    control,
    register,
    handleSubmit,
    formState,
    setError: setFieldError,
  } = useForm<FormValues>({
    resolver: zodResolver(form_schema),
    defaultValues: initialValues(mode, time_zone, today, locale),
  });
  const repeat = useWatch({ control, name: 'repeat' });
  const editable: readonly EditableField[] =
    mode.type === 'edit' ? editableFields(mode.transaction) : [];
  const locked = (field: EditableField) => mode.type === 'edit' && !editable.includes(field);
  const lock_help =
    mode.type === 'edit' && mode.transaction.status === 'settled'
      ? t('finance.transaction_form.settled_locked')
      : undefined;
  const adjustments_error =
    formState.errors.adjustments?.message ?? formState.errors.adjustments?.root?.message;
  const account_options = accounts.map((item) => ({ value: item.id, label: item.name }));
  const category_options = categories.map((item) => ({ value: item.id, label: item.name }));

  function onRefused(failure: unknown) {
    const code = problemCode(failure);
    if (code === 'category_kind_mismatch') {
      setFieldError('category_id', { message: 'finance.errors.category_kind_mismatch' });
      return;
    }
    setError(errorMessageKey(failure));
  }

  async function submitCreate(values: FormValues) {
    const base = {
      kind,
      account_id: values.account_id,
      category_id: values.category_id || null,
      description: values.description.trim() || null,
      ...amountFields(values.expected_amount ?? 0, toAdjustments(values.adjustments) ?? [], false),
      visibility: values.visibility,
    };
    if (values.repeat) {
      const recurrence = await create_recurring.mutateAsync({
        idempotency_key: idempotency.key,
        input: { ...base, rule: toContractRule({ ...values.rule, timezone: time_zone }) },
      });
      pushToast({
        tone: 'success',
        message_key: 'finance.transaction_form.repeat_saved',
        params: {
          date: formatDate(
            recurrence.open_occurrence?.occurrence_date ?? recurrence.rule.starts_on,
            locale,
            'UTC',
          ),
        },
      });
      await navigate({ to: fallback });
      return;
    }
    const items = await create.mutateAsync({
      idempotency_key: idempotency.key,
      input: { ...base, expected_date: values.expected_date },
    });
    idempotency.renew();
    const first = items[0];
    if (first) {
      await navigate({
        to: '/finance/transactions/$transactionId',
        params: { transactionId: first.id },
      });
    }
  }

  async function onSubmit(values: FormValues) {
    if (in_flight.current) return;
    in_flight.current = true;
    setError(null);
    try {
      if (mode.type === 'create') {
        await submitCreate(values);
        return;
      }
      if (mode.type === 'edit') {
        const patch = changedFields(mode.transaction, {
          description: values.description.trim() || null,
          account_id: values.account_id,
          category_id: values.category_id || null,
          ...amountFields(
            values.expected_amount ?? 0,
            toAdjustments(values.adjustments) ?? [],
            mode.transaction.adjustments.length > 0,
          ),
          expected_date: values.expected_date,
          visibility: values.visibility,
        });
        if (Object.keys(patch).length > 0) await update.mutateAsync(patch);
        await navigate({
          to: '/finance/transactions/$transactionId',
          params: { transactionId: mode.transaction.id },
        });
        return;
      }
      await update_recurring.mutateAsync({
        description: values.description.trim() || null,
        account_id: values.account_id,
        category_id: values.category_id || null,
        ...amountFields(
          values.expected_amount ?? 0,
          toAdjustments(values.adjustments) ?? [],
          mode.recurrence.adjustments.length > 0,
        ),
        rule: toContractRule({ ...values.rule, timezone: time_zone }),
      });
      await navigate({
        to: '/finance/recurring-transactions/$recurrenceId',
        params: { recurrenceId: mode.recurrence.id },
      });
    } catch (failure) {
      onRefused(failure);
    } finally {
      in_flight.current = false;
    }
  }

  const back_to =
    mode.type === 'edit'
      ? `/finance/transactions/${mode.transaction.id}`
      : mode.type === 'recurrence'
        ? `/finance/recurring-transactions/${mode.recurrence.id}`
        : undefined;
  const fallback = kind === 'income' ? '/finance/income' : '/finance/expenses';

  return (
    <FormScreen>
      <StickyPageHeader
        back={
          <BackLink module="finance" fallback_to={fallback} {...(back_to ? { to: back_to } : {})} />
        }
        eyebrow={t('finance.shell.title')}
        title={t(titleKey(mode))}
        subtitle={
          mode.type === 'recurrence'
            ? t('finance.transaction_form.rule_scope')
            : t('finance.transaction_form.subtitle')
        }
      />
      <form
        noValidate
        onSubmit={(event) => {
          void handleSubmit(onSubmit)(event);
        }}
      >
        <FormGrid>
          {lock_help ? (
            <p data-span="full" className={styles.notice}>
              {lock_help}
            </p>
          ) : null}
          <div data-span="full">
            <TextField
              label={t('finance.transaction_form.description')}
              autoComplete="off"
              maxLength={200}
              {...register('description')}
            />
          </div>
          {locked('account_id') ? (
            <SelectField
              label={t('finance.transaction_form.account')}
              options={account_options}
              value={mode.type === 'edit' ? mode.transaction.account_id : ''}
              onChange={() => undefined}
              disabled
              {...(lock_help ? { help: lock_help } : {})}
            />
          ) : (
            <FormSelect
              control={control}
              name="account_id"
              label={t('finance.transaction_form.account')}
              options={account_options}
            />
          )}
          <FormSelect
            control={control}
            name="category_id"
            label={t('finance.transaction_form.category')}
            options={category_options}
            empty_option={t('finance.transaction_form.no_category')}
            empty_help={t('finance.transaction_form.no_categories')}
          />
          <div className={styles.rowText}>
            <Link to="/finance/categories/new" search={{ kind }} className={styles.inlineLink}>
              {t('finance.transaction_form.create_category')}
            </Link>
          </div>
          {locked('expected_amount') ? (
            <TextField
              label={t('finance.transaction_form.expected_amount')}
              value={formatMoney(
                mode.type === 'edit' ? mode.transaction.gross_amount : 0,
                mode.type === 'edit' ? mode.transaction.currency : 'BRL',
                locale,
              )}
              disabled
              readOnly
              {...(lock_help ? { help: lock_help } : {})}
            />
          ) : (
            <MoneyField
              control={control}
              name="expected_amount"
              label={t(
                mode.type === 'recurrence'
                  ? 'finance.transaction_form.amount'
                  : 'finance.transaction_form.expected_amount',
              )}
            />
          )}
          <div data-span="full">
            {locked('expected_amount') ? (
              mode.type === 'edit' && mode.transaction.adjustments.length > 0 ? (
                <AdjustmentsBreakdown
                  currency={mode.transaction.currency}
                  gross_amount={mode.transaction.gross_amount}
                  items={breakdownItems(mode.transaction.adjustments)}
                  net_amount={mode.transaction.expected_amount}
                  net_label={t('finance.adjustments.net_expected')}
                />
              ) : null
            ) : (
              <>
                <AdjustmentsField control={control}>
                  <LiveNet control={control} currency={currency} />
                </AdjustmentsField>
                {adjustments_error ? (
                  <p role="alert" className={styles.formError}>
                    {t(adjustments_error)}
                  </p>
                ) : null}
              </>
            )}
          </div>
          {repeat ? null : locked('expected_date') ? (
            <Controller
              control={control}
              name="expected_date"
              render={({ field }) => (
                <DateField
                  label={t('finance.transaction_form.expected_date')}
                  value={field.value}
                  onChange={() => undefined}
                  locale={locale}
                  labels={date_labels}
                  disabled
                  {...(lock_help ? { help: lock_help } : {})}
                />
              )}
            />
          ) : (
            <FormDate
              control={control}
              name="expected_date"
              label={t('finance.transaction_form.expected_date')}
            />
          )}
          {mode.type === 'create' ? (
            <div data-span="full">
              <Checkbox label={t('finance.transaction_form.repeat')} {...register('repeat')} />
            </div>
          ) : null}
          {repeat ? (
            <div data-span="full">
              <FormRecurrence control={control} name="rule" with_time={false} show_summary />
              {mode.type === 'recurrence' ? (
                <p className={styles.cardHelp}>{t('finance.transaction_form.rule_scope')}</p>
              ) : null}
            </div>
          ) : null}
          {mode.type === 'recurrence' ? null : (
            <VisibilityField control={control} name="visibility" />
          )}
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
              void navigate({ to: back_to ?? fallback });
            }}
          />
        </FormGrid>
      </form>
    </FormScreen>
  );
}

export type TransactionFormScreenProps =
  | { mode: 'create'; kind: TransactionKind }
  | { mode: 'edit'; transaction_id: string }
  | { mode: 'recurrence'; recurrence_id: string };

/** Criar entrada ou saída, editar uma movimentação ou a regra de uma recorrente (DEC-005). */
export function TransactionFormScreen(props: TransactionFormScreenProps) {
  const t = useT();
  const transaction = useTransaction(props.mode === 'edit' ? props.transaction_id : undefined);
  const recurrence = useRecurringTransaction(
    props.mode === 'recurrence' ? props.recurrence_id : undefined,
  );
  const kind: TransactionKind | undefined =
    props.mode === 'create'
      ? props.kind
      : props.mode === 'edit'
        ? transaction.data?.kind
        : recurrence.data?.kind;
  const accounts = useAccounts();
  const categories = useCategories(kind);
  const pending_entity =
    (props.mode === 'edit' && transaction.isError) ||
    (props.mode === 'recurrence' && recurrence.isError);

  if (accounts.isError || categories.isError || pending_entity) {
    return (
      <ErrorState
        title={t('finance.detail.error_title')}
        description={t('finance.form.load_error')}
        retryLabel={t('common.retry')}
        onRetry={() => {
          void accounts.refetch();
          void categories.refetch();
          void transaction.refetch();
          void recurrence.refetch();
        }}
      />
    );
  }
  const mode: Mode | undefined =
    props.mode === 'create'
      ? { type: 'create', kind: props.kind }
      : props.mode === 'edit'
        ? transaction.data && { type: 'edit', transaction: transaction.data }
        : recurrence.data && { type: 'recurrence', recurrence: recurrence.data };
  if (!mode || !accounts.data || !categories.data || kind === undefined) {
    return <LoadingState label={t('common.loading')} />;
  }
  return <TransactionForm mode={mode} accounts={accounts.data} categories={categories.data} />;
}
