import { useMemo } from 'react';
import { usePreferences } from '../../shared/preferences/preferences-context';

interface SessionLike {
  pages_read: number;
}

/**
 * Percentual de 0 a 100 com uma casa decimal: páginas lidas sobre o total, limitado a 100% (RN-14, CB-05).
 * Sem total de páginas não há progresso.
 */
export function bookProgressPercent(
  page_count: number | null | undefined,
  pages_read: number,
): number | null {
  if (page_count === null || page_count === undefined || page_count <= 0) return null;
  const raw = (Math.max(pages_read, 0) / page_count) * 100;
  return Math.min(100, Math.round(raw * 10) / 10);
}

export function sumPagesRead(sessions: readonly SessionLike[]): number {
  return sessions.reduce((total, session) => total + session.pages_read, 0);
}

/** `27,5%`, `100%`: até uma casa decimal, no idioma de quem usa. */
export function formatBookPercent(percent: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'percent',
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(percent / 100);
}

export interface BookProgress {
  percent: number | null;
  pages_read: number;
  /** Percentual já formatado, ou `null` sem total de páginas. */
  label: string | null;
}

/** Soma as sessões registradas sobre o total do livro. */
export function useBookProgress(
  page_count: number | null | undefined,
  sessions: readonly SessionLike[],
): BookProgress {
  const { locale } = usePreferences();
  return useMemo(() => {
    const pages_read = sumPagesRead(sessions);
    const percent = bookProgressPercent(page_count, pages_read);
    return {
      percent,
      pages_read,
      label: percent === null ? null : formatBookPercent(percent, locale),
    };
  }, [page_count, sessions, locale]);
}
