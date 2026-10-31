import { useEffect, useId, useRef, useState } from 'react';
import { Button } from '../button/button';
import { Calendar, type CalendarLabels } from '../calendar/calendar';
import styles from './date-field.module.css';

export interface DateFieldLabels {
  /** "Escolher data". */
  placeholder: string;
  /** "Hoje". */
  today: string;
  /** "Limpar". */
  clear: string;
  previous: string;
  next: string;
  /** Sufixo do dia atual no nome acessível ("hoje"). */
  today_marker: string;
}

export interface DateFieldProps {
  label: string;
  /** `YYYY-MM-DD` ou `''`. */
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  locale: string;
  labels: DateFieldLabels;
  /** Dia atual (`YYYY-MM-DD`); padrão: a data do navegador. */
  today?: string;
  hideLabel?: boolean;
  disabled?: boolean;
  help?: string;
  error?: string;
  id?: string;
  className?: string;
}

function CalendarIcon() {
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
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

function localToday(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${String(now.getFullYear())}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function formatIso(iso: string, locale: string): string {
  const [y = 1970, m = 1, d = 1] = iso.split('-').map(Number);
  return new Intl.DateTimeFormat(locale).format(new Date(y, m - 1, d));
}

export function DateField({
  label,
  value,
  onChange,
  onBlur,
  locale,
  labels,
  today,
  hideLabel = false,
  disabled,
  help,
  error,
  id,
  className,
}: DateFieldProps) {
  const generated = useId();
  const controlId = id ?? generated;
  const labelId = `${controlId}-label`;
  const valueId = `${controlId}-value`;
  const helpId = `${controlId}-help`;
  const errorId = `${controlId}-error`;
  const describedBy = [help ? helpId : null, error ? errorId : null].filter(Boolean).join(' ');
  const day_today = today ?? localToday();

  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState((value || day_today).slice(0, 7));

  function close(focus: boolean) {
    setOpen(false);
    if (focus) trigger.current?.focus();
    else onBlur?.();
  }

  function commit(next: string) {
    onChange(next);
    close(true);
  }

  useEffect(() => {
    if (!open) return;
    root.current?.querySelector<HTMLElement>('[data-day][tabindex="0"]')?.focus();
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) close(false);
    };
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        close(true);
      }
    };
    document.addEventListener('pointerdown', onPointer, true);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('pointerdown', onPointer, true);
      document.removeEventListener('keydown', onKey, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só ao abrir
  }, [open]);

  const calendar_labels: CalendarLabels = {
    previous: labels.previous,
    next: labels.next,
    today: labels.today_marker,
  };

  return (
    <div className={[styles.root, className].filter(Boolean).join(' ')} ref={root}>
      <span
        id={labelId}
        className={[styles.label, hideLabel ? styles.hidden : ''].filter(Boolean).join(' ')}
      >
        {label}
      </span>
      <div className={styles.wrap}>
        {/* eslint-disable-next-line jsx-a11y/role-supports-aria-props -- mesmo contrato do SelectField */}
        <button
          ref={trigger}
          type="button"
          id={controlId}
          className={styles.control}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-labelledby={`${labelId} ${valueId}`}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          disabled={disabled}
          onClick={() => {
            if (open) {
              close(false);
              return;
            }
            setMonth((value || day_today).slice(0, 7));
            setOpen(true);
          }}
        >
          <CalendarIcon />
          <span id={valueId} className={value ? styles.value : styles.placeholder}>
            {value ? formatIso(value, locale) : labels.placeholder}
          </span>
        </button>
        {open ? (
          <div role="dialog" aria-label={label} className={styles.popover}>
            <Calendar
              mode="single"
              month={month}
              onMonthChange={setMonth}
              value={{ from: value }}
              onChange={(next) => {
                commit(next.from);
              }}
              today={day_today}
              locale={locale}
              labels={calendar_labels}
            />
            <div className={styles.actions}>
              <Button
                variant="ghost"
                onClick={() => {
                  commit(day_today);
                }}
              >
                {labels.today}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  commit('');
                }}
              >
                {labels.clear}
              </Button>
            </div>
          </div>
        ) : null}
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
