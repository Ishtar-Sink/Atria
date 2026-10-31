import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import type { SyntheticEvent } from 'react';
import { Button } from '../button/button';
import { Calendar, type CalendarValue } from '../calendar/calendar';
import { resolvePeriod, type PeriodPreset, type PeriodValue } from './period';
import styles from './period-field.module.css';

export interface PeriodFieldLabels {
  presets: Record<PeriodPreset, string>;
  /** Nome do popover: "Escolher período". */
  title: string;
  custom: string;
  apply: string;
  first_day: string;
  last_day: string;
  first_day_error: string;
  previous: string;
  next: string;
  today_marker: string;
}

export interface PeriodFieldProps {
  label?: string;
  value?: PeriodValue;
  onChange: (value: PeriodValue) => void;
  presets?: readonly PeriodPreset[];
  allow_custom?: boolean;
  placement: 'toolbar' | 'form';
  today: string;
  locale: string;
  labels: PeriodFieldLabels;
  name?: string;
  className?: string;
}

const DEFAULT_PRESETS: readonly PeriodPreset[] = [
  'this_month',
  'last_month',
  'next_30_days',
  'last_30_days',
  'this_year',
  'all',
];
const DEFAULT_VALUE: PeriodValue = { preset: 'this_month' };
const MARGIN = 8;

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

export function PeriodField({
  label,
  value = DEFAULT_VALUE,
  onChange,
  presets = DEFAULT_PRESETS,
  allow_custom = true,
  placement,
  today,
  locale,
  labels,
  name,
  className,
}: PeriodFieldProps) {
  const generated = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const popover = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<CalendarValue>({ from: '' });
  const [month, setMonth] = useState(today.slice(0, 7));
  const [error, setError] = useState(false);
  const [shift, setShift] = useState(0);

  const fmt = new Intl.DateTimeFormat(locale);
  const show = (iso: string) => {
    const [y = 1970, m = 1, d = 1] = iso.split('-').map(Number);
    return fmt.format(new Date(y, m - 1, d));
  };
  const range = resolvePeriod(value, today);
  const text =
    value.preset === 'custom' && value.from && value.to
      ? `${show(value.from)} – ${show(value.to)}`
      : value.preset === 'custom'
        ? labels.custom
        : labels.presets[value.preset];

  function close(focus: boolean) {
    setOpen(false);
    if (focus) trigger.current?.focus();
  }

  function openPopover() {
    const base = value.preset === 'custom' && value.from ? value.from : today;
    setDraft(
      value.preset === 'custom' && value.from
        ? { from: value.from, ...(value.to ? { to: value.to } : {}) }
        : { from: '' },
    );
    setMonth(base.slice(0, 7));
    setError(false);
    setShift(0);
    setOpen(true);
  }

  // Mantém o popover dentro da janela, com 8 px de margem.
  useLayoutEffect(() => {
    if (!open || !popover.current) return;
    const box = popover.current.getBoundingClientRect();
    const width = window.innerWidth;
    let delta = 0;
    if (box.left + shift < MARGIN) delta = MARGIN - box.left;
    else if (box.right + shift > width - MARGIN) delta = width - MARGIN - box.right;
    if (delta !== 0 && Math.abs(delta - shift) > 0.5) setShift(delta);
  }, [open, shift, draft, month]);

  useEffect(() => {
    if (!open) return;
    popover.current?.querySelector<HTMLElement>('[aria-pressed="true"]')?.focus();
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
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
  }, [open]);

  function pick(preset: PeriodPreset) {
    onChange({ preset });
    close(true);
  }

  function apply(event: SyntheticEvent) {
    event.preventDefault();
    if (!draft.from) {
      setError(true);
      return;
    }
    onChange({ preset: 'custom', from: draft.from, to: draft.to ?? draft.from });
    close(true);
  }

  const summary = !draft.from
    ? labels.first_day
    : draft.to
      ? `${show(draft.from)} – ${show(draft.to)}`
      : `${show(draft.from)} · ${labels.last_day}`;

  return (
    <div className={[styles.root, className].filter(Boolean).join(' ')} ref={root}>
      {label ? (
        <span id={`${generated}-label`} className={styles.label}>
          {label}
        </span>
      ) : null}
      <div className={styles.wrap}>
        <button
          ref={trigger}
          type="button"
          className={styles.control}
          aria-haspopup="dialog"
          aria-expanded={open}
          {...(label ? { 'aria-labelledby': `${generated}-label ${generated}-value` } : {})}
          onClick={() => {
            if (open) close(false);
            else openPopover();
          }}
        >
          <CalendarIcon />
          <span id={`${generated}-value`}>{text}</span>
        </button>
        {open ? (
          <div
            ref={popover}
            role="dialog"
            aria-label={labels.title}
            className={[styles.popover, placement === 'form' ? styles.form : styles.toolbar].join(
              ' ',
            )}
            {...(shift ? { style: { translate: `${String(shift)}px 0` } } : {})}
          >
            <div className={styles.presets}>
              {presets.map((preset) => (
                <Button
                  key={preset}
                  variant="ghost"
                  className={styles.preset}
                  aria-pressed={value.preset === preset}
                  onClick={() => {
                    pick(preset);
                  }}
                >
                  {labels.presets[preset]}
                </Button>
              ))}
            </div>
            {allow_custom ? (
              <form className={styles.custom} noValidate onSubmit={apply}>
                <p className={styles.customTitle}>{labels.custom}</p>
                <Calendar
                  mode="range"
                  month={month}
                  onMonthChange={setMonth}
                  value={draft}
                  onChange={(next) => {
                    setDraft(next);
                    setError(false);
                  }}
                  today={today}
                  locale={locale}
                  labels={{
                    previous: labels.previous,
                    next: labels.next,
                    today: labels.today_marker,
                  }}
                />
                <p className={styles.summary} aria-live="polite">
                  {summary}
                </p>
                {error ? (
                  <p role="alert" className={styles.error}>
                    {labels.first_day_error}
                  </p>
                ) : null}
                <Button variant="primary" type="submit">
                  {labels.apply}
                </Button>
              </form>
            ) : null}
          </div>
        ) : null}
      </div>
      {name ? (
        <>
          <input type="hidden" name="period" value={value.preset} />
          <input type="hidden" name="from" value={range?.from ?? ''} />
          <input type="hidden" name="to" value={range?.to ?? ''} />
        </>
      ) : null}
    </div>
  );
}
