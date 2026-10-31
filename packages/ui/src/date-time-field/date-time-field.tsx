import { useState } from 'react';
import { DateField, type DateFieldLabels } from '../date-field/date-field';
import { TimeField } from '../time-field/time-field';
import styles from './date-time-field.module.css';

export interface DateTimeFieldLabels extends DateFieldLabels {
  /** "{label}: data". */
  date: string;
  /** "{label}: hora (24 horas)". */
  time: string;
  /** "hh:mm". */
  time_placeholder: string;
}

export interface DateTimeFieldProps {
  label: string;
  /** `YYYY-MM-DDTHH:mm` ou `''`. */
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  locale: string;
  labels: DateTimeFieldLabels;
  today?: string;
  disabled?: boolean;
  help?: string;
  error?: string;
  className?: string;
}

export function DateTimeField({
  label,
  value,
  onChange,
  onBlur,
  locale,
  labels,
  today,
  disabled,
  help,
  error,
  className,
}: DateTimeFieldProps) {
  const [initial_date = '', initial_time = ''] = value.split('T');
  // As partes ficam guardadas enquanto a outra falta: o valor sai vazio até as duas existirem.
  const [date, setDate] = useState(initial_date);
  const [time, setTime] = useState(initial_time);
  const combined = date && time ? `${date}T${time}` : '';

  const [previous, setPrevious] = useState(value);
  if (previous !== value) {
    setPrevious(value);
    if (value !== combined) {
      const [next_date = '', next_time = ''] = value.split('T');
      setDate(next_date);
      setTime(next_time);
    }
  }

  const emit = (next_date: string, next_time: string) => {
    setDate(next_date);
    setTime(next_time);
    onChange(next_date && next_time ? `${next_date}T${next_time}` : '');
  };
  return (
    <fieldset className={[styles.root, className].filter(Boolean).join(' ')}>
      <legend className={styles.legend}>{label}</legend>
      <div className={styles.row}>
        <DateField
          label={labels.date}
          hideLabel
          value={date}
          onChange={(next) => {
            emit(next, time);
          }}
          {...(onBlur ? { onBlur } : {})}
          locale={locale}
          labels={labels}
          {...(today ? { today } : {})}
          {...(disabled !== undefined ? { disabled } : {})}
          {...(error ? { error } : {})}
        />
        <TimeField
          label={labels.time}
          hideLabel
          value={time}
          onChange={(next) => {
            emit(date, next);
          }}
          {...(onBlur ? { onBlur } : {})}
          placeholder={labels.time_placeholder}
          {...(disabled !== undefined ? { disabled } : {})}
        />
      </div>
      {help ? <p className={styles.help}>{help}</p> : null}
    </fieldset>
  );
}
