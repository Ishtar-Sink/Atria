import { ErrorState, FormActions, FormGrid, LoadingState, TextField } from '@atria/ui';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate, useParams } from '@tanstack/react-router';
import { useId, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { ApiProblem } from '../../../shared/api/problem';
import { FormSegmented } from '../../../shared/forms/form-fields';
import { useT } from '../../../shared/i18n/i18n';
import { FormScreen } from '../../../shared/layout/form-screen';
import { StickyPageHeader } from '../../../shared/layout/sticky-page-header';
import { BackLink } from '../../../shared/navigation/back-link';
import {
  isNoteNotFound,
  useCreateNote,
  useNote,
  useUpdateNote,
  type Note,
} from '../hooks/use-notes';
import styles from './notes.module.css';

// As mensagens são chaves de tradução; as mesmas regras do servidor (TASK-11).
const schema = z.object({
  title: z.string().trim().min(1, 'common.field_required').max(200, 'notes.form.title_too_long'),
  body: z.string().max(100_000, 'notes.form.body_too_long'),
  visibility: z.enum(['personal', 'shared']),
});
type Values = z.infer<typeof schema>;

const FIELDS: readonly (keyof Values)[] = ['title', 'body', 'visibility'];

function initialValues(note: Note | undefined): Values {
  return {
    title: note?.title ?? '',
    body: note?.body ?? '',
    visibility: note?.visibility ?? 'personal',
  };
}

function NoteForm({ note }: { note?: Note }) {
  const t = useT();
  const navigate = useNavigate();
  const body_id = useId();
  const create = useCreateNote();
  const update = useUpdateNote();
  const [submit_error, setSubmitError] = useState<string>();
  const { control, register, handleSubmit, setError, formState } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: initialValues(note),
  });
  const { errors, isSubmitting } = formState;

  async function save(values: Values) {
    setSubmitError(undefined);
    const payload = {
      title: values.title.trim(),
      body: values.body,
      visibility: values.visibility,
    };
    try {
      if (note) {
        await update.mutateAsync({ id: note.id, patch: payload });
        await navigate({ to: `/notes/${note.id}` });
      } else {
        await create.mutateAsync(payload);
      }
    } catch (error) {
      // Recusa do servidor (422): o erro aparece no campo, ou no topo quando não é de um campo.
      const fields = error instanceof ApiProblem && error.status === 422 ? error.errors : [];
      const known = fields.filter((item): item is { field: keyof Values; code: string } =>
        FIELDS.some((field) => field === item.field),
      );
      known.forEach((item) => {
        setError(item.field, { message: 'notes.form.submit_error' });
      });
      if (known.length === 0) setSubmitError(t('notes.form.submit_error'));
    }
  }

  const cancel_to = note ? `/notes/${note.id}` : '/notes';
  const body_error = errors.body?.message;
  return (
    <FormScreen>
      <StickyPageHeader
        eyebrow={t(note ? 'notes.form.eyebrow_edit' : 'notes.form.eyebrow_new')}
        title={t(note ? 'notes.form.title_edit' : 'notes.form.title_new')}
        subtitle={t('notes.form.subtitle')}
        back={
          <BackLink
            module="notes"
            fallback_to="/notes"
            {...(note ? { to: `/notes/${note.id}` } : {})}
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
              label={t('notes.form.field_title')}
              {...register('title')}
              {...(errors.title ? { error: t(errors.title.message ?? '') } : {})}
            />
          </div>
          <div data-span="full" className={styles.textareaRoot}>
            <label htmlFor={body_id} className={styles.textareaLabel}>
              {t('notes.form.field_body')}
            </label>
            <textarea
              id={body_id}
              className={styles.textarea}
              aria-invalid={body_error ? true : undefined}
              aria-describedby={body_error ? `${body_id}-error` : undefined}
              {...register('body')}
            />
            {body_error ? (
              <p id={`${body_id}-error`} role="alert" className={styles.textareaError}>
                {t(body_error)}
              </p>
            ) : null}
          </div>
          <div data-span="full">
            <FormSegmented
              control={control}
              name="visibility"
              label={t('notes.form.field_visibility')}
              options={[
                { value: 'personal', label: t('notes.form.visibility_personal') },
                { value: 'shared', label: t('notes.form.visibility_shared') },
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

/** Criar (`/notes/new`) e editar (`/notes/$noteId/edit`) a nota em rota própria. */
export function NoteFormScreen() {
  const noteId = useParams({
    strict: false,
    select: (params: Record<string, unknown>) =>
      typeof params.noteId === 'string' ? params.noteId : undefined,
  });
  return noteId ? <EditNote note_id={noteId} /> : <NoteForm />;
}

function EditNote({ note_id }: { note_id: string }) {
  const t = useT();
  const query = useNote(note_id);
  if (query.isPending) return <LoadingState label={t('notes.form.loading')} />;
  if (query.isError) {
    return (
      <ErrorState
        title={
          isNoteNotFound(query.error) ? t('notes.form.not_found') : t('notes.detail.error_title')
        }
        retryLabel={t('notes.detail.retry')}
        onRetry={() => {
          void query.refetch();
        }}
      />
    );
  }
  return <NoteForm key={query.data.id} note={query.data} />;
}
