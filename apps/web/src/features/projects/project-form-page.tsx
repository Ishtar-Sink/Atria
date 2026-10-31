import { zodResolver } from '@hookform/resolvers/zod';
import { ErrorState, FormActions, FormGrid, LoadingState, TextField } from '@atria/ui';
import { useNavigate, useParams } from '@tanstack/react-router';
import { useId, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { ApiProblem } from '../../shared/api/problem';
import { FormSegmented } from '../../shared/forms/form-fields';
import { useT } from '../../shared/i18n/i18n';
import { FormScreen } from '../../shared/layout/form-screen';
import { StickyPageHeader } from '../../shared/layout/sticky-page-header';
import { BackLink } from '../../shared/navigation/back-link';
import styles from './projects.module.css';
import { useCreateProject, useProject, useUpdateProject, type Project } from './use-projects';

// As mensagens são chaves de tradução; as mesmas regras do servidor (TASK-14).
const schema = z.object({
  name: z.string().trim().min(1, 'common.field_required'),
  description: z.string(),
  visibility: z.enum(['personal', 'shared']),
});
type Values = z.infer<typeof schema>;

function ProjectForm({ project }: { project?: Project }) {
  const t = useT();
  const navigate = useNavigate();
  const description_id = useId();
  const create = useCreateProject();
  const update = useUpdateProject();
  const [submit_error, setSubmitError] = useState<string>();
  const { control, register, handleSubmit, setError, formState } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: project?.name ?? '',
      description: project?.description ?? '',
      visibility: project?.visibility ?? 'personal',
    },
  });
  const { errors, isSubmitting } = formState;

  async function save(values: Values) {
    setSubmitError(undefined);
    const body = {
      name: values.name.trim(),
      description: values.description.trim() === '' ? null : values.description.trim(),
      visibility: values.visibility,
    };
    try {
      if (project) {
        await update.mutateAsync({ id: project.id, patch: body });
        await navigate({ to: `/projects/${project.id}` });
      } else {
        const created = await create.mutateAsync(body);
        await navigate({ to: `/projects/${created.id}` });
      }
    } catch (error) {
      const fields = error instanceof ApiProblem && error.status === 422 ? error.errors : [];
      const named = fields.some((item) => item.field === 'name');
      if (named) setError('name', { message: 'projects.form.submit_error' });
      else setSubmitError(t('projects.form.submit_error'));
    }
  }

  return (
    <FormScreen>
      <StickyPageHeader
        eyebrow={t(project ? 'projects.form.eyebrow_edit' : 'projects.form.eyebrow_new')}
        title={t(project ? 'projects.form.title_edit' : 'projects.form.title_new')}
        subtitle={t('projects.form.subtitle')}
        back={
          <BackLink
            module="projects"
            fallback_to="/projects"
            {...(project ? { to: `/projects/${project.id}` } : {})}
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
              label={t('projects.form.field_name')}
              {...register('name')}
              {...(errors.name ? { error: t(errors.name.message ?? '') } : {})}
            />
          </div>
          <div data-span="full" className={styles.textareaRoot}>
            <label htmlFor={description_id} className={styles.textareaLabel}>
              {t('projects.form.field_description')}
            </label>
            <textarea
              id={description_id}
              className={styles.textarea}
              {...register('description')}
            />
          </div>
          <div data-span="full">
            <FormSegmented
              control={control}
              name="visibility"
              label={t('projects.form.field_visibility')}
              options={[
                { value: 'personal', label: t('projects.visibility.personal') },
                { value: 'shared', label: t('projects.visibility.shared') },
              ]}
            />
          </div>
          <FormActions
            cancel_label={t('common.cancel')}
            submit_label={t('common.save')}
            loading={isSubmitting}
            onCancel={() => {
              void navigate({ to: project ? `/projects/${project.id}` : '/projects' });
            }}
          />
        </FormGrid>
      </form>
    </FormScreen>
  );
}

/** Criar (`/projects/new`) e editar (`/projects/$projectId/edit`) o projeto em rota própria. */
export function ProjectFormPage() {
  const projectId = useParams({
    strict: false,
    select: (params: Record<string, unknown>) =>
      typeof params.projectId === 'string' ? params.projectId : undefined,
  });
  return projectId ? <EditProject project_id={projectId} /> : <ProjectForm />;
}

function EditProject({ project_id }: { project_id: string }) {
  const t = useT();
  const query = useProject(project_id);
  if (query.isPending) return <LoadingState label={t('projects.form.loading')} />;
  if (query.isError) {
    return (
      <ErrorState
        title={t('projects.form.not_found')}
        retryLabel={t('projects.list.retry')}
        onRetry={() => {
          void query.refetch();
        }}
      />
    );
  }
  return <ProjectForm key={query.data.id} project={query.data} />;
}
