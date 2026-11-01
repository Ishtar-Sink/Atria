import {
  ColorField,
  DateField,
  DateTimeField,
  PeriodField,
  SegmentedField,
  SelectField,
  TagField,
  TimeField,
  type PeriodPreset,
} from '@atria/ui';
import { Controller, type Control, type FieldPath, type FieldValues } from 'react-hook-form';
import { useT } from '../i18n/i18n';
import { usePreferences } from '../preferences/preferences-context';

interface Base<T extends FieldValues> {
  control: Control<T>;
  name: FieldPath<T>;
  label: string;
  help?: string;
}

/** A mensagem do zod é uma chave de tradução; texto sem chave aparece como veio. */
function useErrorText() {
  const t = useT();
  return (message: string | undefined) => (message ? t(message) : undefined);
}

export function useDateLabels() {
  const t = useT();
  return {
    placeholder: t('common.pick_date'),
    today: t('common.today'),
    clear: t('common.clear'),
    previous: t('common.previous_month'),
    next: t('common.next_month'),
    today_marker: t('common.today_marker'),
  };
}

export function FormSelect<T extends FieldValues>({
  control,
  name,
  label,
  help,
  options,
  placeholder,
  empty_option,
  empty_help,
}: Base<T> & {
  options: { value: string; label: string }[];
  placeholder?: string;
  /** Texto da opção vazia, mostrada primeiro (valor `''`). */
  empty_option?: string;
  /** Ajuda mostrada no lugar de `help` quando não há opções. */
  empty_help?: string;
}) {
  const error = useErrorText();
  const shown = empty_option ? [{ value: '', label: empty_option }, ...options] : options;
  const shown_help = options.length === 0 && empty_help ? empty_help : help;
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <SelectField
          label={label}
          options={shown}
          value={field.value ?? ''}
          onChange={field.onChange}
          onBlur={field.onBlur}
          {...(shown_help ? { help: shown_help } : {})}
          {...(placeholder ? { placeholder } : {})}
          {...(fieldState.error ? { error: error(fieldState.error.message) ?? '' } : {})}
        />
      )}
    />
  );
}

export function FormSegmented<T extends FieldValues>({
  control,
  name,
  label,
  help,
  options,
}: Base<T> & { options: { value: string; label: string }[] }) {
  const error = useErrorText();
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <SegmentedField
          label={label}
          options={options}
          value={field.value ?? ''}
          onChange={field.onChange}
          onBlur={field.onBlur}
          {...(help ? { help } : {})}
          {...(fieldState.error ? { error: error(fieldState.error.message) ?? '' } : {})}
        />
      )}
    />
  );
}

export function FormDate<T extends FieldValues>({ control, name, label, help }: Base<T>) {
  const error = useErrorText();
  const { locale } = usePreferences();
  const labels = useDateLabels();
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <DateField
          label={label}
          value={field.value ?? ''}
          onChange={field.onChange}
          onBlur={field.onBlur}
          locale={locale}
          labels={labels}
          {...(help ? { help } : {})}
          {...(fieldState.error ? { error: error(fieldState.error.message) ?? '' } : {})}
        />
      )}
    />
  );
}

export function FormTime<T extends FieldValues>({ control, name, label, help }: Base<T>) {
  const error = useErrorText();
  const t = useT();
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <TimeField
          label={label}
          value={field.value ?? ''}
          onChange={field.onChange}
          onBlur={field.onBlur}
          placeholder={t('common.time_placeholder')}
          {...(help ? { help } : {})}
          {...(fieldState.error ? { error: error(fieldState.error.message) ?? '' } : {})}
        />
      )}
    />
  );
}

export function FormDateTime<T extends FieldValues>({ control, name, label, help }: Base<T>) {
  const error = useErrorText();
  const t = useT();
  const { locale } = usePreferences();
  const date_labels = useDateLabels();
  const labels = {
    ...date_labels,
    date: t('common.date_of', { label }),
    time: t('common.time_of', { label }),
    time_placeholder: t('common.time_placeholder'),
  };
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <DateTimeField
          label={label}
          value={field.value ?? ''}
          onChange={field.onChange}
          onBlur={field.onBlur}
          locale={locale}
          labels={labels}
          {...(help ? { help } : {})}
          {...(fieldState.error ? { error: error(fieldState.error.message) ?? '' } : {})}
        />
      )}
    />
  );
}

export function FormTags<T extends FieldValues>({ control, name, label, help }: Base<T>) {
  const error = useErrorText();
  const t = useT();
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <TagField
          label={label}
          value={(field.value as string[] | undefined) ?? []}
          onChange={field.onChange}
          onBlur={field.onBlur}
          list_label={t('common.tags_added', { label })}
          remove_label={(tag) => t('common.remove_tag', { tag })}
          {...(help ? { help } : {})}
          {...(fieldState.error ? { error: error(fieldState.error.message) ?? '' } : {})}
        />
      )}
    />
  );
}

export function FormColor<T extends FieldValues>({ control, name, label, help }: Base<T>) {
  const error = useErrorText();
  const t = useT();
  const labels = {
    title: t('common.color_title'),
    lightness: t('common.color_lightness'),
    hex: t('common.color_hex'),
    rgb: t('common.color_rgb'),
    red: t('common.color_red'),
    green: t('common.color_green'),
    blue: t('common.color_blue'),
    hsl: t('common.color_hsl'),
    hue: t('common.color_hue'),
    saturation: t('common.color_saturation'),
    cancel: t('common.cancel'),
    apply: t('common.color_apply'),
    wheel: t('common.color_wheel'),
  };
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <ColorField
          label={label}
          value={field.value ?? '#7C3AED'}
          onChange={field.onChange}
          onBlur={field.onBlur}
          labels={labels}
          {...(help ? { help } : {})}
          {...(fieldState.error ? { error: error(fieldState.error.message) ?? '' } : {})}
        />
      )}
    />
  );
}

const PRESETS: PeriodPreset[] = [
  'this_month',
  'last_month',
  'next_30_days',
  'last_30_days',
  'this_year',
  'all',
];

export function FormPeriod<T extends FieldValues>({
  control,
  name,
  label,
  presets,
  placement,
}: Base<T> & { presets?: PeriodPreset[]; placement: 'toolbar' | 'form' }) {
  const t = useT();
  const { locale } = usePreferences();
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const today = `${String(now.getFullYear())}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const labels = {
    presets: Object.fromEntries(PRESETS.map((p) => [p, t(`common.period_${p}`)])) as Record<
      PeriodPreset,
      string
    >,
    title: t('common.period_title'),
    custom: t('common.period_custom'),
    apply: t('common.period_apply'),
    first_day: t('common.period_first_day'),
    last_day: t('common.period_last_day'),
    first_day_error: t('common.period_first_day_error'),
    previous: t('common.previous_month'),
    next: t('common.next_month'),
    today_marker: t('common.today_marker'),
  };
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <PeriodField
          label={label}
          {...(field.value ? { value: field.value } : {})}
          onChange={field.onChange}
          {...(presets ? { presets } : {})}
          placement={placement}
          today={today}
          locale={locale}
          labels={labels}
        />
      )}
    />
  );
}
