import { Button, EmptyState, ErrorState, LoadingState } from '@atria/ui';
import { useParams } from '@tanstack/react-router';
import { useEffect } from 'react';
import { NotFoundPage } from '../../app/layout/not-found-page';
import { ApiProblem } from '../../shared/api/problem';
import { useT } from '../../shared/i18n/i18n';
import { useScreenInfo } from '../../shared/layout/screen-info';
import { StickyPageHeader } from '../../shared/layout/sticky-page-header';
import { BackLink } from '../../shared/navigation/back-link';
import { findReport, reportKeys, type ReportId } from './report-catalog';
import { isRefusal, ReportFilters } from './report-filters';
import { ReportResult } from './report-result';
import styles from './reports.module.css';
import { useFileDownload } from './use-file-download';
import { useReportResult } from './use-report-result';
import { apiParams, useReportSearch, useToday, type ReportSearch } from './use-report-search';

const API_BASE = '/api/v1';

function DownloadIcon() {
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
      <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
    </svg>
  );
}

function ReportActions({
  report,
  search,
  exporter,
}: {
  report: ReportId;
  search: ReportSearch;
  exporter: ReturnType<typeof useFileDownload>;
}) {
  const t = useT();
  const today = useToday();
  const { download, is_loading } = exporter;
  const params = apiParams(report, search, today);
  const html = new URLSearchParams({ ...params, format: 'html' });
  return (
    <div className={styles.actions} role="group" aria-label={t('reports.actions_label')}>
      <a
        className={styles.linkButton}
        href={`${API_BASE}/reports/${report}?${html.toString()}`}
        target="_blank"
        rel="noopener"
        aria-describedby={`${report}-html-hint`}
      >
        {t('reports.open_html')}
      </a>
      <span id={`${report}-html-hint`} className={styles.visuallyHidden}>
        {t('reports.open_html_hint')}
      </span>
      <Button
        loading={is_loading}
        onClick={() => {
          void download({
            path: `/reports/${report}`,
            query: { ...params, format: 'pdf' },
            fallback_name: `atria-${report}.pdf`,
            success_key: 'reports.export_done',
          });
        }}
      >
        <DownloadIcon />
        {is_loading ? t('reports.exporting') : t('reports.export_pdf')}
      </Button>
    </div>
  );
}

/** Página de um relatório: filtros, "Gerar relatório" e o resultado, tudo lido da URL (PD-61). */
function ReportView({ report }: { report: ReportId }) {
  const t = useT();
  const entry = findReport(report);
  const { search, submit } = useReportSearch(report);
  const result = useReportResult(report, search);
  const { set_items } = useScreenInfo();
  const module_label = t(`reports.module.${entry?.module ?? 'finance'}`);
  const keys = reportKeys(report);
  const exporter = useFileDownload();

  useEffect(() => {
    set_items([{ label: t('reports.title'), value: module_label }]);
    return () => {
      set_items([]);
    };
  }, [module_label, set_items, t]);

  const error = result.error;
  if (error instanceof ApiProblem && error.code === 'report_not_found') return <NotFoundPage />;
  const refusal = isRefusal(error) ? error : null;
  const back = search.from_module ? `/${search.from_module}` : undefined;

  return (
    <>
      <StickyPageHeader
        back={<BackLink module="reports" fallback_to="/reports" {...(back ? { to: back } : {})} />}
        eyebrow={t('reports.eyebrow_report', { module: module_label })}
        title={t(keys.title)}
        subtitle={t(keys.description)}
        actions={
          search.run ? (
            <ReportActions report={report} search={search} exporter={exporter} />
          ) : undefined
        }
      />
      <div className={styles.stack}>
        <ReportFilters
          key={`${report}|${JSON.stringify(search)}`}
          report={report}
          search={search}
          refusal={refusal}
          loading={result.isFetching}
          onSubmit={submit}
        />
        {exporter.error ? (
          <p role="alert" className={styles.exportError}>
            {t('reports.export_failed')}
          </p>
        ) : null}
        <ResultArea result={result} search={search} refused={refusal !== null} />
      </div>
    </>
  );
}

function ResultArea({
  result,
  search,
  refused,
}: {
  result: ReturnType<typeof useReportResult>;
  search: ReportSearch;
  refused: boolean;
}) {
  const t = useT();
  if (!search.run) {
    return (
      <EmptyState
        title={t('reports.not_generated')}
        description={t('reports.not_generated_hint')}
      />
    );
  }
  if (refused) return null;
  return (
    <section aria-label={t('reports.result_label')} aria-busy={result.isFetching || undefined}>
      <ResultContent result={result} search={search} />
    </section>
  );
}

function ResultContent({
  result,
  search,
}: {
  result: ReturnType<typeof useReportResult>;
  search: ReportSearch;
}) {
  const t = useT();
  if (result.isPending) return <LoadingState label={t('reports.loading')} />;
  if (result.isError) {
    return (
      <ErrorState
        title={t('reports.error')}
        description={t('reports.error_hint')}
        retryLabel={t('reports.retry')}
        onRetry={() => {
          void result.refetch();
        }}
      />
    );
  }
  return <ReportResult model={result.data} search={search} />;
}

export function ReportPage() {
  const id = useParams({
    strict: false,
    select: (params: Record<string, unknown>) =>
      typeof params.report === 'string' ? params.report : undefined,
  });
  const entry = id === undefined ? undefined : findReport(id);
  if (!entry) return <NotFoundPage />;
  return <ReportView report={entry.id} />;
}
