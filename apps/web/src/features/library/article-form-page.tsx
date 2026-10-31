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
import { PdfAttachmentField } from './pdf-attachment-field';
import { ARTICLE_STATUSES, useArticle, type Article } from './use-library-items';
import { useCreateItem, useUpdateItem } from './use-library-mutations';
import styles from './library.module.css';

registerMessages('library', messages);

const schema = z.object({
  title: z.string().trim().min(1, 'common.field_required').max(300, 'library.form.title_too_long'),
  author: z.string(),
  source: z.string(),
  url: z
    .string()
    .trim()
    .max(2048, 'library.form.url_invalid')
    .refine(isWebUrl, 'library.form.url_invalid'),
  reading_status: z.enum(ARTICLE_STATUSES),
  tags: z.array(z.string()),
  visibility: z.enum(['personal', 'shared']),
});
type Values = z.infer<typeof schema>;

const FIELDS: readonly (keyof Values)[] = [
  'title',
  'author',
  'source',
  'url',
  'reading_status',
  'tags',
  'visibility',
];

/** Endereço vazio vale (é opcional); preenchido, precisa ser http ou https. */
function isWebUrl(value: string): boolean {
  if (value === '') return true;
  try {
    const protocol = new URL(value).protocol;
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

function initialValues(article: Article | undefined): Values {
  return {
    title: article?.title ?? '',
    author: article?.author ?? '',
    source: article?.source ?? '',
    url: article?.url ?? '',
    reading_status: article?.reading_status ?? 'to_read',
    tags: article?.tags ?? [],
    visibility: article?.visibility ?? 'personal',
  };
}

const orNull = (value: string) => (value.trim() === '' ? null : value.trim());

function ArticleForm({ article }: { article?: Article }) {
  const t = useT();
  const navigate = useNavigate();
  const create = useCreateItem('article');
  const update = useUpdateItem('article');
  const [pending_cover, setPendingCover] = useState<File | null>(null);
  const [pending_pdf, setPendingPdf] = useState<File | null>(null);
  const [submit_error, setSubmitError] = useState<string>();
  const { control, register, handleSubmit, setError, formState } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: initialValues(article),
  });
  const { errors, isSubmitting } = formState;
  const title = useWatch({ control, name: 'title' });

  async function save(values: Values) {
    setSubmitError(undefined);
    const body = {
      title: values.title.trim(),
      author: orNull(values.author),
      source: orNull(values.source),
      url: orNull(values.url),
      reading_status: values.reading_status,
      tags: values.tags,
      visibility: values.visibility,
    };
    try {
      if (article) {
        // Na edição a capa já foi direto para o servidor; só o PDF espera o salvar.
        await update.mutateAsync({ id: article.id, body, files: { pdf: pending_pdf } });
      } else {
        await create.mutateAsync({ body, files: { cover: pending_cover, pdf: pending_pdf } });
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
        eyebrow={t(article ? 'library.form.eyebrow_edit' : 'library.form.eyebrow_new')}
        title={t(article ? 'library.article.title_edit' : 'library.article.title_new')}
        back={
          <BackLink
            module="library"
            fallback_to="/library"
            {...(article ? { to: `/library/articles/${article.id}` } : {})}
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
              kind="article"
              title={title}
              item_id={article?.id}
              file_id={article?.cover_file_id}
              pending={pending_cover}
              on_pending={setPendingCover}
            />
            <div className={styles.formMediaFields}>
              <TextField
                label={t('library.form.field_title')}
                {...register('title')}
                {...(errors.title ? { error: t(errors.title.message ?? '') } : {})}
              />
              <TextField label={t('library.article.field_author')} {...register('author')} />
              <TextField label={t('library.article.field_source')} {...register('source')} />
              <TextField
                label={t('library.article.field_url')}
                type="url"
                autoComplete="off"
                {...register('url')}
                {...(errors.url ? { error: t(errors.url.message ?? '') } : {})}
              />
              <FormSegmented
                control={control}
                name="reading_status"
                label={t('library.article.field_status')}
                options={ARTICLE_STATUSES.map((status) => ({
                  value: status,
                  label: t(`library.article.status.${status}`),
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
          <div data-span="full">
            <PdfAttachmentField
              pdf_file_id={article?.pdf_file_id}
              pending={pending_pdf}
              on_pending={setPendingPdf}
            />
          </div>
          <FormActions
            cancel_label={t('common.cancel')}
            submit_label={t('common.save')}
            loading={isSubmitting}
            onCancel={() => {
              void navigate({ to: article ? `/library/articles/${article.id}` : '/library' });
            }}
          />
        </FormGrid>
      </form>
    </FormScreen>
  );
}

/** Criar (`/library/articles/new`) e editar (`/library/articles/$articleId/edit`) o livro em rota própria. */
export function ArticleFormPage() {
  const article_id = useParams({
    strict: false,
    select: (params: Record<string, unknown>) =>
      typeof params.articleId === 'string' ? params.articleId : undefined,
  });
  return article_id ? <EditArticle article_id={article_id} /> : <ArticleForm />;
}

function EditArticle({ article_id }: { article_id: string }) {
  const t = useT();
  const query = useArticle(article_id);
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
  return <ArticleForm key={query.data.id} article={query.data} />;
}
