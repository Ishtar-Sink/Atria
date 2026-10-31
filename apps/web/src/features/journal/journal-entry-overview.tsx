import { Badge, Card } from '@atria/ui';
import { formatDateTime } from '../../shared/format/intl';
import { useT } from '../../shared/i18n/i18n';
import { usePreferences } from '../../shared/preferences/preferences-context';
import { emotionLabel } from './use-emotions';
import type { JournalEntry } from './use-journal-entries';
import styles from './journal-entry-overview.module.css';

export interface JournalEntryOverviewProps {
  entry: JournalEntry;
}

/**
 * Visão geral em cartões (PD-59). O texto é React puro: nunca vira HTML, então nada do que a
 * pessoa escreveu é interpretado como marcação ([project/security-15]).
 */
export function JournalEntryOverview({ entry }: JournalEntryOverviewProps) {
  const t = useT();
  const { locale, time_zone } = usePreferences();
  const visibility =
    entry.visibility === 'shared'
      ? t('journal.form.visibility_shared')
      : t('journal.form.visibility_personal');

  return (
    <div className={styles.grid}>
      <Card as="section" aria-labelledby="journal-card-entry">
        <h2 id="journal-card-entry" className={styles.cardTitle}>
          {t('journal.entry.card_entry')}
        </h2>
        <p className={styles.text}>{entry.text}</p>
      </Card>
      <div className={styles.column}>
        <Card as="section" aria-labelledby="journal-card-emotions">
          <h2 id="journal-card-emotions" className={styles.cardTitle}>
            {t('journal.entry.card_emotions')}
          </h2>
          {entry.emotions.length === 0 ? (
            <p className={styles.none}>{t('journal.entry.emotions_none')}</p>
          ) : (
            <ul className={styles.emotions}>
              {entry.emotions.map((item) => {
                const name = emotionLabel(item, t);
                return (
                  <li key={item.emotion_id}>
                    <Badge tone="accent">
                      {item.intensity == null
                        ? name
                        : t('journal.entry.emotion_with_intensity', {
                            emotion: name,
                            n: item.intensity,
                          })}
                    </Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
        <Card as="section" aria-labelledby="journal-card-record">
          <h2 id="journal-card-record" className={styles.cardTitle}>
            {t('journal.entry.card_record')}
          </h2>
          <dl className={styles.facts}>
            <dt>{t('journal.entry.when')}</dt>
            <dd>{formatDateTime(entry.occurred_at, locale, time_zone)}</dd>
            <dt>{t('journal.entry.visibility')}</dt>
            <dd>{visibility}</dd>
            <dt>{t('journal.entry.created_at')}</dt>
            <dd>{formatDateTime(entry.created_at, locale, time_zone)}</dd>
            <dt>{t('journal.entry.updated_at')}</dt>
            <dd>{formatDateTime(entry.updated_at, locale, time_zone)}</dd>
          </dl>
        </Card>
      </div>
    </div>
  );
}
