import { Card } from '@atria/ui';
import { Link } from '@tanstack/react-router';
import { useEffect } from 'react';
import { useT } from '../../shared/i18n/i18n';
import { useScreenInfo } from '../../shared/layout/screen-info';
import { StickyPageHeader } from '../../shared/layout/sticky-page-header';
import { REPORT_CATALOG, REPORT_MODULES, reportKeys } from './report-catalog';
import styles from './reports.module.css';
import './use-report-result';

function Chevron() {
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
      className={styles.chevron}
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

/** Catálogo dos nove relatórios, agrupados pelo módulo de origem (RF-61, PD-61). */
export function ReportsListPage() {
  const t = useT();
  const { set_items } = useScreenInfo();

  useEffect(() => {
    set_items([
      {
        label: t('reports.items_label'),
        value: t('reports.items', { count: REPORT_CATALOG.length }),
      },
    ]);
    return () => {
      set_items([]);
    };
  }, [set_items, t]);

  return (
    <>
      <StickyPageHeader
        eyebrow={t('reports.eyebrow')}
        title={t('reports.title')}
        subtitle={t('reports.subtitle')}
      />
      <div className={styles.stack}>
        {REPORT_MODULES.map((module) => {
          const reports = REPORT_CATALOG.filter((entry) => entry.module === module);
          if (reports.length === 0) return null;
          const heading = `reports-module-${module}`;
          return (
            <Card as="section" key={module} aria-labelledby={heading}>
              <h2 id={heading} className={styles.sectionTitle}>
                {t(`reports.module.${module}`)}
              </h2>
              <ul className={styles.list}>
                {reports.map((entry) => (
                  <li key={entry.id} className={styles.row}>
                    <div className={styles.rowMain}>
                      <Link
                        to="/reports/$report"
                        params={{ report: entry.id }}
                        className={styles.rowTitle}
                      >
                        {t(reportKeys(entry.id).title)}
                      </Link>
                      <span className={styles.rowSub}>{t(reportKeys(entry.id).description)}</span>
                    </div>
                    <Chevron />
                  </li>
                ))}
              </ul>
            </Card>
          );
        })}
        <Link to="/reports/exports" className={styles.footLink}>
          {t('reports.exports_link')}
        </Link>
      </div>
    </>
  );
}
