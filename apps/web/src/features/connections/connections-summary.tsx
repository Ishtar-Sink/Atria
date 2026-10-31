import { LoadingState } from '@atria/ui';
import { Link } from '@tanstack/react-router';
import { useT } from '../../shared/i18n/i18n';
import styles from './connections.module.css';
import { useConnectionItems } from './use-connections';
import './use-linked-titles';

export interface ConnectionsSummaryProps {
  entity_type: string;
  entity_id: string;
  limit?: number;
}

/** Lista compacta das ligações mais recentes, para o cartão "Ligações" do projeto (PD-42). */
export function ConnectionsSummary({ entity_type, entity_id, limit = 5 }: ConnectionsSummaryProps) {
  const t = useT();
  const { query, items } = useConnectionItems(entity_type, entity_id);

  if (query.isPending) return <LoadingState label={t('connections.loading')} rows={2} />;
  if (query.isError) {
    return (
      <p role="alert" className={styles.muted}>
        {t('connections.summary.error')}
      </p>
    );
  }
  if (items.length === 0) {
    return (
      <>
        <p className={styles.muted}>{t('connections.summary.empty')}</p>
        <p className={styles.more}>
          <Link to="." search={{ tab: 'connections' }}>
            {t('connections.summary.connect')}
          </Link>
        </p>
      </>
    );
  }
  return (
    <>
      <ul className={styles.summary}>
        {items.slice(0, limit).map((item) => (
          <li key={item.id} className={styles.summaryItem}>
            {item.href === null ? (
              <span className={styles.rowTitle}>{item.title}</span>
            ) : (
              <Link to={item.href} className={styles.rowTitle}>
                {item.title}
              </Link>
            )}
            <span className={styles.rowSub}>{t(`connections.type.${item.linked_type}`)}</span>
          </li>
        ))}
      </ul>
      {items.length > limit ? (
        <p className={styles.more}>
          <Link to="." search={{ tab: 'connections' }}>
            {t('connections.summary.more')}
          </Link>
        </p>
      ) : null}
    </>
  );
}
