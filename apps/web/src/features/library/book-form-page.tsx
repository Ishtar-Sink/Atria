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
import { useBook } from './use-book';
import { BOOK_STATUSES, type Book } from './use-library-items';
import { useCreateItem, useUpdateItem } from './use-library-mutations';
import styles from './library.module.css';

registerMessages('library', messages);

const schema = z.object({
  title: z.string().trim().min(1, 'common.field_required').max(300, 'library.form.title_too_long'),
  author: z.string(),
  publisher: z.string(),
  page_count: z
    .string()
    .trim()
    .refine((value) => value === '' || /^[1-9]\d{0,8}$/.test(value), 'library.form.pages_invalid'),
  reading_status: z.enum(BOOK_STATUSES),
  tags: z.array(z.string()),
  visibility: z.enum(['personal', 'shared']),
});
type Values = z.infer<typeof schema>;

const FIELDS: readonly (keyof Values)[] = [
  'title',
  'author',
  'publisher',
  'page_count',
  'reading_status',
  'tags',
  'visibility',
];

function initialValues(book: Book | undefined): Values {
  return {
    title: book?.title ?? '',
    author: book?.author ?? '',
    publisher: book?.publisher ?? '',
    page_count: book?.page_count ? String(book.page_count) : '',
    reading_status: book?.reading_status ?? 'want_to_read',
    tags: book?.tags ?? [],
    visibility: book?.visibility ?? 'personal',
  };
}

const orNull = (value: string) => (value.trim() === '' ? null : value.trim());

function BookForm({ book }: { book?: Book }) {
  const t = useT();
  const navigate = useNavigate();
  const create = useCreateItem('book');
  const update = useUpdateItem('book');
  const [pending_cover, setPendingCover] = useState<File | null>(null);
  const [pending_pdf, setPendingPdf] = useState<File | null>(null);
  const [submit_error, setSubmitError] = useState<string>();
  const { control, register, handleSubmit, setError, formState } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: initialValues(book),
  });
  const { errors, isSubmitting } = formState;
  const title = useWatch({ control, name: 'title' });

  async function save(values: Values) {
    setSubmitError(undefined);
    const body = {
      title: values.title.trim(),
      author: orNull(values.author),
      publisher: orNull(values.publisher),
      page_count: values.page_count.trim() === '' ? null : Number(values.page_count),
      reading_status: values.reading_status,
      tags: values.tags,
      visibility: values.visibility,
    };
    try {
      if (book) {
        // Na edição a capa já foi direto para o servidor; só o PDF espera o salvar.
        await update.mutateAsync({ id: book.id, body, files: { pdf: pending_pdf } });
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
        eyebrow={t(book ? 'library.form.eyebrow_edit' : 'library.form.eyebrow_new')}
        title={t(book ? 'library.book.title_edit' : 'library.book.title_new')}
        back={
          <BackLink
            module="library"
            fallback_to="/library"
            {...(book ? { to: `/library/books/${book.id}` } : {})}
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
              kind="book"
              title={title}
              item_id={book?.id}
              file_id={book?.cover_file_id}
              pending={pending_cover}
              on_pending={setPendingCover}
            />
            <div className={styles.formMediaFields}>
              <TextField
                label={t('library.form.field_title')}
                {...register('title')}
                {...(errors.title ? { error: t(errors.title.message ?? '') } : {})}
              />
              <TextField label={t('library.book.field_author')} {...register('author')} />
              <TextField label={t('library.book.field_publisher')} {...register('publisher')} />
              <TextField
                label={t('library.book.field_pages')}
                inputMode="numeric"
                autoComplete="off"
                {...register('page_count')}
                {...(errors.page_count ? { error: t(errors.page_count.message ?? '') } : {})}
              />
              <FormSegmented
                control={control}
                name="reading_status"
                label={t('library.book.field_status')}
                options={BOOK_STATUSES.map((status) => ({
                  value: status,
                  label: t(`library.book.status.${status}`),
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
              pdf_file_id={book?.pdf_file_id}
              pending={pending_pdf}
              on_pending={setPendingPdf}
            />
          </div>
          <FormActions
            cancel_label={t('common.cancel')}
            submit_label={t('common.save')}
            loading={isSubmitting}
            onCancel={() => {
              void navigate({ to: book ? `/library/books/${book.id}` : '/library' });
            }}
          />
        </FormGrid>
      </form>
    </FormScreen>
  );
}

/** Criar (`/library/books/new`) e editar (`/library/books/$bookId/edit`) o livro em rota própria. */
export function BookFormPage() {
  const book_id = useParams({
    strict: false,
    select: (params: Record<string, unknown>) =>
      typeof params.bookId === 'string' ? params.bookId : undefined,
  });
  return book_id ? <EditBook book_id={book_id} /> : <BookForm />;
}

function EditBook({ book_id }: { book_id: string }) {
  const t = useT();
  const query = useBook(book_id);
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
  return <BookForm key={query.data.id} book={query.data} />;
}
