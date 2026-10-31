import { Button, Card } from '@atria/ui';
import { useState } from 'react';
import { useT } from '../../shared/i18n/i18n';
import { StickyPageHeader } from '../../shared/layout/sticky-page-header';
import { BackLink } from '../../shared/navigation/back-link';
import styles from './reports.module.css';
import { useFileDownload } from './use-file-download';
import './use-report-result';

type ExportFormat = 'json' | 'csv';

const FALLBACK_NAME: Record<ExportFormat, string> = {
  json: 'atria-export.json',
  csv: 'atria-export-csv.zip',
};

/** Exportação de todos os dados da própria pessoa em JSON e CSV (RF-63). */
export function ExportsPage() {
  const t = useT();
  const { download, is_loading, error } = useFileDownload();
  const [running, setRunning] = useState<ExportFormat | null>(null);

  function start(format: ExportFormat) {
    setRunning(format);
    void download({
      path: '/exports',
      query: { format },
      fallback_name: FALLBACK_NAME[format],
    }).finally(() => {
      setRunning(null);
    });
  }

  return (
    <>
      <StickyPageHeader
        back={<BackLink module="reports" fallback_to="/reports" to="/reports" />}
        eyebrow={t('reports.exports.eyebrow')}
        title={t('reports.exports.title')}
        subtitle={t('reports.exports.subtitle')}
      />
      <div className={styles.stack}>
        <Card as="section" aria-label={t('reports.exports.formats')}>
          <div className={styles.formats}>
            {(['json', 'csv'] as const).map((format) => (
              <Button
                key={format}
                variant={format === 'json' ? 'primary' : 'secondary'}
                loading={is_loading && running === format}
                disabled={is_loading && running !== format}
                onClick={() => {
                  start(format);
                }}
              >
                {is_loading && running === format
                  ? t('reports.exports.running')
                  : t(`reports.exports.${format}`)}
              </Button>
            ))}
          </div>
          <p className={styles.muted}>{t('reports.exports.hint')}</p>
        </Card>
        {error ? (
          <p role="alert" className={styles.exportError}>
            {t('reports.exports.failed')}
          </p>
        ) : null}
      </div>
    </>
  );
}
