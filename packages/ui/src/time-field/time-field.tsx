import { useId, useState } from 'react';
import { maskTime, parseTime } from './parse-time';
import styles from './time-field.module.css';

export interface TimeFieldProps {
  label: string;
  /** `HH:mm` ou `''`. */
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  hideLabel?: boolean;
  disabled?: boolean;
  help?: string;
  error?: string;
  id?: string;
  className?: string;
}

function ClockIcon() {
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
      focusable="false"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

export function TimeField({
  label,
  value,
  onChange,
  onBlur,
  placeholder,
  hideLabel = false,
  disabled,
  help,
  error,
  id,
  className,
}: TimeFieldProps) {
  const generated = useId();
  const controlId = id ?? generated;
  const helpId = `${controlId}-help`;
  const errorId = `${controlId}-error`;
  const describedBy = [help ? helpId : null, error ? errorId : null].filter(Boolean).join(' ');
  const [text, setText] = useState(value);

  const [previous, setPrevious] = useState(value);
  if (previous !== value) {
    setPrevious(value);
    setText(value);
  }

  return (
    <div className={[styles.root, className].filter(Boolean).join(' ')}>
      <label
        htmlFor={controlId}
        className={[styles.label, hideLabel ? styles.hidden : ''].filter(Boolean).join(' ')}
      >
        {label}
      </label>
      <div className={styles.wrap}>
        <span className={styles.icon}>
          <ClockIcon />
        </span>
        <input
          id={controlId}
          type="text"
          inputMode="numeric"
          maxLength={5}
          autoComplete="off"
          placeholder={placeholder}
          value={text}
          disabled={disabled}
          className={styles.control}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          onChange={(event) => {
            setText(maskTime(event.target.value));
          }}
          onBlur={() => {
            const normalized = parseTime(text) ?? '';
            setText(normalized);
            if (normalized !== value) onChange(normalized);
            onBlur?.();
          }}
        />
      </div>
      {help ? (
        <p id={helpId} className={styles.help}>
          {help}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className={styles.error}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
