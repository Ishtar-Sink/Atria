import { Badge, Card, ErrorState, LoadingState } from '@atria/ui';
import { useT } from '../../../shared/i18n/i18n';
import { StickyPageHeader } from '../../../shared/layout/sticky-page-header';
import { usePreferences } from '../../../shared/preferences/preferences-context';
import { useInstanceStatus } from '../hooks/use-instance-status';
import { AdminSections } from './admin-sections';
import styles from './info-screens.module.css';

const UNITS = ['byte', 'kilobyte', 'megabyte', 'gigabyte', 'terabyte'] as const;

/** Bytes na unidade que deixa o número curto, com `Intl` (unidade `byte` e seus múltiplos). */
function formatBytes(bytes: number, locale: string): string {
  let value = Math.max(0, bytes);
  let index = 0;
  while (value >= 1024 && index < UNITS.length - 1) {
    value /= 1024;
    index += 1;
  }
  return new Intl.NumberFormat(locale, {
    style: 'unit',
    unit: UNITS[index] ?? 'byte',
    unitDisplay: 'short',
    maximumFractionDigits: index === 0 ? 0 : 1,
  }).format(value);
}

function HealthIcon({ healthy }: { healthy: boolean }) {
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
    >
      {healthy ? (
        <path d="m5 12 5 5 9-10" />
      ) : (
        <path d="M12 8v5M12 17h.01M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
      )}
    </svg>
  );
}

export function InstanceScreen() {
  const t = useT();
  const { locale } = usePreferences();
  const status = useInstanceStatus();

  function body() {
    if (status.isPending) return <LoadingState label={t('admin.instance.loading')} rows={3} />;
    if (status.isError) {
      return (
        <ErrorState
          title={t('admin.instance.error_title')}
          description={t('admin.instance.error_description')}
          retryLabel={t('common.retry')}
          onRetry={() => {
            void status.refetch();
          }}
        />
      );
    }
    const data = status.data;
    return (
      <div className={styles.cards}>
        <Card as="section" aria-labelledby="inst-version" className={styles.stat}>
          <p id="inst-version" className={styles.statLabel}>
            {t('admin.instance.version')}
          </p>
          <p className={styles.statValue}>{data.version}</p>
        </Card>
        <Card as="section" aria-labelledby="inst-space" className={styles.stat}>
          <p id="inst-space" className={styles.statLabel}>
            {t('admin.instance.used_space')}
          </p>
          <p className={styles.statValue}>
            {formatBytes(data.database_bytes + data.storage_bytes, locale)}
          </p>
          <p className={styles.statDetail}>
            {t('admin.instance.used_detail', {
              database: formatBytes(data.database_bytes, locale),
              storage: formatBytes(data.storage_bytes, locale),
            })}
          </p>
        </Card>
        <Card as="section" aria-labelledby="inst-health" className={styles.stat}>
          <p id="inst-health" className={styles.statLabel}>
            {t('admin.instance.health')}
          </p>
          <p className={styles.statValue}>
            <Badge tone={data.healthy ? 'success' : 'warning'} className={styles.health}>
              <HealthIcon healthy={data.healthy} />
              {t(data.healthy ? 'admin.instance.healthy' : 'admin.instance.unhealthy')}
            </Badge>
          </p>
        </Card>
      </div>
    );
  }

  return (
    <>
      <StickyPageHeader
        eyebrow={t('admin.nav.title')}
        title={t('admin.instance.title')}
        subtitle={t('admin.instance.subtitle')}
      />
      <AdminSections />
      {body()}
    </>
  );
}
