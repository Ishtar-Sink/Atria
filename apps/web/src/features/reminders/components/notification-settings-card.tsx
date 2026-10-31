import { Button, Card } from '@atria/ui';
import { useId } from 'react';
import { useT } from '../../../shared/i18n/i18n';
import { useNotificationPermission } from '../hooks/use-notification-permission';
import { useWebPush } from '../push/use-web-push';
import styles from './notification-settings-card.module.css';

/** Estado das notificações, o botão que pede a permissão e o interruptor do Web Push (RF-41, RF-42). */
export function NotificationSettingsCard() {
  const t = useT();
  const title_id = useId();
  const switch_id = useId();
  const { status, request } = useNotificationPermission();
  const push = useWebPush();

  return (
    <Card as="section" aria-labelledby={title_id}>
      <div className={styles.card}>
        <div className={styles.text}>
          <h2 id={title_id} className={styles.title}>
            {t('reminders.permission.title')}
          </h2>
          <p className={styles.status}>{t(`reminders.permission.${status}`)}</p>
        </div>
        {status === 'default' ? (
          <Button
            variant="primary"
            onClick={() => {
              void request();
            }}
          >
            {t('reminders.permission.enable')}
          </Button>
        ) : null}
      </div>
      {push.available ? (
        <div className={styles.push}>
          <div className={styles.text}>
            <span id={switch_id} className={styles.switchLabel}>
              {t('reminders.push.switch')}
            </span>
            <p className={styles.help}>{t('reminders.push.help')}</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={push.subscribed}
            aria-labelledby={switch_id}
            disabled={push.busy || status === 'denied' || status === 'unsupported'}
            className={styles.switch}
            onClick={() => {
              void (push.subscribed ? push.unsubscribe() : push.subscribe());
            }}
          >
            <span className={styles.thumb} aria-hidden="true" />
          </button>
        </div>
      ) : null}
      {push.failed ? (
        <p role="alert" className={styles.error}>
          {t('reminders.push.error')}
        </p>
      ) : null}
    </Card>
  );
}
