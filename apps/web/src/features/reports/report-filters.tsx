import {
  Button,
  Card,
  PeriodField,
  SelectField,
  type PeriodPreset,
  type PeriodValue,
} from '@atria/ui';
import { useId, useState } from 'react';
import { ApiProblem } from '../../shared/api/problem';
import { useT } from '../../shared/i18n/i18n';
import { usePreferences } from '../../shared/preferences/preferences-context';
import { FILTER_PARAM, findReport, type EntityFilterKey, type ReportId } from './report-catalog';
import styles from './reports.module.css';
import { useFilterOptions, type FilterOption } from './use-filter-options';
import {
  toPeriodValue,
  useToday,
  type ReportFilters,
  type ReportSearch,
  type SubmitValues,
} from './use-report-search';

const PRESETS: readonly PeriodPreset[] = [
  'this_month',
  'last_month',
  'next_30_days',
  'last_30_days',
  'this_year',
  'all',
];

const GOAL_STATUSES = ['planned', 'in_progress', 'completed', 'abandoned'] as const;
const TYPES = ['book', 'article', 'video'] as const;

export interface ReportFiltersProps {
  report: ReportId;
  search: ReportSearch;
  /** Recusa do servidor (`report_filter_invalid` ou `report_period_invalid`), mostrada no cartão. */
  refusal: ApiProblem | null;
  loading: boolean;
  onSubmit: (values: SubmitValues) => void;
}

/** A recusa de filtro ou período volta do servidor com um destes códigos. */
export function isRefusal(error: unknown): error is ApiProblem {
  return (
    error instanceof ApiProblem &&
    (error.code === 'report_filter_invalid' || error.code === 'report_period_invalid')
  );
}

function usePeriodLabels() {
  const t = useT();
  return {
    presets: Object.fromEntries(
      PRESETS.map((preset) => [preset, t(`reports.period.${preset}`)]),
    ) as Record<PeriodPreset, string>,
    title: t('reports.period.title'),
    custom: t('reports.period.custom'),
    apply: t('reports.period.apply'),
    first_day: t('reports.period.first_day'),
    last_day: t('reports.period.last_day'),
    first_day_error: t('reports.period.first_day_error'),
    previous: t('reports.period.previous'),
    next: t('reports.period.next'),
    today_marker: t('reports.period.today_marker'),
  };
}

function useStaticOptions(key: EntityFilterKey): FilterOption[] | undefined {
  const t = useT();
  if (key === 'type') {
    return TYPES.map((value) => ({ value, label: t(`reports.filters.type_${value}`) }));
  }
  if (key === 'goal_status') {
    return GOAL_STATUSES.map((value) => ({
      value,
      label: t(`reports.filters.goal_status_${value}`),
    }));
  }
  return undefined;
}

function FilterSelect({
  filter,
  value,
  onChange,
  options,
}: {
  filter: EntityFilterKey;
  value: string;
  onChange: (value: string) => void;
  options: readonly FilterOption[];
}) {
  const t = useT();
  const all: FilterOption = { value: '', label: t(`reports.filters.${filter}_all`) };
  return (
    <div className={styles.field}>
      <SelectField
        label={t(`reports.filters.${filter}`)}
        options={[all, ...options]}
        value={value}
        onChange={onChange}
      />
    </div>
  );
}

function SelectFilters({
  report,
  values,
  onChange,
}: {
  report: ReportId;
  values: ReportFilters;
  onChange: (param: string, value: string) => void;
}) {
  const entry = findReport(report);
  const options = useFilterOptions(entry?.filters ?? []);
  const kinds = useStaticOptions('type');
  const statuses = useStaticOptions('goal_status');
  const lists: Record<EntityFilterKey, readonly FilterOption[]> = {
    account: options.account.data ?? [],
    category: options.category.data ?? [],
    book: options.book.data ?? [],
    emotion: options.emotion.data ?? [],
    goal: options.goal.data ?? [],
    project: options.project.data ?? [],
    type: kinds ?? [],
    goal_status: statuses ?? [],
  };
  const order = (entry?.filters ?? []).filter((key): key is EntityFilterKey => key !== 'period');
  return order.map((key) => (
    <FilterSelect
      key={key}
      filter={key}
      value={values[FILTER_PARAM[key]] ?? ''}
      options={lists[key]}
      onChange={(next) => {
        onChange(FILTER_PARAM[key], next);
      }}
    />
  ));
}

/** Cartão "Filtros": o período só nos relatórios que o têm, os filtros de cada relatório e "Gerar relatório". */
export function ReportFilters({ report, search, refusal, loading, onSubmit }: ReportFiltersProps) {
  const t = useT();
  const { locale } = usePreferences();
  const today = useToday();
  const labels = usePeriodLabels();
  const title_id = useId();
  const entry = findReport(report);
  const [period, setPeriod] = useState<PeriodValue>(() => toPeriodValue(search));
  const [values, setValues] = useState<ReportFilters>(search.filters);
  const has_period = entry?.filters.some((key) => key === 'period') ?? false;
  const has_filters = (entry?.filters.length ?? 0) > 0;

  // O `PeriodField` traz o próprio formulário (calendário): um `<form>` aqui o aninharia e o
  // "Aplicar" dele também dispararia o "Gerar relatório". Por isso é um grupo, não um formulário.
  function submit() {
    onSubmit({ ...(has_period ? { period } : {}), filters: values });
  }

  return (
    <Card as="section" aria-labelledby={title_id}>
      <h2 id={title_id} className={styles.sectionTitle}>
        {t('reports.filters.title')}
      </h2>
      <div className={styles.filters} role="group" aria-labelledby={title_id}>
        {has_period ? (
          <div className={styles.field}>
            <PeriodField
              label={t('reports.filters.period')}
              value={period}
              onChange={setPeriod}
              presets={PRESETS}
              allow_custom
              placement="form"
              today={today}
              locale={locale}
              labels={labels}
              name="period"
            />
          </div>
        ) : null}
        <SelectFilters
          report={report}
          values={values}
          onChange={(param, value) => {
            setValues((current) => ({ ...current, [param]: value }));
          }}
        />
        {has_filters ? null : <p className={styles.muted}>{t('reports.filters.none')}</p>}
        <Button type="button" variant="primary" loading={loading} onClick={submit}>
          {t('reports.generate')}
        </Button>
      </div>
      {refusal ? (
        <p role="alert" className={styles.filterError}>
          {t(
            refusal.code === 'report_period_invalid'
              ? 'reports.period_invalid'
              : 'reports.filter_invalid',
          )}
        </p>
      ) : null}
    </Card>
  );
}
