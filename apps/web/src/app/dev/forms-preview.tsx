import { zodResolver } from '@hookform/resolvers/zod';
import { Button, FormActions, FormGrid, MenuButton, TextField } from '@atria/ui';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  FormColor,
  FormDate,
  FormDateTime,
  FormPeriod,
  FormSegmented,
  FormSelect,
  FormTags,
} from '../../shared/forms/form-fields';
import { useT } from '../../shared/i18n/i18n';
import { FormScreen } from '../../shared/layout/form-screen';
import { StickyPageHeader } from '../../shared/layout/sticky-page-header';
import { BackLink } from '../../shared/navigation/back-link';

const schema = z.object({
  title: z.string().min(1, 'common.field_required'),
  description: z.string(),
  kind: z.string().min(1, 'common.field_required'),
  direction: z.string(),
  visibility: z.string(),
  amount: z.string(),
  due: z.string(),
  start: z.string(),
  tags: z.array(z.string()),
  color: z.string(),
  period: z.object({ preset: z.string(), from: z.string().optional(), to: z.string().optional() }),
});
type Values = z.infer<typeof schema>;

function PencilIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

/** Rota `/dev/forms` (só em desenvolvimento): todos os campos de `@atria/ui` num formulário. */
export function FormsPreview() {
  const t = useT();
  const { control, register, handleSubmit, formState } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: '',
      description: '',
      kind: '',
      direction: 'out',
      visibility: 'personal',
      amount: '',
      due: '',
      start: '',
      tags: [],
      color: '#7C3AED',
      period: { preset: 'this_month' },
    },
  });
  const errors = formState.errors;
  return (
    <FormScreen>
      <StickyPageHeader
        eyebrow="Desenvolvimento"
        title="Formulário de exemplo"
        subtitle="Todos os campos do Atria, ligados ao react-hook-form."
        back={<BackLink module="dev" fallback_to="/" />}
        actions={
          <>
            <Button>
              <PencilIcon />
              {t('common.edit')}
            </Button>
            <MenuButton
              label={t('common.more_actions')}
              trigger={t('common.more_actions')}
              items={[{ id: 'delete', label: t('common.delete'), tone: 'danger' }]}
            />
          </>
        }
      />
      <form
        noValidate
        onSubmit={(event) => {
          void handleSubmit(() => undefined)(event);
        }}
      >
        <FormGrid>
          <div data-span="full">
            <TextField
              label="Título"
              {...register('title')}
              {...(errors.title ? { error: t(errors.title.message ?? '') } : {})}
            />
          </div>
          <div data-span="full">
            <TextField label="Descrição" {...register('description')} />
          </div>
          <FormSelect
            control={control}
            name="kind"
            label="Categoria"
            options={[
              { value: 'home', label: 'Casa' },
              { value: 'food', label: 'Mercado' },
              { value: 'transport', label: 'Transporte' },
              { value: 'health', label: 'Saúde' },
              { value: 'leisure', label: 'Lazer' },
            ]}
          />
          <FormSegmented
            control={control}
            name="direction"
            label="Tipo"
            options={[
              { value: 'out', label: 'Saída' },
              { value: 'in', label: 'Entrada' },
            ]}
          />
          <div data-span="full">
            <FormSegmented
              control={control}
              name="visibility"
              label="Visibilidade"
              options={[
                { value: 'personal', label: 'Pessoal' },
                { value: 'shared', label: 'Compartilhada' },
              ]}
            />
          </div>
          <TextField label="Valor" type="number" inputMode="decimal" {...register('amount')} />
          <FormDate control={control} name="due" label="Vencimento" />
          <FormDateTime control={control} name="start" label="Início" />
          <FormColor control={control} name="color" label="Cor" />
          <div data-span="full">
            <FormTags control={control} name="tags" label="Etiquetas" />
          </div>
          <FormPeriod control={control} name="period" label="Período" placement="form" />
          <div data-span="full" style={{ display: 'flex', gap: 'calc(var(--space) * 2)' }}>
            <Button variant="muted">Ver detalhes</Button>
            <Button variant="muted" tint="#f59e0b">
              Raia
            </Button>
            <Button variant="success">Concluir</Button>
            <Button variant="success" aria-pressed="true">
              Concluído
            </Button>
          </div>
          <FormActions
            cancel_label={t('common.cancel')}
            submit_label={t('common.save')}
            onCancel={() => undefined}
          />
        </FormGrid>
      </form>
    </FormScreen>
  );
}
