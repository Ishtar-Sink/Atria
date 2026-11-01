import { useState } from 'react';
import { TextField } from '../text-field/text-field';
import { formatCents, maskMoneyInput, parseMoneyInput } from './money-mask';

export interface MoneyFieldProps {
  label: string;
  value_cents: number | null;
  onChange: (cents: number | null) => void;
  error?: string;
  help?: string;
  locale?: string;
  currency?: string;
  onBlur?: () => void;
  name?: string;
  id?: string;
  disabled?: boolean;
}

/** Campo de moeda: mostra o valor formatado ao digitar e entrega sempre centavos inteiros. */
export function MoneyField({
  label,
  value_cents,
  onChange,
  error,
  help,
  locale = 'pt-BR',
  currency = 'BRL',
  onBlur,
  name,
  id,
  disabled,
}: MoneyFieldProps) {
  const [text, setText] = useState(() =>
    value_cents === null ? '' : formatCents(value_cents, locale, currency),
  );

  // Mudança de fora (como o `reset` do formulário): ajusta o texto durante a renderização.
  const [seen, setSeen] = useState({ value_cents, locale, currency });
  if (seen.value_cents !== value_cents || seen.locale !== locale || seen.currency !== currency) {
    setSeen({ value_cents, locale, currency });
    if (parseMoneyInput(text, locale, currency) !== value_cents) {
      setText(value_cents === null ? '' : formatCents(value_cents, locale, currency));
    }
  }

  return (
    <TextField
      label={label}
      inputMode="decimal"
      autoComplete="off"
      value={text}
      error={error}
      help={help}
      name={name}
      id={id}
      disabled={disabled}
      onChange={(event) => {
        const next = maskMoneyInput(event.target.value, locale, currency);
        setText(next);
        onChange(parseMoneyInput(next, locale, currency));
      }}
      onBlur={() => {
        const cents = parseMoneyInput(text, locale, currency);
        if (cents !== null) setText(formatCents(cents, locale, currency));
        onBlur?.();
      }}
    />
  );
}
