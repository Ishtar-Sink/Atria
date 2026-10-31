import { zodResolver } from '@hookform/resolvers/zod';
import { ErrorState, FormActions, FormGrid, LoadingState, TextField } from '@atria/ui';
import { useNavigate, useParams } from '@tanstack/react-router';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { ApiProblem } from '../../shared/api/problem';
import { FormSegmented, FormTags } from '../../shared/forms/form-fields';
import { registerMessages, useT } from '../../shared/i18n/i18n';
import { FormScreen } from '../../shared/layout/form-screen';
import { StickyPageHeader } from '../../shared/layout/sticky-page-header';
import { BackLink } from '../../shared/navigation/back-link';
import messages from './i18n/pt-br.json';
import { CoverUploadField } from './cover-upload-field';
import { VIDEO_STATUSES, useVideo, type Video } from './use-library-items';
import { useCreateItem, useUpdateItem } from './use-library-mutations';
import styles from './library.module.css';

registerMessages('library', messages);

const MAX_CHANNEL = 300;

function isWebUrl(value: string): boolean {
  try {
    const protocol = new URL(value).protocol;
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

const schema = z.object({
  url: z
    .string()
    .trim()
    .min(1, 'common.field_required')
    .max(2048, 'library.form.url_invalid')
    .refine(isWebUrl, 'library.form.url_invalid'),
  title: z.string().trim().max(300, 'library.form.title_too_long'),
  channel: z.string().trim().max(MAX_CHANNEL, 'library.form.title_too_long'),
  watch_status: z.enum(VIDEO_STATUSES),
  tags: z.array(z.string()),
  visibility: z.enum(['personal', 'shared']),
});
type Values = z.infer<typeof schema>;

const FIELDS: readonly (keyof Values)[] = [
  'url',
  'title',
  'channel',
  'watch_status',
  'tags',
  'visibility',
];

function initialValues(video: Video | undefined): Values {
  return {
    url: video?.url ?? '',
    title: video?.title ?? '',
    channel: video?.channel ?? '',
    watch_status: video?.watch_status ?? 'to_watch',
    tags: video?.tags ?? [],
    visibility: video?.visibility ?? 'personal',
  };
}

function VideoForm({ video }: { video?: Video }) {
  const t = useT();
  const navigate = useNavigate();
  const create = useCreateItem('video');
  const update = useUpdateItem('video');
  const [pending_thumbnail, setPendingThumbnail] = useState<File | null>(null);
  const [submit_error, setSubmitError] = useState<string>();
  const { control, register, handleSubmit, setError, formState } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: initialValues(video),
  });
  const { errors, isSubmitting } = formState;
  const [watched_title, watched_url] = useWatch({ control, name: ['title', 'url'] });
  const title = watched_title || watched_url;

  async function save(values: Values) {
    setSubmitError(undefined);
    // Canal em branco não é enviado (PD-37); na edição, em branco limpa o canal.
    const channel = values.channel.trim();
    const body = {
      url: values.url.trim(),
      title: values.title.trim() === '' ? null : values.title.trim(),
      watch_status: values.watch_status,
      tags: values.tags,
      visibility: values.visibility,
      ...(channel === '' ? (video ? { channel: null } : {}) : { channel }),
    };
    try {
      if (video) {
        await update.mutateAsync({ id: video.id, body });
      } else {
        await create.mutateAsync({ body, files: { cover: pending_thumbnail } });
      }
    } catch (error) {
      const fields = error instanceof ApiProblem && error.status === 422 ? error.errors : [];
      const known = fields.filter((item): item is { field: keyof Values; code: string } =>
        FIELDS.some((field) => field === item.field),
      );
      known.forEach((item) => {
        setError(item.field, { message: 'library.form.submit_error' });
      });
      if (known.length === 0) setSubmitError(t('library.form.submit_error'));
    }
  }

  return (
    <FormScreen>
      <StickyPageHeader
        eyebrow={t(video ? 'library.form.eyebrow_edit' : 'library.form.eyebrow_new')}
        title={t(video ? 'library.video.title_edit' : 'library.video.title_new')}
        back={
          <BackLink
            module="library"
            fallback_to="/library"
            {...(video ? { to: `/library/videos/${video.id}` } : {})}
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
          <div data-span="full" className={styles.formMedia}>
            <CoverUploadField
              kind="video"
              title={title}
              item_id={video?.id}
              file_id={video?.thumbnail_file_id}
              pending={pending_thumbnail}
              on_pending={setPendingThumbnail}
              hint={video?.thumbnail_file_id ? undefined : t('library.video.thumbnail_manual_hint')}
            />
            <div className={styles.formMediaFields}>
              <TextField
                label={t('library.video.field_url')}
                type="url"
                autoComplete="off"
                {...register('url')}
                {...(errors.url ? { error: t(errors.url.message ?? '') } : {})}
              />
              <TextField
                label={t('library.video.field_title')}
                help={t('library.video.field_title_help')}
                {...register('title')}
                {...(errors.title ? { error: t(errors.title.message ?? '') } : {})}
              />
              <TextField
                label={t('library.video.field_channel')}
                autoComplete="off"
                {...register('channel')}
                {...(errors.channel ? { error: t(errors.channel.message ?? '') } : {})}
              />
              <FormSegmented
                control={control}
                name="watch_status"
                label={t('library.video.field_status')}
                options={VIDEO_STATUSES.map((status) => ({
                  value: status,
                  label: t(`library.video.status.${status}`),
                }))}
              />
            </div>
          </div>
          <div data-span="full">
            <FormTags
              control={control}
              name="tags"
              label={t('library.form.field_tags')}
              help={t('library.form.field_tags_help')}
            />
          </div>
          <div data-span="full">
            <FormSegmented
              control={control}
              name="visibility"
              label={t('library.form.field_visibility')}
              options={[
                { value: 'personal', label: t('library.visibility.personal') },
                { value: 'shared', label: t('library.visibility.shared') },
              ]}
            />
          </div>
          <FormActions
            cancel_label={t('common.cancel')}
            submit_label={t('common.save')}
            loading={isSubmitting}
            onCancel={() => {
              void navigate({ to: video ? `/library/videos/${video.id}` : '/library' });
            }}
          />
        </FormGrid>
      </form>
    </FormScreen>
  );
}

/** Criar (`/library/videos/new`) e editar (`/library/videos/$videoId/edit`) o vídeo em rota própria. */
export function VideoFormPage() {
  const video_id = useParams({
    strict: false,
    select: (params: Record<string, unknown>) =>
      typeof params.videoId === 'string' ? params.videoId : undefined,
  });
  return video_id ? <EditVideo video_id={video_id} /> : <VideoForm />;
}

function EditVideo({ video_id }: { video_id: string }) {
  const t = useT();
  const query = useVideo(video_id);
  if (query.isPending) return <LoadingState label={t('library.form.loading')} />;
  if (query.isError) {
    return (
      <ErrorState
        title={t('library.form.not_found')}
        retryLabel={t('library.form.retry')}
        onRetry={() => {
          void query.refetch();
        }}
      />
    );
  }
  return <VideoForm key={query.data.id} video={query.data} />;
}
