import { zodResolver } from '@hookform/resolvers/zod';
import { Checkbox, ErrorState, FormActions, FormGrid, LoadingState, TextField } from '@atria/ui';
import { useNavigate, useParams } from '@tanstack/react-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { ApiProblem } from '../../shared/api/problem';
import { FormColor } from '../../shared/forms/form-fields';
import { useT } from '../../shared/i18n/i18n';
import { FormScreen } from '../../shared/layout/form-screen';
import { StickyPageHeader } from '../../shared/layout/sticky-page-header';
import { BackLink } from '../../shared/navigation/back-link';
import {
  DEFAULT_LANE_COLOR,
  laneLabel,
  useCreateLane,
  useLanes,
  useUpdateLane,
} from './use-kanban';
import type { Lane } from './use-projects';

// As mensagens são chaves de tradução.
const schema = z.object({
  name: z.string().trim().min(1, 'common.field_required'),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'projects.lane_form.color_invalid'),
  counts_as_done: z.boolean(),
});
type Values = z.infer<typeof schema>;

function LaneForm({ project_id, lane }: { project_id: string; lane?: Lane }) {
  const t = useT();
  const navigate = useNavigate();
  const create = useCreateLane(project_id);
  const update = useUpdateLane(project_id);
  const [submit_error, setSubmitError] = useState<string>();
  const { control, register, handleSubmit, formState } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: lane ? laneLabel(lane, t) : '',
      color: lane?.color ?? DEFAULT_LANE_COLOR,
      counts_as_done: lane?.counts_as_done ?? false,
    },
  });
  const { errors, isSubmitting } = formState;
  const back = `/projects/${project_id}?tab=settings`;

  async function save(values: Values) {
    setSubmitError(undefined);
    // O HEX é gravado em minúsculas, como o servidor devolve.
    const body = {
      name: values.name.trim(),
      color: values.color.toLowerCase(),
      counts_as_done: values.counts_as_done,
    };
    try {
      if (lane) await update.mutateAsync({ lane_id: lane.id, patch: body });
      else await create.mutateAsync(body);
      await navigate({ to: `/projects/${project_id}`, search: { tab: 'settings' } });
    } catch (error) {
      setSubmitError(
        error instanceof ApiProblem && error.status === 422
          ? t('projects.lane_form.invalid')
          : t('projects.lane_form.submit_error'),
      );
    }
  }

  return (
    <FormScreen>
      <StickyPageHeader
        eyebrow={t(lane ? 'projects.lane_form.eyebrow_edit' : 'projects.lane_form.eyebrow_new')}
        title={t(lane ? 'projects.lane_form.title_edit' : 'projects.lane_form.title_new')}
        subtitle={t('projects.lane_form.subtitle')}
        back={<BackLink module="projects" fallback_to="/projects" to={back} />}
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
              label={t('projects.lane_form.field_name')}
              {...register('name')}
              {...(errors.name ? { error: t(errors.name.message ?? '') } : {})}
            />
          </div>
          <FormColor control={control} name="color" label={t('projects.lane_form.field_color')} />
          <div data-span="full">
            <Checkbox
              label={t('projects.lane_form.field_counts_as_done')}
              {...register('counts_as_done')}
            />
            <p>{t('projects.lane_form.counts_as_done_help')}</p>
          </div>
          <FormActions
            cancel_label={t('common.cancel')}
            submit_label={t('common.save')}
            loading={isSubmitting}
            onCancel={() => {
              void navigate({ to: `/projects/${project_id}`, search: { tab: 'settings' } });
            }}
          />
        </FormGrid>
      </form>
    </FormScreen>
  );
}

/** Criar (`.../lanes/new`) e editar (`.../lanes/$laneId/edit`) a raia em rota própria (PD-12, PD-43). */
export function LaneFormPage() {
  const ids = useParams({
    strict: false,
    select: (params: Record<string, unknown>) => ({
      project: typeof params.projectId === 'string' ? params.projectId : '',
      lane: typeof params.laneId === 'string' ? params.laneId : undefined,
    }),
  });
  return ids.lane === undefined ? (
    <LaneForm project_id={ids.project} />
  ) : (
    <EditLane project_id={ids.project} lane_id={ids.lane} />
  );
}

function EditLane({ project_id, lane_id }: { project_id: string; lane_id: string }) {
  const t = useT();
  const lanes = useLanes(project_id);
  if (lanes.isPending) return <LoadingState label={t('projects.lane_form.loading')} />;
  const lane = lanes.data?.find((item) => item.id === lane_id);
  if (lanes.isError || !lane) {
    return (
      <ErrorState
        title={t('projects.lane_form.not_found')}
        retryLabel={t('projects.list.retry')}
        onRetry={() => {
          void lanes.refetch();
        }}
      />
    );
  }
  return <LaneForm key={lane.id} project_id={project_id} lane={lane} />;
}
