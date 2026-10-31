import { Card } from '@atria/ui';
import { formatDateTime } from '../../../shared/format/intl';
import { summarizeRule } from '../../../shared/forms/recurrence-fields';
import { useT } from '../../../shared/i18n/i18n';
import { usePreferences } from '../../../shared/preferences/preferences-context';
import { toRule, type Reminder } from '../hooks/use-reminders';
import styles from './reminder-overview.module.css';

/** O resumo da regra completa vem da base (DEC-008). */
export function useRepetitionText(reminder: Reminder | undefined): string {
  const t = useT();
  const { locale } = usePreferences();
  if (reminder === undefined) return '';
  return reminder.rule
    ? summarizeRule(toRule(reminder.rule), locale)
    : t('reminders.detail.repetition_one_off');
}

export function ReminderOverview({ reminder }: { reminder: Reminder }) {
  const t = useT();
  const { locale, time_zone } = usePreferences();
  const repetition = useRepetitionText(reminder);
  const when = reminder.next_fire_at ?? reminder.remind_at ?? null;
  const visibility =
    reminder.visibility === 'shared'
      ? t('reminders.form.visibility_shared')
      : t('reminders.form.visibility_personal');

  return (
    <div className={styles.grid}>
      <div className={styles.column}>
        <Card as="section" aria-labelledby="reminder-card-reminder">
          <h2 id="reminder-card-reminder" className={styles.cardTitle}>
            {t('reminders.detail.card_reminder')}
          </h2>
          <dl className={styles.facts}>
            <dt>
              {t(reminder.kind === 'recurring' ? 'reminders.detail.next' : 'reminders.detail.when')}
            </dt>
            <dd>
              {when === null
                ? t('reminders.detail.no_next')
                : formatDateTime(when, locale, time_zone)}
            </dd>
            <dt>{t('reminders.detail.repetition')}</dt>
            <dd>{repetition}</dd>
          </dl>
          <p className={styles.notes}>{t('reminders.detail.only_notifies')}</p>
        </Card>
        {reminder.notes ? (
          <Card as="section" aria-labelledby="reminder-card-notes">
            <h2 id="reminder-card-notes" className={styles.cardTitle}>
              {t('reminders.detail.card_notes')}
            </h2>
            <p className={styles.notes}>{reminder.notes}</p>
          </Card>
        ) : null}
      </div>
      <Card as="section" aria-labelledby="reminder-card-record">
        <h2 id="reminder-card-record" className={styles.cardTitle}>
          {t('reminders.detail.card_record')}
        </h2>
        <dl className={styles.facts}>
          <dt>{t('reminders.detail.visibility')}</dt>
          <dd>{visibility}</dd>
          <dt>{t('reminders.detail.created_at')}</dt>
          <dd>{formatDateTime(reminder.created_at, locale, time_zone)}</dd>
          <dt>{t('reminders.detail.updated_at')}</dt>
          <dd>{formatDateTime(reminder.updated_at, locale, time_zone)}</dd>
        </dl>
      </Card>
    </div>
  );
}
