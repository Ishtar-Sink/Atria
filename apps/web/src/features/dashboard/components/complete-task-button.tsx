import { Button } from '@atria/ui';
import { useT } from '../../../shared/i18n/i18n';
import styles from './dashboard.module.css';

export interface CompleteTaskButtonProps {
  title: string;
  /** Ocorrência de hoje de uma recorrente: o nome diz "Concluir hoje". */
  recurring: boolean;
  onComplete: () => void;
}

/** Botão só com o ícone de check, na variação `success` (PD-04, PD-33). */
export function CompleteTaskButton({ title, recurring, onComplete }: CompleteTaskButtonProps) {
  const t = useT();
  const label = t(recurring ? 'dashboard.today.complete_today' : 'dashboard.today.complete', {
    title,
  });
  return (
    <Button
      variant="success"
      className={styles.completeButton}
      aria-label={label}
      title={label}
      onClick={onComplete}
    >
      <svg
        viewBox="0 0 24 24"
        width="18"
        height="18"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
      >
        <path d="M5 12.5l4.5 4.5L19 7.5" />
      </svg>
    </Button>
  );
}
