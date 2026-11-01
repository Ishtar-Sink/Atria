import { zodResolver } from '@hookform/resolvers/zod';
import {
  ConfirmDialog,
  ErrorState,
  FormActions,
  FormGrid,
  LoadingState,
  MenuButton,
  TextField,
} from '@atria/ui';
import { useNavigate, useParams, useRouterState } from '@tanstack/react-router';
import { useId, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { ApiProblem } from '../../shared/api/problem';
import { FormDate, FormSelect, FormTags } from '../../shared/forms/form-fields';
import { useT } from '../../shared/i18n/i18n';
import { FormScreen } from '../../shared/layout/form-screen';
import { StickyPageHeader } from '../../shared/layout/sticky-page-header';
import { BackLink } from '../../shared/navigation/back-link';
import { ChecklistField } from './checklist-field';
import { MoreIcon } from './icons';
import styles from './projects.module.css';
import { useCardTask, useOpenTasks, useSetCardTask, type CardTask } from './use-card-task-link';
import {
  CHECKLIST_MAX_ITEMS,
  CHECKLIST_TEXT_MAX_CHARS,
  laneLabel,
  toChecklistDrafts,
  toChecklistInput,
  useCard,
  useCreateCard,
  useDeleteCard,
  useLanes,
  useMoveCard,
  useUpdateCard,
} from './use-kanban';
import { PRIORITIES, useProject, type Card, type Lane } from './use-projects';

const MAX_LABELS = 20;
const MAX_LABEL_LENGTH = 50;

// As mensagens são chaves de tradução; as mesmas regras do servidor (TASK-14).
const schema = z.object({
  title: z.string().trim().min(1, 'common.field_required'),
  description: z.string(),
  lane_id: z.string().min(1, 'common.field_required'),
  due_date: z.string(),
  priority: z.string(),
  task_id: z.string(),
  labels: z
    .array(z.string())
    .max(MAX_LABELS, 'projects.card_form.labels_too_many')
    .refine((labels) => labels.every((label) => label.length <= MAX_LABEL_LENGTH), {
      message: 'projects.card_form.label_too_long',
    })
    .refine(
      (labels) => new Set(labels.map((label) => label.toLowerCase())).size === labels.length,
      { message: 'projects.card_form.label_duplicate' },
    ),
  checklist: z
    .array(z.object({ key: z.string(), text: z.string(), done: z.boolean() }))
    .max(CHECKLIST_MAX_ITEMS, 'projects.card_form.checklist_too_many')
    .refine((items) => items.every((item) => item.text.trim().length <= CHECKLIST_TEXT_MAX_CHARS), {
      message: 'projects.card_form.checklist_item_too_long',
    }),
});
type Values = z.infer<typeof schema>;

interface CardFormProps {
  project_id: string;
  lanes: readonly Lane[];
  card: Card | undefined;
  /** Raia pré-escolhida na URL (`?lane=`), ao criar a partir do "+ Adicionar cartão". */
  initial_lane: string | undefined;
  linked: CardTask | null | undefined;
}

function CardForm({ project_id, lanes, card, initial_lane, linked }: CardFormProps) {
  const t = useT();
  const navigate = useNavigate();
  const description_id = useId();
  const project = useProject(project_id);
  const tasks = useOpenTasks();
  const create = useCreateCard(project_id);
  const update = useUpdateCard(project_id);
  const move = useMoveCard(project_id);
  const remove = useDeleteCard(project_id);
  const set_task = useSetCardTask();
  const [submit_error, setSubmitError] = useState<string>();
  const [confirming, setConfirming] = useState(false);
  const first_lane = lanes.find((lane) => lane.id === initial_lane)?.id ?? lanes[0]?.id ?? '';
  const { control, register, handleSubmit, formState } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: card?.title ?? '',
      description: card?.description ?? '',
      lane_id: card?.lane_id ?? first_lane,
      due_date: card?.due_date ?? '',
      priority: card?.priority ?? '',
      task_id: linked?.task_id ?? '',
      labels: card?.labels ?? [],
      checklist: toChecklistDrafts(card?.checklist ?? []),
    },
  });
  const { errors, isSubmitting } = formState;
  const board = { to: `/projects/${project_id}`, search: { tab: 'board' } } as const;

  const task_options = [
    { value: '', label: t('projects.card_form.task_none') },
    ...(linked && !(tasks.data ?? []).some((task) => task.id === linked.task_id)
      ? [{ value: linked.task_id, label: linked.title }]
      : []),
    ...(tasks.data ?? []).map((task) => ({ value: task.id, label: task.title })),
  ];

  async function save(values: Values) {
    setSubmitError(undefined);
    const body = {
      title: values.title.trim(),
      description: values.description.trim() === '' ? null : values.description.trim(),
      due_date: values.due_date === '' ? null : values.due_date,
      priority: values.priority === '' ? null : values.priority,
      labels: values.labels,
      checklist: toChecklistInput(values.checklist),
    };
    try {
      let card_id: string;
      if (card) {
        card_id = card.id;
        await update.mutateAsync({ card_id, patch: body });
        if (values.lane_id !== card.lane_id) {
          await move.mutateAsync({ card_id, lane_id: values.lane_id });
        }
      } else {
        const created = await create.mutateAsync({ ...body, lane_id: values.lane_id });
        card_id = created.id;
      }
      const task_id = values.task_id === '' ? null : values.task_id;
      if (task_id !== (linked?.task_id ?? null)) {
        await set_task.mutateAsync({ card_id, task_id });
      }
      await navigate(board);
    } catch (error) {
      setSubmitError(
        error instanceof ApiProblem && error.status === 422
          ? t('projects.card_form.invalid')
          : t('projects.card_form.submit_error'),
      );
    }
  }

  return (
    <FormScreen>
      <StickyPageHeader
        eyebrow={project.data?.name ?? t('projects.card_form.eyebrow')}
        title={t(card ? 'projects.card_form.title_edit' : 'projects.card_form.title_new')}
        subtitle={t('projects.card_form.subtitle')}
        back={
          <BackLink
            module="projects"
            fallback_to="/projects"
            to={`/projects/${project_id}?tab=board`}
          />
        }
        {...(card
          ? {
              actions: (
                <MenuButton
                  label={t('projects.card_form.more_actions')}
                  trigger={<MoreIcon />}
                  items={[
                    {
                      id: 'delete',
                      label: t('projects.card_form.delete'),
                      tone: 'danger',
                      onSelect: () => {
                        setConfirming(true);
                      },
                    },
                  ]}
                />
              ),
            }
          : {})}
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
              label={t('projects.card_form.field_title')}
              {...register('title')}
              {...(errors.title ? { error: t(errors.title.message ?? '') } : {})}
            />
          </div>
          <div data-span="full" className={styles.textareaRoot}>
            <label htmlFor={description_id} className={styles.textareaLabel}>
              {t('projects.card_form.field_description')}
            </label>
            <textarea
              id={description_id}
              className={styles.textarea}
              {...register('description')}
            />
          </div>
          <FormSelect
            control={control}
            name="lane_id"
            label={t('projects.card_form.field_lane')}
            options={lanes.map((lane) => ({ value: lane.id, label: laneLabel(lane, t) }))}
          />
          <FormDate control={control} name="due_date" label={t('projects.card_form.field_due')} />
          <FormSelect
            control={control}
            name="priority"
            label={t('projects.card_form.field_priority')}
            options={[
              { value: '', label: t('projects.priority.none') },
              ...PRIORITIES.map((priority) => ({
                value: priority,
                label: t(`projects.priority.${priority}`),
              })),
            ]}
          />
          <FormSelect
            control={control}
            name="task_id"
            label={t('projects.card_form.field_task')}
            help={t('projects.card_form.field_task_help')}
            options={task_options}
          />
          <div data-span="full">
            <FormTags
              control={control}
              name="labels"
              label={t('projects.card_form.field_labels')}
              help={t('projects.card_form.field_labels_help')}
            />
          </div>
          <Controller
            control={control}
            name="checklist"
            render={({ field, fieldState }) => (
              <ChecklistField
                label={t('projects.card_form.field_checklist')}
                help={t('projects.card_form.checklist_help')}
                items={field.value}
                onChange={field.onChange}
                error={fieldState.error?.message ? t(fieldState.error.message) : undefined}
              />
            )}
          />
          <FormActions
            cancel_label={t('common.cancel')}
            submit_label={t('common.save')}
            loading={isSubmitting}
            onCancel={() => {
              void navigate(board);
            }}
          />
        </FormGrid>
      </form>
      <ConfirmDialog
        open={confirming}
        title={t('projects.card_form.delete_title')}
        description={t('projects.card_form.delete_description')}
        confirmLabel={t('projects.card_form.delete_confirm')}
        cancelLabel={t('projects.card_form.delete_cancel')}
        onCancel={() => {
          setConfirming(false);
        }}
        onConfirm={() => {
          setConfirming(false);
          if (!card) return;
          remove.mutate(
            { card_id: card.id },
            {
              onSuccess: () => {
                void navigate(board);
              },
            },
          );
        }}
      />
    </FormScreen>
  );
}

