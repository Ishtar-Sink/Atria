/** Os relatórios do módulo `journal` no catálogo da TASK-17 (PD-61). */
export const JOURNAL_REPORTS = [
  { id: 'journal-emo', title_key: 'journal.reports.journal_emo' },
] as const;

export type JournalReportId = (typeof JOURNAL_REPORTS)[number]['id'];

/** O caminho diz de qual módulo o usuário veio, no padrão dos relatórios dos módulos. */
export function journalReportHref(id: JournalReportId): string {
  return `/reports/${id}?from_module=journal`;
}
