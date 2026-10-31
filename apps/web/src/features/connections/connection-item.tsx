import { Badge, Button, ItemSwatch } from '@atria/ui';
import { Link } from '@tanstack/react-router';
import { formatDate } from '../../shared/format/intl';
import { useT } from '../../shared/i18n/i18n';
import { usePreferences } from '../../shared/preferences/preferences-context';
import styles from './connections.module.css';
import type { ConnectionItem as ConnectionItemData } from './use-connections';

export interface ConnectionItemProps {
  item: ConnectionItemData;
  onRemove: (item: ConnectionItemData) => void;
}

/** Uma ligação: título (com link para a tela), tipo, categoria, data e remover (RF-19). */
export function ConnectionItem({ item, onRemove }: ConnectionItemProps) {
  const t = useT();
  const { locale, time_zone } = usePreferences();
  const type_label = t(`connections.type.${item.linked_type}`);
  return (
    <li className={styles.row} aria-busy={item.loading || undefined}>
      <ItemSwatch id={item.linked_id} className={styles.swatch} />
      <div className={styles.rowMain}>
        {item.href === null ? (
          <span className={styles.rowTitle}>{item.title}</span>
        ) : (
          <Link to={item.href} className={styles.rowTitle}>
            {item.title}
          </Link>
        )}
        {item.title === type_label ? null : <span className={styles.rowSub}>{type_label}</span>}
      </div>
      <Badge tone="accent">{t(`connections.category.${item.category}`)}</Badge>
      <span className={styles.rowDate}>
        {t('connections.linked_on', { date: formatDate(item.created_at, locale, time_zone) })}
      </span>
      <Button
        variant="ghost"
        className={styles.remove}
        aria-label={t('connections.remove_label', { title: item.title })}
        onClick={() => {
          onRemove(item);
        }}
      >
        {t('connections.remove')}
      </Button>
    </li>
  );
}
