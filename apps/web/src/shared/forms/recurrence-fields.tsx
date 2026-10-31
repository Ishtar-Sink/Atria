import {
  Checkbox,
  DateField,
  SelectField,
  TextField,
  TimeField,
  type DateFieldLabels,
} from '@atria/ui';
import { Controller, type Control, type FieldPath, type FieldValues } from 'react-hook-form';
import { useT, translate } from '../i18n/i18n';
import { usePreferences } from '../preferences/preferences-context';
import { useDateLabels } from './form-fields';
import styles from './recurrence-fields.module.css';

export type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';
export type RecurrenceWeekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

/** A "Regra de recorrência" do contrato da spec (tarefas, lembretes e movimentações). */
export interface RecurrenceRule {
  frequency: RecurrenceFrequency;
  interval: number;
  weekdays: RecurrenceWeekday[];
  month_day: number | null;
  /** `HH:mm`; o Financeiro não usa. */
  time: string | null;
  timezone: string;
  /** `YYYY-MM-DD`. */
  starts_on: string;
  ends_on: string | null;
}

export type RecurrenceField =
  'frequency' | 'interval' | 'weekdays' | 'month_day' | 'time' | 'starts_on' | 'ends_on';

export const RECURRENCE_FREQUENCIES: readonly RecurrenceFrequency[] = [
  'daily',
  'weekly',
  'monthly',
  'yearly',
];

export const RECURRENCE_WEEKDAYS: readonly RecurrenceWeekday[] = [
  'mon',
  'tue',
  'wed',
  'thu',
  'fri',
  'sat',
  'sun',
];

/** Regra inicial: todo dia, a partir de `starts_on`, no fuso informado. */
export function defaultRecurrenceRule(timezone: string, starts_on = ''): RecurrenceRule {
  return {
    frequency: 'daily',
    interval: 1,
    weekdays: [],
    month_day: null,
    time: null,
    timezone,
    starts_on,
    ends_on: null,
  };
}

export interface RecurrenceLabels {
  legend: string;
  frequency: string;
  frequencies: Record<RecurrenceFrequency, string>;
  interval: string;
  /** Unidade do intervalo por frequência ("dias", "semanas"…), entre parênteses no rótulo. */
  interval_units: Record<RecurrenceFrequency, string>;
  weekdays: string;
  weekday_short: Record<RecurrenceWeekday, string>;
  weekday_long: Record<RecurrenceWeekday, string>;
  month_day: string;
  month_day_help: string;
  time: string;
  time_optional: string;
  time_placeholder: string;
  /** Ajuda do horário, com `{zone}` no lugar do fuso. */
  time_zone: string;
  starts_on: string;
  ends_on: string;
  summary: string;
  date: DateFieldLabels;
}

/** Os rótulos do editor a partir das mensagens comuns. */
export function useRecurrenceLabels(): RecurrenceLabels {
  const t = useT();
  const date = useDateLabels();
  const by = <K extends string>(keys: readonly K[], prefix: string) =>
    Object.fromEntries(keys.map((key) => [key, t(`${prefix}_${key}`)])) as Record<K, string>;
  return {
    legend: t('common.recurrence_legend'),
    frequency: t('common.recurrence_frequency'),
    frequencies: by(RECURRENCE_FREQUENCIES, 'common.recurrence_frequency'),
    interval: t('common.recurrence_interval'),
    interval_units: by(RECURRENCE_FREQUENCIES, 'common.recurrence_unit'),
    weekdays: t('common.recurrence_weekdays'),
    weekday_short: by(RECURRENCE_WEEKDAYS, 'common.weekday_short'),
    weekday_long: by(RECURRENCE_WEEKDAYS, 'common.weekday_long'),
    month_day: t('common.recurrence_month_day'),
    month_day_help: t('common.recurrence_month_day_help'),
    time: t('common.recurrence_time'),
    time_optional: t('common.recurrence_time_optional'),
    time_placeholder: t('common.time_placeholder'),
    time_zone: t('common.recurrence_time_zone', { zone: '{zone}' }),
    starts_on: t('common.recurrence_starts_on'),
    ends_on: t('common.recurrence_ends_on'),
    summary: t('common.recurrence_summary_label'),
    date,
  };
}

function formatDay(iso: string, locale: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(
    date,
  );
}

