import { zodResolver } from '@hookform/resolvers/zod';
import { Card, ErrorState, FormActions, FormGrid, LoadingState, TextField } from '@atria/ui';
import { useNavigate, useRouter } from '@tanstack/react-router';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { ApiProblem } from '../../../shared/api/problem';
import { FormDateTime, FormSegmented } from '../../../shared/forms/form-fields';
import {
  FormRecurrence,
  RECURRENCE_FREQUENCIES,
  RECURRENCE_WEEKDAYS,
  defaultRecurrenceRule,
} from '../../../shared/forms/recurrence-fields';
import { useT } from '../../../shared/i18n/i18n';
import { FormScreen } from '../../../shared/layout/form-screen';
import { StickyPageHeader } from '../../../shared/layout/sticky-page-header';
import { BackLink } from '../../../shared/navigation/back-link';
import { useBackTarget } from '../../../shared/navigation/back-target';
import { usePreferences } from '../../../shared/preferences/preferences-context';
import {
  localDay,
  localToUtc,
  toRequestRule,
  toRule,
  useCreateReminder,
  useReminder,
  useUpdateReminder,
  utcToLocal,
  type Reminder,
} from '../hooks/use-reminders';
import styles from './reminder-form-screen.module.css';

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

const rule_schema = z.object({
  frequency: z.enum(RECURRENCE_FREQUENCIES),
  interval: z.number().int().min(1, 'reminders.form.interval_invalid'),
  weekdays: z.array(z.enum(RECURRENCE_WEEKDAYS)),
  month_day: z.number().int().min(1).max(31).nullable(),
  // Obrigatório só no recorrente: a regra é conferida no `superRefine`.
  time: z.string().nullable(),
  timezone: z.string().min(1),
  starts_on: z.string().min(1, 'common.field_required'),
  ends_on: z.string().nullable(),
});

const form_schema = z
  .object({
    title: z.string().trim().min(1, 'common.field_required'),
    notes: z.string(),
    kind: z.enum(['one_off', 'recurring']),
    remind_at: z.string(),
    rule: rule_schema,
    visibility: z.enum(['personal', 'shared']),
  })
  .superRefine((values, context) => {
    if (values.kind === 'one_off') {
      if (values.remind_at === '') {
        context.addIssue({
          code: 'custom',
          path: ['remind_at'],
          message: 'reminders.form.remind_at_required',
        });
      }
      return;
    }
    const { time, frequency, weekdays } = values.rule;
    if (time === null || time === '') {
      context.addIssue({
        code: 'custom',
        path: ['rule', 'time'],
        message: 'reminders.form.time_required',
      });
    } else if (!TIME.test(time)) {
      context.addIssue({
        code: 'custom',
        path: ['rule', 'time'],
        message: 'reminders.form.time_invalid',
      });
    }
    if (frequency === 'weekly' && weekdays.length === 0) {
      context.addIssue({
        code: 'custom',
        path: ['rule', 'weekdays'],
        message: 'reminders.form.weekdays_required',
      });
    }
  });

type FormValues = z.infer<typeof form_schema>;

function initialValues(reminder: Reminder | undefined, time_zone: string): FormValues {
  const today = localDay(new Date().toISOString(), time_zone);
  return {
    title: reminder?.title ?? '',
    notes: reminder?.notes ?? '',
    kind: reminder?.kind ?? 'one_off',
    remind_at: reminder?.remind_at ? utcToLocal(reminder.remind_at, time_zone) : '',
    rule: reminder?.rule ? toRule(reminder.rule) : defaultRecurrenceRule(time_zone, today),
    visibility: reminder?.visibility ?? 'personal',
  };
}

