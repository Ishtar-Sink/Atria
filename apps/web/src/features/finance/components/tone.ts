import styles from './finance.module.css';

export type ThemeTone = 'primary' | 'accent' | 'success' | 'warning' | 'danger' | 'info';

const TONES: Record<ThemeTone, string | undefined> = {
  primary: styles.tonePrimary,
  accent: styles.toneAccent,
  success: styles.toneSuccess,
  warning: styles.toneWarning,
  danger: styles.toneDanger,
  info: styles.toneInfo,
};

/** Classe do fundo na cor de um token do tema. */
export function toneClass(tone: ThemeTone): string {
  return TONES[tone] ?? '';
}
