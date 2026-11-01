import { MoneyField as BaseMoneyField } from '@atria/ui';
import { Controller, type Control, type FieldPath, type FieldValues } from 'react-hook-form';
import { useT } from '../../../shared/i18n/i18n';
import { usePreferences } from '../../../shared/preferences/preferences-context';

/** Símbolo da moeda no locale do usuário (ex.: "R$"). */
export function currencySymbol(currency: string, locale: string): string {
  return (
    new Intl.NumberFormat(locale, { style: 'currency', currency })
      .formatToParts(0)
      .find((part) => part.type === 'currency')?.value ?? currency
  );
}

export interface MoneyFieldProps<T extends FieldValues> {
  control: Control<T>;
  name: FieldPath<T>;
  label: string;
}

/** Campo de valor: mostra a moeda do usuário e grava centavos inteiros no formulário (PD-62). */
export function MoneyField<T extends FieldValues>({ control, name, label }: MoneyFieldProps<T>) {
  const t = useT();
  const { locale, currency } = usePreferences();
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <BaseMoneyField
          label={`${label} (${currencySymbol(currency, locale)})`}
          name={field.name}
          value_cents={field.value ?? null}
          onChange={field.onChange}
          onBlur={field.onBlur}
          locale={locale}
          currency={currency}
          {...(fieldState.error?.message ? { error: t(fieldState.error.message) } : {})}
        />
      )}
    />
  );
}
