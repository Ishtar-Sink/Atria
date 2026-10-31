import { useQuery } from '@tanstack/react-query';
import { api } from '../../shared/api/client';
import { registerMessages } from '../../shared/i18n/i18n';
import messages from './i18n/pt-br.json';
import type { ReportId } from './report-catalog';
import { apiParams, useToday, type ReportSearch } from './use-report-search';

// Todas as telas da feature passam por aqui ou por `use-filter-options`; o registro é idempotente.
registerMessages('reports', messages);

/** Filtro que o servidor aplicou, como aparece no cabeçalho do relatório. */
export interface AppliedFilter {
  filter: string;
  label: string;
  value: string;
}

export interface ResolvedPeriod {
  from: string;
  to: string;
}

interface ModelBase {
  report: ReportId;
  generated_on: string;
  filters: AppliedFilter[];
}

interface PeriodModel extends ModelBase {
  period: ResolvedPeriod;
  any_period: boolean;
}

export interface FlowMonth {
  month: string;
  income: number;
  expense: number;
  net: number;
}

export interface FinFlowModel extends PeriodModel {
  report: 'fin-flow';
  currency: string;
  totals: { income: number; expense: number; net: number };
  months: FlowMonth[];
}

export interface FinCatModel extends PeriodModel {
  report: 'fin-cat';
  currency: string;
  total_expense: number;
  categories: { category_id: string | null; name: string; amount: number; percent: number }[];
}

export interface FinDiffModel extends PeriodModel {
  report: 'fin-diff';
  currency: string;
  totals: { savings: number; gains: number; losses: number };
  months: { month: string; savings: number; gains: number; losses: number }[];
}

export interface ReadPagesModel extends PeriodModel {
  report: 'read-pages';
  total_pages: number;
  session_count: number;
  books: {
    book_id: string;
    title: string;
    pages: number;
    sessions: number;
    progress_percent: number | null;
  }[];
}

export interface StatusCount {
  status: string;
  label: string;
  count: number;
}

export interface LibStatusModel extends ModelBase {
  report: 'lib-status';
  groups: {
    item_type: 'book' | 'article' | 'video';
    label: string;
    total: number;
    statuses: StatusCount[];
  }[];
}

export interface JournalEmoModel extends PeriodModel {
  report: 'journal-emo';
  entry_count: number;
  average_intensity: number | null;
  days: { date: string; entries: number }[];
  emotions: { emotion_id: string; name: string; count: number; average_intensity: number | null }[];
}

export interface GoalsProgressModel extends ModelBase {
  report: 'goals-progress';
  goals: {
    goal_id: string;
    title: string;
    status: string;
    deadline: string | null;
    progress_percent: number;
    milestone_count: number;
    completed_milestone_count: number;
  }[];
  by_status: StatusCount[];
}

export interface TasksDoneModel extends ModelBase {
  report: 'tasks-done';
  completed: number;
  open: number;
  overdue: number;
  recurring_notice: string;
}

export interface ProjCardsModel extends ModelBase {
  report: 'proj-cards';
  projects: {
    project_id: string;
    name: string;
    total_cards: number;
    lanes: { lane_id: string; name: string; color: string; card_count: number }[];
  }[];
}

export type ReportModel =
  | FinFlowModel
  | FinCatModel
  | FinDiffModel
  | ReadPagesModel
  | LibStatusModel
  | JournalEmoModel
  | GoalsProgressModel
  | TasksDoneModel
  | ProjCardsModel;

/** O modelo em JSON do relatório (`GET /reports/{report}` sem `format`), só depois de gerar. */
export function useReportResult(report_id: ReportId, search: ReportSearch) {
  const today = useToday();
  const params = apiParams(report_id, search, today);
  return useQuery({
    queryKey: ['reports', 'result', report_id, params],
    queryFn: ({ signal }) =>
      api.get<ReportModel>(`/reports/${report_id}`, { query: params, signal }),
    enabled: search.run,
  });
}
