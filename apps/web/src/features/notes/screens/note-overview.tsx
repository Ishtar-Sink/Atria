import { Card } from '@atria/ui';
import { formatDate } from '../../../shared/format/intl';
import { useT } from '../../../shared/i18n/i18n';
import { usePreferences } from '../../../shared/preferences/preferences-context';
import type { Note } from '../hooks/use-notes';
import styles from './notes.module.css';

/** Visão geral em cartões, como os dashboards: o texto na zona principal e "Registro" na lateral (PD-59). */
export function NoteOverview({ note }: { note: Note }) {
  const t = useT();
  const { locale, time_zone } = usePreferences();
  const record: [string, string][] = [
    [t('notes.detail.field_visibility'), t(`notes.form.visibility_${note.visibility}`)],
    [t('notes.detail.field_created'), formatDate(note.created_at, locale, time_zone)],
    [t('notes.detail.field_updated'), formatDate(note.updated_at, locale, time_zone)],
  ];
  return (
    <div className={styles.dash}>
      <div className={styles.zone}>
        <Card as="section" aria-labelledby="note-card-text">
          <h2 id="note-card-text" className={styles.cardTitle}>
            {t('notes.detail.card_text')}
          </h2>
          {note.body === '' ? (
            <p className={[styles.longText, styles.muted].join(' ')}>{t('notes.detail.no_text')}</p>
          ) : (
            <p className={styles.longText}>{note.body}</p>
          )}
        </Card>
      </div>
      <div className={styles.zone}>
        <Card as="section" aria-labelledby="note-card-record">
          <h2 id="note-card-record" className={styles.cardTitle}>
            {t('notes.detail.card_record')}
          </h2>
          <dl className={styles.about}>
            {record.map(([name, value]) => (
              <div key={name}>
                <dt>{name}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </Card>
      </div>
    </div>
  );
}
