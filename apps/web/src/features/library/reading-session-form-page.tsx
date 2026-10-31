import { zodResolver } from '@hookform/resolvers/zod';
import { ErrorState, FormActions, FormGrid, LoadingState, TextField } from '@atria/ui';
import { useNavigate, useParams } from '@tanstack/react-router';
import { useId, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { FormDate } from '../../shared/forms/form-fields';
import { registerMessages, useT } from '../../shared/i18n/i18n';
import { FormScreen } from '../../shared/layout/form-screen';
import { StickyPageHeader } from '../../shared/layout/sticky-page-header';
import { BackLink } from '../../shared/navigation/back-link';
import { usePreferences } from '../../shared/preferences/preferences-context';
import messages from './i18n/pt-br.json';
import { useReadingSessionList, type ReadingSession } from './use-book';
import { useCreateReadingSession, useUpdateReadingSession } from './use-reading-sessions';
import styles from './library.module.css';

registerMessages('library', messages);

// As mensagens são chaves de tradução. Só páginas lidas, data e observação (PD-60).
const schema = z.object({
  pages_read: z
    .string()
    .trim()
    .regex(/^[1-9]\d{0,8}$/, 'library.session.pages_invalid'),
  read_on: z.string().min(1, 'common.field_required'),
  observation: z.string(),
});
type Values = z.infer<typeof schema>;

/** Hoje no fuso da pessoa, no formato `AAAA-MM-DD` (padrão da data da sessão). */
export function todayIn(time_zone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: time_zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function SessionForm({ book_id, session }: { book_id: string; session?: ReadingSession }) {
  const t = useT();
  const { time_zone } = usePreferences();
  const navigate = useNavigate();
  const observation_id = useId();
  const create = useCreateReadingSession(book_id);
  const update = useUpdateReadingSession(book_id);
  const [submit_error, setSubmitError] = useState<string>();
  const { control, register, handleSubmit, formState } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      pages_read: session ? String(session.pages_read) : '',
      read_on: session?.read_on ?? todayIn(time_zone),
      observation: session?.observation ?? '',
    },
  });
  const { errors, isSubmitting } = formState;

  async function save(values: Values) {
    setSubmitError(undefined);
    const input = {
      pages_read: Number(values.pages_read),
      read_on: values.read_on,
      observation: values.observation.trim() === '' ? null : values.observation.trim(),
    };
    try {
      if (session) await update.mutateAsync({ id: session.id, ...input });
      else await create.mutateAsync(input);
    } catch {
      setSubmitError(t('library.session.submit_error'));
    }
  }

  const back_to = `/library/books/${book_id}`;
  return (
    <FormScreen>
      <StickyPageHeader
        eyebrow={t(session ? 'library.form.eyebrow_edit' : 'library.form.eyebrow_new')}
        title={t(session ? 'library.session.title_edit' : 'library.session.title_new')}
        subtitle={t('library.session.subtitle')}
        back={<BackLink module="library" fallback_to="/library" to={back_to} />}
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
          <TextField
            label={t('library.session.pages_read')}
            inputMode="numeric"
            autoComplete="off"
            {...register('pages_read')}
            {...(errors.pages_read ? { error: t(errors.pages_read.message ?? '') } : {})}
          />
          <FormDate control={control} name="read_on" label={t('library.session.read_on')} />
          <div data-span="full" className={styles.textareaRoot}>
            <label htmlFor={observation_id} className={styles.fieldLabel}>
              {t('library.session.observation')}
            </label>
            <textarea
              id={observation_id}
              className={styles.textarea}
              {...register('observation')}
            />
          </div>
          <FormActions
            cancel_label={t('common.cancel')}
            submit_label={t('common.save')}
            loading={isSubmitting}
            onCancel={() => {
              void navigate({ to: back_to });
            }}
          />
        </FormGrid>
      </form>
    </FormScreen>
  );
}

/** Registrar (`.../sessions/new`) e editar (`.../sessions/$sessionId/edit`) a sessão de leitura. */
export function ReadingSessionFormPage() {
  const t = useT();
  const params = useParams({
    strict: false,
    select: (all: Record<string, unknown>) => ({
      book_id: typeof all.bookId === 'string' ? all.bookId : '',
      session_id: typeof all.sessionId === 'string' ? all.sessionId : undefined,
    }),
  });
  const sessions = useReadingSessionList(params.book_id);
  if (params.session_id === undefined) return <SessionForm book_id={params.book_id} />;
  if (sessions.isPending) return <LoadingState label={t('library.session.loading')} />;
  const found = sessions.data?.find((item) => item.id === params.session_id);
  if (sessions.isError || !found) {
    return (
      <ErrorState
        title={t('library.form.not_found')}
        retryLabel={t('library.form.retry')}
        onRetry={() => {
          void sessions.refetch();
        }}
      />
    );
  }
  return <SessionForm key={found.id} book_id={params.book_id} session={found} />;
}
