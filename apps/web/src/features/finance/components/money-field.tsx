import { TextField } from '@atria/ui';
import { useState } from 'react';
import { Controller, type Control, type FieldPath, type FieldValues } from 'react-hook-form';
import { useT } from '../../../shared/i18n/i18n';
import { usePreferences } from '../../../shared/preferences/preferences-context';
import { formatCentsForInput, parseMoneyToCents } from '../lib/money-input';

/** Símbolo da moeda no locale do usuário (ex.: "R$"). */
export function currencySymbol(currency: string, locale: string): string {
  return (
    new Intl.NumberFormat(locale, { style: 'currency', currency })
      .formatToParts(0)
      .find((part) => part.type === 'currency')?.value ?? currency
  );
}

interface MoneyInputProps {
  label: string;
  value: number | null | undefined;
  onChange: (cents: number | null) => void;
  onBlur: () => void;
  error?: string | undefined;
  help?: string | undefined;
  disabled?: boolean | undefined;
  name: string;
}

function MoneyInput({
  label,
  value,
  onChange,
  onBlur,
  error,
  help,
  disabled,
  name,
}: MoneyInputProps) {
  const { locale, currency } = usePreferences();
  const shown = (cents: number | null | undefined) =>
    cents === null || cents === undefined ? '' : formatCentsForInput(cents, locale);
  const [text, setText] = useState(() => shown(value));
  const [emitted, setEmitted] = useState(value);

  // O valor mudou fora do campo (reset do formulário): o texto acompanha.
  if (value !== emitted) {
    setEmitted(value);
    setText(shown(value));
  }

  return (
    <TextField
      label={`${label} (${currencySymbol(currency, locale)})`}
      name={name}
      inputMode="decimal"
      autoComplete="off"
      value={text}
      disabled={disabled}
      onBlur={onBlur}
      onChange={(event) => {
        const next = event.target.value;
        const cents = parseMoneyToCents(next, locale);
        setText(next);
        setEmitted(cents);
        onChange(cents);
      }}
      {...(help ? { help } : {})}
      {...(error ? { error } : {})}
    />
  );
}

export interface MoneyFieldProps<T extends FieldValues> {
  control: Control<T>;
  name: FieldPath<T>;
  label: string;
  help?: string;
  disabled?: boolean;
}

/** Campo de valor: mostra a moeda do usuário e grava centavos inteiros no formulário (PD-62). */
export function MoneyField<T extends FieldValues>({
  control,
  name,
  label,
  help,
  disabled,
}: MoneyFieldProps<T>) {
  const t = useT();
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <MoneyInput
          label={label}
          name={field.name}
          value={field.value}
          onChange={field.onChange}
          onBlur={field.onBlur}
          help={help}
          disabled={disabled}
          error={fieldState.error?.message ? t(fieldState.error.message) : undefined}
        />
      )}
    />
  );
}
