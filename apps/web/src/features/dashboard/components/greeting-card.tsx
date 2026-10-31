import { Button, Card } from '@atria/ui';
import { useRouter } from '@tanstack/react-router';
import { useT } from '../../../shared/i18n/i18n';
import { usePreferences } from '../../../shared/preferences/preferences-context';
import { localHour } from '../hooks/dates';
import styles from './dashboard.module.css';

export interface GreetingCardProps {
  /** `display_name` de `GET /me`; a primeira palavra vira o cumprimento. */
  name?: string | null;
  /** Instante de referência; vem do relógio da página. */
  now?: Date;
}

export function GreetingCard({ name, now = new Date() }: GreetingCardProps) {
  const t = useT();
  const router = useRouter();
  const { locale, time_zone } = usePreferences();
  const hour = localHour(now, time_zone);
  const part = t(
    hour < 12
      ? 'dashboard.greeting.morning'
      : hour < 18
        ? 'dashboard.greeting.afternoon'
        : 'dashboard.greeting.night',
  );
  const first = name?.trim().split(/\s+/)[0] ?? '';
  const title = first === '' ? part : t('dashboard.greeting.with_name', { part, name: first });
  const day = new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: time_zone,
  }).format(now);

  return (
    <Card as="section" aria-label={t('dashboard.greeting.label')} className={styles.hello}>
      <div>
        <p className={styles.helloTitle}>{title}</p>
        <p className={styles.helloDate}>{day}</p>
      </div>
      <div className={styles.helloAsk}>
        <p>{t('dashboard.greeting.ask')}</p>
        <Button
          variant="primary"
          onClick={() => {
            router.history.push('/journal/new');
          }}
        >
          {t('dashboard.greeting.write')}
        </Button>
      </div>
    </Card>
  );
}
