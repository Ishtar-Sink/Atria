import { zodResolver } from '@hookform/resolvers/zod';
import { Card, ErrorState, FormActions, FormGrid, LoadingState, TextField } from '@atria/ui';
import { useNavigate, useRouter } from '@tanstack/react-router';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { ApiProblem } from '../../../shared/api/problem';
import { FormDate, FormSegmented, FormTags } from '../../../shared/forms/form-fields';
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
  toRequestRule,
  toRule,
  todayIn,
  useCreateTask,
  useTask,
  useUpdateTask,
  type Task,
} from '../hooks/use-tasks';
import styles from './task-form-screen.module.css';

const MAX_LABELS = 20;
const MAX_LABEL_LENGTH = 50;

const rule_schema = z.object({
  frequency: z.enum(RECURRENCE_FREQUENCIES),
  interval: z.number().int().min(1, 'tasks.form.interval_invalid'),
  weekdays: z.array(z.enum(RECURRENCE_WEEKDAYS)),
  month_day: z.number().int().min(1).max(31).nullable(),
  // A regra de recorrência da spec tem sempre o horário; ele é exigido no superRefine, só na
  // tarefa recorrente (a pontual não usa a regra).
  time: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'tasks.form.time_invalid')
    .nullable(),
  timezone: z.string().min(1),
  starts_on: z.string().min(1, 'common.field_required'),
  ends_on: z.string().nullable(),
});

const form_schema = z
  .object({
    title: z.string().trim().min(1, 'common.field_required'),
    description: z.string(),
    kind: z.enum(['single', 'recurring']),
    due_on: z.string(),
    rule: rule_schema,
    labels: z.array(z.string()),
    visibility: z.enum(['personal', 'shared']),
  })
  .superRefine((values, context) => {
    const { labels } = values;
    const lowered = labels.map((label) => label.toLowerCase());
    if (labels.length > MAX_LABELS) {
      context.addIssue({ code: 'custom', path: ['labels'], message: 'tasks.form.labels_max' });
    } else if (labels.some((label) => label.length > MAX_LABEL_LENGTH)) {
      context.addIssue({ code: 'custom', path: ['labels'], message: 'tasks.form.label_too_long' });
    } else if (new Set(lowered).size !== lowered.length) {
      context.addIssue({
        code: 'custom',
        path: ['labels'],
        message: 'tasks.form.labels_duplicate',
      });
    }
    if (values.kind === 'recurring' && (values.rule.time ?? '') === '') {
      context.addIssue({
        code: 'custom',
        path: ['rule', 'time'],
        message: 'tasks.form.time_required',
      });
    }
    if (
      values.kind === 'recurring' &&
      values.rule.frequency === 'weekly' &&
      values.rule.weekdays.length === 0
    ) {
      context.addIssue({
        code: 'custom',
        path: ['rule', 'weekdays'],
        message: 'tasks.form.weekdays_required',
      });
    }
  });

type FormValues = z.infer<typeof form_schema>;

function initialValues(task: Task | undefined, time_zone: string, today: string): FormValues {
  const base = defaultRecurrenceRule(time_zone, today);
  return {
    title: task?.title ?? '',
    description: task?.description ?? '',
    kind: task?.is_recurring === true ? 'recurring' : 'single',
    due_on: task?.due_on ?? '',
    rule: task?.recurrence ? toRule(task.recurrence) : base,
    labels: task?.labels ?? [],
    visibility: task?.visibility ?? 'personal',
  };
}

interface TaskFormProps {
  task?: Task;
  /** Data da ocorrência de onde a edição partiu (RN-08). */
  from?: string | undefined;
}

