import { Button } from '@atria/ui';
import { formatDate } from '../../../shared/format/intl';
import { registerMessages, useT } from '../../../shared/i18n/i18n';
import { usePreferences } from '../../../shared/preferences/preferences-context';
import messages from '../i18n/pt-br.json';
import styles from './complete-button.module.css';

registerMessages('tasks', messages);

/** Pontual, a ocorrência de hoje ou a ocorrência de um dos próximos dias (`YYYY-MM-DD`). */
export type CompleteWhen = 'single' | 'today' | { date: string };

export interface CompleteButtonProps {
  title: string;
  done: boolean;
  when: CompleteWhen;
  onToggle: () => void;
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

/** O botão de concluir das listas: só o check, com o nome que diz a ação e o título (PD-04, PD-33). */
export function CompleteButton({ title, done, when, onToggle }: CompleteButtonProps) {
  const t = useT();
  const { locale } = usePreferences();
  const action = done ? 'reopen' : 'complete';
  const name =
    when === 'single'
      ? t(`tasks.completion.${action}`, { title })
      : when === 'today'
        ? t(`tasks.completion.${action}_today`, { title })
        : t(`tasks.completion.${action}_on`, { title, date: formatDate(when.date, locale, 'UTC') });
  return (
    <Button
      variant="success"
      className={styles.root}
      aria-pressed={done}
      aria-label={name}
      title={name}
      onClick={onToggle}
    >
      <CheckIcon />
    </Button>
  );
}
