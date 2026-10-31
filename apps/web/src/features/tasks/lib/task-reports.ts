/** Os relatórios do módulo `tasks` no catálogo da TASK-17 (PD-61). */
export const TASKS_REPORTS = [{ id: 'tasks-done', title_key: 'tasks.reports.tasks_done' }] as const;

export type TasksReportId = (typeof TASKS_REPORTS)[number]['id'];

/** O `tasks-done` não tem filtro de entidade: o caminho só diz de qual módulo o usuário veio. */
export function tasksReportHref(id: TasksReportId): string {
  return `/reports/${id}?from_module=tasks`;
}