function TaskForm({ task, from }: TaskFormProps) {
  const t = useT();
  const navigate = useNavigate();
  const router = useRouter();
  const { time_zone } = usePreferences();
  const create = useCreateTask();
  const update = useUpdateTask();
  const [submit_error, setSubmitError] = useState<string | null>(null);
  const editing = task !== undefined;
  const back = useBackTarget({
    module: 'tasks',
    fallback_to: '/tasks',
    ...(editing ? { to: `/tasks/${task.id}` } : {}),
  });
  const { control, register, handleSubmit, formState, setError } = useForm<FormValues>({
    resolver: zodResolver(form_schema),
    defaultValues: initialValues(task, time_zone, todayIn(time_zone)),
  });
  const kind = useWatch({ control, name: 'kind' });
  const title_error = formState.errors.title?.message;

  async function onSubmit(values: FormValues) {
    setSubmitError(null);
    const recurring = values.kind === 'recurring';
    const common = {
      title: values.title.trim(),
      description: values.description === '' ? null : values.description,
      due_on: !recurring && values.due_on !== '' ? values.due_on : null,
      labels: values.labels,
      visibility: values.visibility,
      recurrence: recurring ? toRequestRule(values.rule) : null,
    };
    try {
      if (editing) {
        await update.mutateAsync({
          id: task.id,
          body: { ...common, ...(recurring && from ? { effective_from: from } : {}) },
        });
        await navigate({ to: '/tasks/$taskId', params: { taskId: task.id } });
        return;
      }
      const created = await create.mutateAsync(common);
      await navigate({ to: '/tasks/$taskId', params: { taskId: created.id } });
    } catch (error) {
      if (error instanceof ApiProblem && error.status === 422) {
        for (const field of error.errors) {
          if (field.field === 'labels' || field.field === 'title') {
            setError(field.field, { message: 'tasks.form.save_error' });
          }
        }
        setSubmitError('common.errors.validation_failed');
        return;
      }
      setSubmitError('tasks.form.save_error');
    }
  }

  return (
    <FormScreen>
      <StickyPageHeader
        back={<BackLink module="tasks" fallback_to="/tasks" {...(editing ? { to: back } : {})} />}
        eyebrow={t(editing ? 'tasks.form.edit_eyebrow' : 'tasks.form.new_eyebrow')}
        title={t(editing ? 'tasks.form.edit_title' : 'tasks.form.new_title')}
        subtitle={t(editing ? 'tasks.form.edit_subtitle' : 'tasks.form.new_subtitle')}
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
                label={t('tasks.form.title')}
                {...register('title')}
                {...(title_error ? { error: t(title_error) } : {})}
              />
            </div>
            <div data-span="full" className={styles.field}>
              <label htmlFor="task-description" className={styles.label}>
                {t('tasks.form.description')}
              </label>
              <textarea
                id="task-description"
                className={styles.textarea}
                rows={4}
                {...register('description')}
              />
            </div>
            <div data-span="full">
              <FormSegmented
                control={control}
                name="kind"
                label={t('tasks.form.kind')}
                options={[
                  { value: 'single', label: t('tasks.form.kind_single') },
                  { value: 'recurring', label: t('tasks.form.kind_recurring') },
                ]}
              />
            </div>
            {kind === 'single' ? (
              <FormDate control={control} name="due_on" label={t('tasks.form.due_on')} />
            ) : (
              <div data-span="full">
                <FormRecurrence control={control} name="rule" time_required />
                {editing && from ? (
                  <p className={styles.note}>{t('tasks.form.from_occurrence')}</p>
                ) : null}
              </div>
            )}
            <div data-span="full">
              <FormTags
                control={control}
                name="labels"
                label={t('tasks.form.labels')}
                help={t('tasks.form.labels_help')}
              />
            </div>
            <div data-span="full">
              <FormSegmented
                control={control}
                name="visibility"
                label={t('tasks.form.visibility')}
                options={[
                  { value: 'personal', label: t('tasks.form.visibility_personal') },
                  { value: 'shared', label: t('tasks.form.visibility_shared') },
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

export interface TaskFormScreenProps {
  /** Ausente: cria. */
  task_id?: string;
  from?: string | undefined;
}

function EditLoader({ task_id, from }: { task_id: string; from: string | undefined }) {
  const t = useT();
  const query = useTask(task_id);
  if (query.isPending) return <LoadingState label={t('common.loading')} />;
  if (query.data === undefined) {
    return (
      <ErrorState
        title={t('tasks.detail.error_title')}
        retryLabel={t('common.retry')}
        onRetry={() => {
          void query.refetch();
        }}
      />
    );
  }
  return <TaskForm task={query.data} from={from} />;
}

export function TaskFormScreen({ task_id, from }: TaskFormScreenProps) {
  return task_id === undefined ? <TaskForm /> : <EditLoader task_id={task_id} from={from} />;
}
