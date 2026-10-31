import { ProgressBar } from '@atria/ui';
import { registerMessages, useT } from '../../shared/i18n/i18n';
import { formatNumber } from '../../shared/format/intl';
import { usePreferences } from '../../shared/preferences/preferences-context';
import messages from './i18n/pt-br.json';
import { formatBookPercent } from './use-book-progress';
import styles from './library.module.css';

registerMessages('library', messages);

export interface BookProgressBarProps {
  /** Nome acessível da barra (RF-49). */
  label: string;
  percent: number | null;
  pages_read: number;
  page_count: number | null | undefined;
  /** Na estante só a barra e o percentual; na tela do livro, também "50 de 200 páginas". */
  detailed?: boolean;
}

/** Barra de progresso do livro com rótulo acessível, limitada a 100% (RF-49, RN-14). */
export function BookProgressBar({
  label,
  percent,
  pages_read,
  page_count,
  detailed = false,
}: BookProgressBarProps) {
  const t = useT();
  const { locale } = usePreferences();
  if (percent === null) {
    return detailed ? <p className={styles.muted}>{t('library.book.progress_unknown')}</p> : null;
  }
  return (
    <div className={styles.progress}>
      <ProgressBar label={label} value={percent} />
      <p className={styles.progressText}>
        <span className={styles.num}>{formatBookPercent(percent, locale)}</span>
        {detailed && page_count ? (
          <span className={styles.muted}>
            {' · '}
            {t('library.book.progress_text', {
              read: formatNumber(Math.min(pages_read, page_count), locale),
              total: formatNumber(page_count, locale),
            })}
          </span>
        ) : null}
      </p>
    </div>
  );
}
