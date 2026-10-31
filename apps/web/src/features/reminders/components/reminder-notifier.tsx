import { useCallback } from 'react';
import { registerMessages } from '../../../shared/i18n/i18n';
import { usePreferences } from '../../../shared/preferences/preferences-context';
import { pushToast } from '../../../shared/toast/toast-store';
import { useReminderScheduler, type UpcomingFire } from '../hooks/use-reminder-scheduler';
import messages from '../i18n/pt-br.json';

registerMessages('reminders', messages);

/**
 * Sem interface própria: liga o agendador e, quando o navegador não pode notificar, mostra o
 * lembrete como aviso dentro do app, que a região polida do app anuncia (CB-14).
 * A TASK-35 o monta uma vez no layout autenticado.
 */
export function ReminderNotifier() {
  const { locale, time_zone } = usePreferences();

  const showInApp = useCallback(
    (fire: UpcomingFire) => {
      const time = new Intl.DateTimeFormat(locale, {
        timeStyle: 'short',
        timeZone: time_zone,
      }).format(new Date(fire.fire_at));
      pushToast({
        tone: 'info',
        message_key: 'reminders.notification.in_app_at',
        params: { title: fire.title, time },
      });
    },
    [locale, time_zone],
  );

  useReminderScheduler({ showInApp });
  return null;
}