/** Criar (`.../cards/new?lane=`) e editar (`.../cards/$cardId`) o cartão em rota própria (PD-46). */
export function CardFormPage() {
  const t = useT();
  const ids = useParams({
    strict: false,
    select: (params: Record<string, unknown>) => ({
      project: typeof params.projectId === 'string' ? params.projectId : '',
      card: typeof params.cardId === 'string' ? params.cardId : undefined,
    }),
  });
  const lane_param = useRouterState({
    select: (state) => {
      const lane = (state.location.search as Record<string, unknown>).lane;
      return typeof lane === 'string' ? lane : undefined;
    },
  });
  const lanes = useLanes(ids.project);
  const card = useCard(ids.project, ids.card);
  const linked = useCardTask(ids.card);
  const editing = ids.card !== undefined;

  if (lanes.isPending || (editing && (card.isPending || linked.isPending))) {
    return <LoadingState label={t('projects.card_form.loading')} />;
  }
  if (lanes.isError || (editing && (card.isError || linked.isError))) {
    return (
      <ErrorState
        title={t('projects.card_form.not_found')}
        retryLabel={t('projects.list.retry')}
        onRetry={() => {
          void lanes.refetch();
          void card.refetch();
          void linked.refetch();
        }}
      />
    );
  }
  return (
    <CardForm
      key={ids.card ?? 'new'}
      project_id={ids.project}
      lanes={lanes.data}
      card={editing ? card.data : undefined}
      initial_lane={lane_param}
      linked={editing ? linked.data : undefined}
    />
  );
}
