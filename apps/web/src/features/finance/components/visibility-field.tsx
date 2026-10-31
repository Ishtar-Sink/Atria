import type { Control, FieldPath, FieldValues } from 'react-hook-form';
import { FormSegmented } from '../../../shared/forms/form-fields';
import { useT } from '../../../shared/i18n/i18n';

export interface VisibilityFieldProps<T extends FieldValues> {
  control: Control<T>;
  name: FieldPath<T>;
}

/** "Visibilidade" em todos os formulários do Financeiro, ocupando a linha inteira (PD-62). */
export function VisibilityField<T extends FieldValues>({ control, name }: VisibilityFieldProps<T>) {
  const t = useT();
  return (
    <div data-span="full">
      <FormSegmented
        control={control}
        name={name}
        label={t('finance.visibility.legend')}
        help={t('finance.visibility.help')}
        options={[
          { value: 'personal', label: t('finance.visibility.personal') },
          { value: 'shared', label: t('finance.visibility.shared') },
        ]}
      />
    </div>
  );
}
