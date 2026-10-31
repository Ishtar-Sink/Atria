import { Card, ErrorState, FormActions, FormGrid, LoadingState } from '@atria/ui';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate, useRouter } from '@tanstack/react-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { ApiProblem } from '../../shared/api/problem';
import { FormDateTime, FormSegmented } from '../../shared/forms/form-fields';
import { useT } from '../../shared/i18n/i18n';
import { FormScreen } from '../../shared/layout/form-screen';
import { StickyPageHeader } from '../../shared/layout/sticky-page-header';
import { BackLink } from '../../shared/navigation/back-link';
import { useBackTarget } from '../../shared/navigation/back-target';
import { usePreferences } from '../../shared/preferences/preferences-context';
import { EmotionPicker } from './emotion-picker';
import styles from './journal-entry-form-page.module.css';
import { useEmotions } from './use-emotions';
import {
  nowLocalInput,
  toLocalInput,
  toRfc3339,
  type CreateJournalEntryBody,
  type JournalEntry,
} from './use-journal-entries';
import { useCreateJournalEntry, useUpdateJournalEntry } from './use-journal-entry-mutations';
import { useJournalEntry } from './use-journal-entry';

const form_schema = z.object({
  occurred_at: z.string().min(1, 'common.field_required'),
  text: z.string().trim().min(1, 'journal.form.text_required'),
  emotions: z.array(
    z.object({
      emotion_id: z.string(),
      intensity: z.number().int().min(1).max(5).optional(),
    }),
  ),
  visibility: z.enum(['personal', 'shared']),
});

type FormValues = z.infer<typeof form_schema>;

function initialValues(entry: JournalEntry | undefined, time_zone: string): FormValues {
  return {
    occurred_at: entry ? toLocalInput(entry.occurred_at, time_zone) : nowLocalInput(time_zone),
    text: entry?.text ?? '',
    emotions: (entry?.emotions ?? [])
      .filter((item) => !item.deleted)
      .map((item) =>
        item.intensity == null
          ? { emotion_id: item.emotion_id }
          : { emotion_id: item.emotion_id, intensity: item.intensity },
      ),
    visibility: entry?.visibility ?? 'personal',
  };
}

function JournalEntryForm({ entry }: { entry?: JournalEntry }) {
  const t = useT();
  const navigate = useNavigate();
  const router = useRouter();
  const { time_zone } = usePreferences();
  const create = useCreateJournalEntry();
  const update = useUpdateJournalEntry();
  const emotions = useEmotions();
  const [submit_error, setSubmitError] = useState<string | null>(null);
  const editing = entry !== undefined;
  const back = useBackTarget({
    module: 'journal',
    fallback_to: '/journal',
    ...(editing ? { to: `/journal/${entry.id}` } : {}),
  });
  const { control, register, handleSubmit, formState } = useForm<FormValues>({
    resolver: zodResolver(form_schema),
    defaultValues: initialValues(entry, time_zone),
  });
  const text_error = formState.errors.text?.message;

  async function onSubmit(values: FormValues) {
    setSubmitError(null);
    const body: CreateJournalEntryBody = {
      occurred_at: toRfc3339(values.occurred_at, time_zone),
      text: values.text.trim(),
      emotions: values.emotions.map((item) =>
        item.intensity === undefined
          ? { emotion_id: item.emotion_id }
          : { emotion_id: item.emotion_id, intensity: item.intensity },
      ),
      visibility: values.visibility,
    };
    try {
      if (editing) {
        await update.mutateAsync({ id: entry.id, body });
        await navigate({ to: '/journal/$entryId', params: { entryId: entry.id } });
        return;
      }
      const created = await create.mutateAsync(body);
      await navigate({ to: '/journal/$entryId', params: { entryId: created.id } });
    } catch (error) {
      setSubmitError(
        error instanceof ApiProblem && error.status === 422
          ? 'common.errors.validation_failed'
          : 'journal.form.saved_failed',
      );
    }
  }

  return (
    <FormScreen>
      <StickyPageHeader
        back={
          <BackLink module="journal" fallback_to="/journal" {...(editing ? { to: back } : {})} />
        }
        eyebrow={t(editing ? 'journal.form.eyebrow_edit' : 'journal.form.eyebrow_new')}
        title={t(editing ? 'journal.form.title_edit' : 'journal.form.title_new')}
        subtitle={t(editing ? 'journal.form.subtitle_edit' : 'journal.form.subtitle_new')}
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
              <FormDateTime control={control} name="occurred_at" label={t('journal.form.date')} />
            </div>
            <div data-span="full" className={styles.field}>
              <label htmlFor="journal-text" className={styles.label}>
                {t('journal.form.text')}
              </label>
              <textarea
                id="journal-text"
                className={styles.textarea}
                rows={8}
                aria-invalid={text_error ? true : undefined}
                aria-describedby={text_error ? 'journal-text-error' : undefined}
                {...register('text')}
              />
              {text_error ? (
                <p id="journal-text-error" role="alert" className={styles.error}>
                  {t(text_error)}
                </p>
              ) : null}
            </div>
            <div data-span="full">
              <Controller
                control={control}
                name="emotions"
                render={({ field }) => (
                  <EmotionPicker
                    emotions={emotions.data?.items ?? []}
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
              <p className={styles.note}>
                <Link to="/journal/emotions">{t('journal.form.emotions_manage')}</Link>
              </p>
            </div>
            <div data-span="full">
              <FormSegmented
                control={control}
                name="visibility"
                label={t('journal.form.visibility')}
                options={[
                  { value: 'personal', label: t('journal.form.visibility_personal') },
                  { value: 'shared', label: t('journal.form.visibility_shared') },
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
              submit_label={t('journal.form.save')}
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

function EditLoader({ entry_id }: { entry_id: string }) {
  const t = useT();
  const query = useJournalEntry(entry_id);
  if (query.isPending) return <LoadingState label={t('common.loading')} />;
  if (query.data === undefined) {
    return (
      <ErrorState
        title={t('journal.entry.error_title')}
        retryLabel={t('common.retry')}
        onRetry={() => {
          void query.refetch();
        }}
      />
    );
  }
  return <JournalEntryForm entry={query.data} />;
}

export interface JournalEntryFormPageProps {
  /** Ausente: cria. */
  entry_id?: string;
}

export function JournalEntryFormPage({ entry_id }: JournalEntryFormPageProps) {
  return entry_id === undefined ? <JournalEntryForm /> : <EditLoader entry_id={entry_id} />;
}
