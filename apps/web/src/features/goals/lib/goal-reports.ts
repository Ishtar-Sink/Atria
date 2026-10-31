/** Relatórios do módulo Metas, do catálogo da TASK-17 (PD-61). */
export const GOALS_REPORTS = [
  { id: 'goals-progress', title_key: 'goals.reports.goals_progress' },
] as const;

export function goalsReportHref(report_id: string): string {
  return `/reports/${report_id}?from_module=goals`;
}

/** Relatório "Progresso das metas" já filtrado pela meta e executado. */
export function goalReportHref(goal_id: string): string {
  return `/reports/goals-progress?goal_id=${encodeURIComponent(goal_id)}&run=1&from_module=goals`;
}
