import { zodResolver } from '@hookform/resolvers/zod';
import { ErrorState, FormActions, FormGrid, LoadingState, TextField } from '@atria/ui';
import { useNavigate, useParams } from '@tanstack/react-router';
import { useId, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { NotFoundPage } from '../../../app/layout/not-found-page';
import { ApiProblem } from '../../../shared/api/problem';
import { FormDate, FormSegmented, FormSelect, FormTags } from '../../../shared/forms/form-fields';
import { useT } from '../../../shared/i18n/i18n';
import { FormScreen } from '../../../shared/layout/form-screen';
import { StickyPageHeader } from '../../../shared/layout/sticky-page-header';
import { BackLink } from '../../../shared/navigation/back-link';
import { useCreateGoal, useGoal, useUpdateGoal } from '../hooks/use-goals';
import { GOAL_STATUSES, type Goal } from '../lib/goal-progress';
import styles from './goals.module.css';

const MAX_LABELS = 20;
const MAX_LABEL_LENGTH = 50;

// As mensagens são chaves de tradução; as mesmas regras do servidor (TASK-08).
const schema = z.object({
  title: z.string().trim().min(1, 'common.field_required'),
  description: z.string(),
  deadline: z.string(),
  status: z.enum(GOAL_STATUSES),
  labels: z
    .array(z.string())
    .max(MAX_LABELS, 'goals.form.labels_too_many')
    .refine((labels) => labels.every((label) => label.length <= MAX_LABEL_LENGTH), {
      message: 'goals.form.label_too_long',
    })
    .refine(
      (labels) => new Set(labels.map((label) => label.toLowerCase())).size === labels.length,
      { message: 'goals.form.label_duplicate' },
    ),
  visibility: z.enum(['personal', 'shared']),
});
type Values = z.infer<typeof schema>;

const FIELDS: readonly (keyof Values)[] = [
  'title',
  'description',
  'deadline',
  'status',
  'labels',
  'visibility',
];

function initialValues(goal: Goal | undefined): Values {
  return {
    title: goal?.title ?? '',
    description: goal?.description ?? '',
    deadline: goal?.deadline ?? '',
    status: goal?.status ?? 'planned',
    labels: goal?.labels ?? [],
    visibility: goal?.visibility ?? 'personal',
  };
}

function GoalForm({ goal }: { goal?: Goal }) {
  const t = useT();
  const navigate = useNavigate();
  const description_id = useId();
  const create = useCreateGoal();
  const update = useUpdateGoal();
  const [submit_error, setSubmitError] = useState<string>();
  const { control, register, handleSubmit, setError, formState } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: initialValues(goal),
  });
  const { errors, isSubmitting } = formState;

  async function save(values: Values) {
    setSubmitError(undefined);
    const body = {
      title: values.title.trim(),
      description: values.description.trim() === '' ? null : values.description.trim(),
      deadline: values.deadline === '' ? null : values.deadline,
      status: values.status,
      labels: values.labels,
      visibility: values.visibility,
    };
    try {
      if (goal) {
        await update.mutateAsync({ id: goal.id, patch: body });
        await navigate({ to: `/goals/${goal.id}` });
      } else {
        await create.mutateAsync(body);
      }
    } catch (error) {
      // Recusa do servidor (422): o erro aparece no campo, ou no topo quando não é de um campo.
      const fields = error instanceof ApiProblem && error.status === 422 ? error.errors : [];
      const known = fields.filter((item): item is { field: keyof Values; code: string } =>
        FIELDS.some((field) => field === item.field),
      );
      known.forEach((item) => {
        setError(item.field, { message: 'goals.form.submit_error' });
      });
      if (known.length === 0) setSubmitError(t('goals.form.submit_error'));
    }
  }

  const cancel_to = goal ? `/goals/${goal.id}` : '/goals';
  return (
    <FormScreen>
      <StickyPageHeader
        eyebrow={t(goal ? 'goals.form.eyebrow_edit' : 'goals.form.eyebrow_new')}
        title={t(goal ? 'goals.form.title_edit' : 'goals.form.title_new')}
        subtitle={t('goals.form.subtitle')}
        back={
          <BackLink
            module="goals"
            fallback_to="/goals"
            {...(goal ? { to: `/goals/${goal.id}` } : {})}
          />
        }
      />
      <form
        noValidate
        onSubmit={(event) => {
          void handleSubmit(save)(event);
        }}
      >
        <FormGrid>
          {submit_error ? (
            <p role="alert" data-span="full">
              {submit_error}
            </p>
          ) : null}
          <div data-span="full">
            <TextField
              label={t('goals.form.field_title')}
              {...register('title')}
              {...(errors.title ? { error: t(errors.title.message ?? '') } : {})}
            />
          </div>
          <div data-span="full" className={styles.textareaRoot}>
            <label htmlFor={description_id} className={styles.textareaLabel}>
              {t('goals.form.field_description')}
            </label>
            <textarea
              id={description_id}
              className={styles.textarea}
              {...register('description')}
            />
          </div>
          <FormSelect
            control={control}
            name="status"
            label={t('goals.form.field_status')}
            options={GOAL_STATUSES.map((status) => ({
              value: status,
              label: t(`goals.status.${status}`),
            }))}
          />
          <FormDate control={control} name="deadline" label={t('goals.form.field_deadline')} />
          <div data-span="full">
            <FormTags
              control={control}
              name="labels"
              label={t('goals.form.field_labels')}
              help={t('goals.form.field_labels_help')}
            />
          </div>
          <div data-span="full">
            <FormSegmented
              control={control}
              name="visibility"
              label={t('goals.form.field_visibility')}
              options={[
                { value: 'personal', label: t('goals.form.visibility_personal') },
                { value: 'shared', label: t('goals.form.visibility_shared') },
              ]}
            />
          </div>
          <FormActions
            cancel_label={t('common.cancel')}
            submit_label={t('common.save')}
            loading={isSubmitting}
            onCancel={() => {
              void navigate({ to: cancel_to });
            }}
          />
        </FormGrid>
      </form>
    </FormScreen>
  );
}

/** Criar (`/goals/new`) e editar (`/goals/$goalId/edit`) a meta em rota própria. */
export function GoalFormScreen() {
  const goalId = useParams({
    strict: false,
    select: (params: Record<string, unknown>) =>
      typeof params.goalId === 'string' ? params.goalId : undefined,
  });
  return goalId ? <EditGoal goal_id={goalId} /> : <GoalForm />;
}

function EditGoal({ goal_id }: { goal_id: string }) {
  const t = useT();
  const query = useGoal(goal_id);
  if (query.isPending) return <LoadingState label={t('goals.form.loading')} />;
  if (query.isError) {
    if (query.error instanceof ApiProblem && query.error.status === 404) return <NotFoundPage />;
    return (
      <ErrorState
        title={t('goals.form.not_found')}
        retryLabel={t('goals.detail.retry')}
        onRetry={() => {
          void query.refetch();
        }}
      />
    );
  }
  return <GoalForm key={query.data.id} goal={query.data} />;
}