function ReminderForm({ reminder }: { reminder?: Reminder }) {
  const t = useT();
  const navigate = useNavigate();
  const router = useRouter();
  const { time_zone } = usePreferences();
  const create = useCreateReminder();
  const update = useUpdateReminder();
  const [submit_error, setSubmitError] = useState<string | null>(null);
  const editing = reminder !== undefined;
  const back = useBackTarget({
    module: 'reminders',
    fallback_to: '/reminders',
    ...(editing ? { to: `/reminders/${reminder.id}` } : {}),
  });
  const { control, register, handleSubmit, formState, setError } = useForm<FormValues>({
    resolver: zodResolver(form_schema),
    defaultValues: initialValues(reminder, time_zone),
  });
  const kind = useWatch({ control, name: 'kind' });
  const title_error = formState.errors.title?.message;

  async function onSubmit(values: FormValues) {
    setSubmitError(null);
    const common = {
      title: values.title.trim(),
      notes: values.notes === '' ? null : values.notes,
      visibility: values.visibility,
      timezone: time_zone,
    };
    const body =
      values.kind === 'recurring'
        ? { ...common, rule: toRequestRule({ ...values.rule, timezone: time_zone }) }
        : { ...common, remind_at: localToUtc(values.remind_at, time_zone) };
    try {
      if (editing) {
        await update.mutateAsync({ id: reminder.id, body });
        await navigate({ to: '/reminders/$reminderId', params: { reminderId: reminder.id } });
        return;
      }
      const created = await create.mutateAsync(body);
      await navigate({ to: '/reminders/$reminderId', params: { reminderId: created.id } });
    } catch (error) {
      if (error instanceof ApiProblem && error.status === 422) {
        for (const field of error.errors) {
          if (field.field === 'title') {
            setError('title', { message: 'reminders.form.save_error' });
          }
        }
        setSubmitError('common.errors.validation_failed');
        return;
      }
      setSubmitError('reminders.form.save_error');
    }
  }

  return (
    <FormScreen>
      <StickyPageHeader
        back={
          <BackLink
            module="reminders"
            fallback_to="/reminders"
            {...(editing ? { to: back } : {})}
          />
        }
        eyebrow={t(editing ? 'reminders.form.edit_eyebrow' : 'reminders.form.new_eyebrow')}
        title={t(editing ? 'reminders.form.edit_title' : 'reminders.form.new_title')}
        subtitle={t(editing ? 'reminders.form.edit_subtitle' : 'reminders.form.new_subtitle')}
      />
      <Card>
        <form
          noValidate
          onSubmit={(event) => {
            void handleSubmit(onSubmit)(event);
          }}
        >
          <FormGrid>
            <div data-span="full">
              <TextField
                label={t('reminders.form.title')}
                {...register('title')}
                {...(title_error ? { error: t(title_error) } : {})}
              />
            </div>
            <div data-span="full" className={styles.field}>
              <label htmlFor="reminder-notes" className={styles.label}>
                {t('reminders.form.notes')}
              </label>
              <textarea
                id="reminder-notes"
                className={styles.textarea}
                rows={4}
                {...register('notes')}
              />
            </div>
            <div data-span="full">
              <FormSegmented
                control={control}
                name="kind"
                label={t('reminders.form.kind')}
                options={[
                  { value: 'one_off', label: t('reminders.form.kind_one_off') },
                  { value: 'recurring', label: t('reminders.form.kind_recurring') },
                ]}
              />
            </div>
            {kind === 'one_off' ? (
              <div data-span="full">
                <FormDateTime
                  control={control}
                  name="remind_at"
                  label={t('reminders.form.remind_at')}
                />
              </div>
            ) : (
              <div data-span="full">
                <FormRecurrence control={control} name="rule" time_required />
                {editing ? (
                  <p className={styles.note}>{t('reminders.form.recurring_note')}</p>
                ) : null}
              </div>
            )}
            <div data-span="full">
              <FormSegmented
                control={control}
                name="visibility"
                label={t('reminders.form.visibility')}
                options={[
                  { value: 'personal', label: t('reminders.form.visibility_personal') },
                  { value: 'shared', label: t('reminders.form.visibility_shared') },
                ]}
              />
            </div>
            {submit_error ? (
              <p role="alert" className={styles.error} data-span="full">
                {t(submit_error)}
              </p>
            ) : null}
            <FormActions
              cancel_label={t('common.cancel')}
              submit_label={t('common.save')}
              loading={formState.isSubmitting}
              onCancel={() => {
                router.history.push(back);
              }}
            />
          </FormGrid>
        </form>
      </Card>
    </FormScreen>
  );
}

export interface ReminderFormScreenProps {
  /** Ausente: cria. */
  reminder_id?: string;
}

function EditLoader({ reminder_id }: { reminder_id: string }) {
  const t = useT();
  const query = useReminder(reminder_id);
  if (query.isPending) return <LoadingState label={t('common.loading')} />;
  if (query.data === undefined) {
    return (
      <ErrorState
        title={t('reminders.detail.error_title')}
        retryLabel={t('common.retry')}
        onRetry={() => {
          void query.refetch();
        }}
      />
    );
  }
  return <ReminderForm reminder={query.data} />;
}

export function ReminderFormScreen({ reminder_id }: ReminderFormScreenProps) {
  return reminder_id === undefined ? <ReminderForm /> : <EditLoader reminder_id={reminder_id} />;
}
