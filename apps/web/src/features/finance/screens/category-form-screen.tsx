import { zodResolver } from '@hookform/resolvers/zod';
import { ErrorState, FormActions, FormGrid, LoadingState, TextField } from '@atria/ui';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { FormColor, FormSegmented } from '../../../shared/forms/form-fields';
import { useT } from '../../../shared/i18n/i18n';
import { FormScreen } from '../../../shared/layout/form-screen';
import { StickyPageHeader } from '../../../shared/layout/sticky-page-header';
import { BackLink } from '../../../shared/navigation/back-link';
import styles from '../components/finance.module.css';
import { VisibilityField } from '../components/visibility-field';
import { errorMessageKey, type TransactionKind } from '../hooks/finance-cache';
import {
  DEFAULT_CATEGORY_COLOR,
  normalizeHex,
  useCategory,
  useCreateCategory,
  useUpdateCategory,
  type Category,
} from '../hooks/use-categories';

const form_schema = z.object({
  name: z.string().trim().min(1, 'finance.form.name_required').max(100),
  kind: z.enum(['income', 'expense']),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'finance.category_form.color_invalid'),
  visibility: z.enum(['personal', 'shared']),
});

type FormValues = z.input<typeof form_schema>;

function CategoryForm({ category, kind }: { category?: Category; kind: TransactionKind }) {
  const t = useT();
  const navigate = useNavigate();
  const create = useCreateCategory();
  const update = useUpdateCategory();
  const [error, setError] = useState<string | null>(null);
  const editing = category !== undefined;
  const { control, register, handleSubmit, formState } = useForm<FormValues>({
    resolver: zodResolver(form_schema),
    defaultValues: {
      name: category?.name ?? '',
      kind: category?.kind ?? kind,
      color: category?.color ?? DEFAULT_CATEGORY_COLOR,
      visibility: category?.visibility ?? 'personal',
    },
  });

  async function onSubmit(values: FormValues) {
    setError(null);
    try {
      const saved = editing
        ? await update.mutateAsync({
            id: category.id,
            patch: {
              name: values.name.trim(),
              color: normalizeHex(values.color),
              visibility: values.visibility,
            },
          })
        : await create.mutateAsync({
            name: values.name.trim(),
            kind: values.kind,
            color: normalizeHex(values.color),
            visibility: values.visibility,
          });
      await navigate({ to: '/finance/categories/$categoryId', params: { categoryId: saved.id } });
    } catch (failure) {
      setError(errorMessageKey(failure));
    }
  }

  const back_to = editing ? `/finance/categories/${category.id}` : '/finance/settings';
  return (
    <FormScreen>
      <StickyPageHeader
        back={<BackLink module="finance" fallback_to="/finance/settings" to={back_to} />}
        eyebrow={t('finance.shell.title')}
        title={t(editing ? 'finance.category_form.edit_title' : 'finance.category_form.new_title')}
        subtitle={t('finance.category_form.subtitle')}
      />
      <form
        noValidate
        onSubmit={(event) => {
          void handleSubmit(onSubmit)(event);
        }}
      >
        <FormGrid>
          <div data-span="full">
            <TextField
              label={t('finance.category_form.name')}
              autoComplete="off"
              maxLength={100}
              {...register('name')}
              {...(formState.errors.name?.message
                ? { error: t(formState.errors.name.message) }
                : {})}
            />
          </div>
          {editing ? (
            <p className={styles.cardHelp}>
              {t('finance.category_form.kind')}: {t(`finance.category_form.kind_${category.kind}`)}
            </p>
          ) : (
            <FormSegmented
              control={control}
              name="kind"
              label={t('finance.category_form.kind')}
              options={[
                { value: 'income', label: t('finance.category_form.kind_income') },
                { value: 'expense', label: t('finance.category_form.kind_expense') },
              ]}
            />
          )}
          <FormColor control={control} name="color" label={t('finance.category_form.color')} />
          <VisibilityField control={control} name="visibility" />
          {error ? (
            <p role="alert" data-span="full" className={styles.formError}>
              {t(error)}
            </p>
          ) : null}
          <FormActions
            cancel_label={t('common.cancel')}
            submit_label={t('common.save')}
            loading={formState.isSubmitting}
            onCancel={() => {
              void navigate({ to: back_to });
            }}
          />
        </FormGrid>
      </form>
    </FormScreen>
  );
}

export interface CategoryFormScreenProps {
  category_id?: string;
  kind?: TransactionKind;
}

/** Criar e editar categoria com tipo e cor em rota própria (RF-30, PD-49). */
export function CategoryFormScreen({ category_id, kind = 'expense' }: CategoryFormScreenProps) {
  const t = useT();
  const category = useCategory(category_id);
  if (category_id === undefined) return <CategoryForm kind={kind} />;
  if (category.isError) {
    return (
      <ErrorState
        title={t('finance.detail.error_title')}
        description={t('finance.form.load_error')}
        retryLabel={t('common.retry')}
        onRetry={() => {
          void category.refetch();
        }}
      />
    );
  }
  if (!category.data) return <LoadingState label={t('common.loading')} />;
  return <CategoryForm category={category.data} kind={category.data.kind} />;
}