/** Resumo legível da regra: "Todo mês no dia 31", "Toda segunda e quarta, 08:00". */
export function summarizeRule(rule: RecurrenceRule, locale: string): string {
  const t = (key: string, params: Record<string, string | number> = {}) =>
    translate(`common.${key}`, params, locale);
  const n = Number.isFinite(rule.interval) && rule.interval > 1 ? rule.interval : 1;
  const every = n > 1;
  let summary: string;

  if (rule.frequency === 'daily') {
    summary = every ? t('recurrence_summary_daily_every', { n }) : t('recurrence_summary_daily');
  } else if (rule.frequency === 'weekly') {
    const chosen = RECURRENCE_WEEKDAYS.filter((day) => rule.weekdays.includes(day));
    if (chosen.length === 0) {
      summary = every
        ? t('recurrence_summary_weekly_every', { n })
        : t('recurrence_summary_weekly');
    } else {
      const days = new Intl.ListFormat(locale, { style: 'long', type: 'conjunction' }).format(
        chosen.map((day) => t(`weekday_summary_${day}`)),
      );
      const weekend = chosen.every((day) => day === 'sat' || day === 'sun');
      summary = every
        ? t('recurrence_summary_weekly_every_days', { n, days })
        : t(
            weekend ? 'recurrence_summary_weekly_days_masculine' : 'recurrence_summary_weekly_days',
            {
              days,
            },
          );
    }
  } else if (rule.frequency === 'monthly') {
    const day = rule.month_day;
    if (day === null) {
      summary = every
        ? t('recurrence_summary_monthly_every', { n })
        : t('recurrence_summary_monthly');
    } else {
      summary = every
        ? t('recurrence_summary_monthly_every_day', { n, day })
        : t('recurrence_summary_monthly_day', { day });
    }
  } else {
    const date = formatDay(rule.starts_on, locale);
    if (date === null) {
      summary = every
        ? t('recurrence_summary_yearly_every', { n })
        : t('recurrence_summary_yearly');
    } else {
      summary = every
        ? t('recurrence_summary_yearly_every_on', { n, date })
        : t('recurrence_summary_yearly_on', { date });
    }
  }

  return rule.time ? t('recurrence_summary_with_time', { summary, time: rule.time }) : summary;
}

export interface RecurrenceFieldsProps {
  value: RecurrenceRule;
  onChange: (rule: RecurrenceRule) => void;
  labels: RecurrenceLabels;
  locale: string;
  /** Mostra o horário; o Financeiro passa `false`. */
  with_time?: boolean;
  /** O horário é obrigatório (lembretes): só muda o rótulo; a validação é da tela. */
  time_required?: boolean;
  /** Mensagem de erro por campo. */
  errors?: Partial<Record<RecurrenceField, string>>;
  /** Mostra o resumo legível embaixo dos campos. */
  show_summary?: boolean;
  className?: string;
}

const MONTH_DAYS = Array.from({ length: 31 }, (_, index) => {
  const day = String(index + 1);
  return { value: day, label: day };
});

/**
 * Campos da regra de recorrência. Os campos aparecem conforme a frequência;
 * ao trocar a frequência, os que ela não usa são limpos.
 */
