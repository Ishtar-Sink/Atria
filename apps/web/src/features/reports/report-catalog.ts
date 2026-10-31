/** Os nove relatórios do catálogo da API (PD-61); a ordem é a da tela. */
export const REPORT_MODULES = [
  'finance',
  'library',
  'journal',
  'goals',
  'tasks',
  'projects',
] as const;
export type ReportModule = (typeof REPORT_MODULES)[number];

export type ReportFilterKey =
  | 'period'
  | 'account'
  | 'category'
  | 'book'
  | 'type'
  | 'emotion'
  | 'goal'
  | 'goal_status'
  | 'project';

interface CatalogEntry {
  readonly id: string;
  readonly module: ReportModule;
  readonly filters: readonly ReportFilterKey[];
}

export const REPORT_CATALOG = [
  { id: 'fin-flow', module: 'finance', filters: ['period', 'account'] },
  { id: 'fin-cat', module: 'finance', filters: ['period', 'account', 'category'] },
  { id: 'fin-diff', module: 'finance', filters: ['period', 'account'] },
  { id: 'read-pages', module: 'library', filters: ['period', 'book'] },
  { id: 'lib-status', module: 'library', filters: ['type'] },
  { id: 'journal-emo', module: 'journal', filters: ['period', 'emotion'] },
  { id: 'goals-progress', module: 'goals', filters: ['goal', 'goal_status'] },
  { id: 'tasks-done', module: 'tasks', filters: [] },
  { id: 'proj-cards', module: 'projects', filters: ['project'] },
] as const satisfies readonly CatalogEntry[];

export type ReportId = (typeof REPORT_CATALOG)[number]['id'];

export function findReport(id: string): (typeof REPORT_CATALOG)[number] | undefined {
  return REPORT_CATALOG.find((entry) => entry.id === id);
}

export function hasPeriod(id: string): boolean {
  const found: CatalogEntry | undefined = findReport(id);
  return found?.filters.includes('period') ?? false;
}

/** Nome de cada filtro na URL (e, salvo `emotion`, na API). */
export const FILTER_PARAM = {
  account: 'account_id',
  category: 'category_id',
  book: 'book_id',
  type: 'type',
  emotion: 'emotion',
  goal: 'goal_id',
  goal_status: 'goal_status',
  project: 'project_id',
} as const satisfies Record<Exclude<ReportFilterKey, 'period'>, string>;

export type EntityFilterKey = Exclude<ReportFilterKey, 'period'>;
export type FilterParam = (typeof FILTER_PARAM)[EntityFilterKey];

/** Filtros que apontam para uma entidade: os que, vindos de um link com `run=1`, abrem em "Qualquer período". */
export const ENTITY_FILTERS = ['account', 'category', 'book', 'goal', 'project'] as const;

export function reportKeys(id: string) {
  return { title: `reports.report.${id}.title`, description: `reports.report.${id}.description` };
}

export function reportHref(id: ReportId, params: Record<string, string | undefined> = {}): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') query.set(key, value);
  }
  const text = query.toString();
  return text === '' ? `/reports/${id}` : `/reports/${id}?${text}`;
}