export function RecurrenceFields({
  value,
  onChange,
  labels,
  locale,
  with_time = true,
  time_required = false,
  errors = {},
  show_summary = true,
  className,
}: RecurrenceFieldsProps) {
  const patch = (changes: Partial<RecurrenceRule>) => {
    onChange({ ...value, ...changes });
  };
  const { frequency } = value;

  function changeFrequency(next: string) {
    const to = next as RecurrenceFrequency;
    patch({
      frequency: to,
      weekdays: to === 'weekly' ? value.weekdays : [],
      month_day: to === 'monthly' ? value.month_day : null,
    });
  }

  function toggleWeekday(day: RecurrenceWeekday, checked: boolean) {
    const next = checked ? [...value.weekdays, day] : value.weekdays.filter((d) => d !== day);
    patch({ weekdays: RECURRENCE_WEEKDAYS.filter((d) => next.includes(d)) });
  }

  return (
    <fieldset className={[styles.root, className].filter(Boolean).join(' ')}>
      <legend className={styles.legend}>{labels.legend}</legend>
      <div className={styles.grid}>
        <SelectField
          label={labels.frequency}
          options={RECURRENCE_FREQUENCIES.map((f) => ({ value: f, label: labels.frequencies[f] }))}
          value={frequency}
          onChange={changeFrequency}
          {...(errors.frequency ? { error: errors.frequency } : {})}
        />
        <TextField
          type="number"
          min={1}
          inputMode="numeric"
          label={`${labels.interval} (${labels.interval_units[frequency]})`}
          value={value.interval > 0 ? String(value.interval) : ''}
          onChange={(event) => {
            patch({ interval: Math.trunc(Number(event.target.value)) || 0 });
          }}
          {...(errors.interval ? { error: errors.interval } : {})}
        />

        {frequency === 'weekly' ? (
          <fieldset className={[styles.weekdays, styles.full].join(' ')}>
            <legend className={styles.legend}>{labels.weekdays}</legend>
            <div className={styles.weekdays_list}>
              {RECURRENCE_WEEKDAYS.map((day) => (
                <Checkbox
                  key={day}
                  label={labels.weekday_short[day]}
                  aria-label={labels.weekday_long[day]}
                  checked={value.weekdays.includes(day)}
                  onChange={(event) => {
                    toggleWeekday(day, event.target.checked);
                  }}
                />
              ))}
            </div>
            {errors.weekdays ? (
              <p role="alert" className={styles.error}>
                {errors.weekdays}
              </p>
            ) : null}
          </fieldset>
        ) : null}

        {frequency === 'monthly' ? (
          <SelectField
            label={labels.month_day}
            help={labels.month_day_help}
            options={MONTH_DAYS}
            value={value.month_day === null ? '' : String(value.month_day)}
            onChange={(day) => {
              patch({ month_day: day === '' ? null : Number(day) });
            }}
            {...(errors.month_day ? { error: errors.month_day } : {})}
          />
        ) : null}

        {with_time ? (
          <TimeField
            label={time_required ? labels.time : labels.time_optional}
            value={value.time ?? ''}
            onChange={(time) => {
              patch({ time: time === '' ? null : time });
            }}
            placeholder={labels.time_placeholder}
            help={labels.time_zone.replace('{zone}', value.timezone)}
            {...(errors.time ? { error: errors.time } : {})}
          />
        ) : null}

        <DateField
          label={labels.starts_on}
          value={value.starts_on}
          onChange={(starts_on) => {
            patch({ starts_on });
          }}
          locale={locale}
          labels={labels.date}
          {...(errors.starts_on ? { error: errors.starts_on } : {})}
        />
        <DateField
          label={labels.ends_on}
          value={value.ends_on ?? ''}
          onChange={(ends_on) => {
            patch({ ends_on: ends_on === '' ? null : ends_on });
          }}
          locale={locale}
          labels={labels.date}
          {...(errors.ends_on ? { error: errors.ends_on } : {})}
        />
      </div>
      {show_summary ? (
        <p className={styles.summary} aria-label={labels.summary} data-recurrence-summary="">
          {summarizeRule(value, locale)}
        </p>
      ) : null}
    </fieldset>
  );
}

type FieldErrors = Partial<Record<RecurrenceField, { message?: string } | undefined>>;

export interface FormRecurrenceProps<T extends FieldValues> {
  control: Control<T>;
  /** Campo do formulário que guarda a `RecurrenceRule`. */
  name: FieldPath<T>;
  with_time?: boolean;
  time_required?: boolean;
  show_summary?: boolean;
  labels?: Partial<RecurrenceLabels>;
}

/** Liga o editor ao `react-hook-form`; o fuso do usuário vai na regra a cada alteração. */
export function FormRecurrence<T extends FieldValues>({
  control,
  name,
  with_time,
  time_required,
  show_summary,
  labels,
}: FormRecurrenceProps<T>) {
  const t = useT();
  const { locale, time_zone } = usePreferences();
  const base = useRecurrenceLabels();
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const nested = fieldState.error as unknown as FieldErrors | undefined;
        const errors: Partial<Record<RecurrenceField, string>> = {};
        for (const key of Object.keys(nested ?? {}) as RecurrenceField[]) {
          const message = nested?.[key]?.message;
          if (message) errors[key] = t(message);
        }
        return (
          <RecurrenceFields
            value={field.value}
            onChange={(rule) => {
              field.onChange({ ...rule, timezone: time_zone });
            }}
            labels={{ ...base, ...labels }}
            locale={locale}
            errors={errors}
            {...(with_time === undefined ? {} : { with_time })}
            {...(time_required === undefined ? {} : { time_required })}
            {...(show_summary === undefined ? {} : { show_summary })}
          />
        );
      }}
    />
  );
}
