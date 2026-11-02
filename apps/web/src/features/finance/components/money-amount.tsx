import { formatMoney } from '../../../shared/format/intl';
import { usePreferences } from '../../../shared/preferences/preferences-context';
import styles from './finance.module.css';

export type MoneyKind = 'income' | 'expense' | 'balance';

export interface MoneyAmountProps {
  amount: number;
  currency: string;
  kind: MoneyKind;
  className?: string;
}

type Tone = 'positive' | 'negative';

/** Sinal de menos tipográfico (U+2212): o hífen do `Intl` não é usado. */
const MINUS = '−';

/**
 * Texto e tom de um valor: o sinal vem do tipo, nunca do número guardado (RN-06). Entrada leva
 * "+" em verde, saída "−" na cor do texto e saldo verde, âmbar com "−" ou, zerado, sem cor (CB-07).
 */
export function signedMoney(
  amount: number,
  currency: string,
  kind: MoneyKind,
  locale: string,
): { text: string; tone: Tone | null } {
  const value = formatMoney(Math.abs(amount), currency, locale);
  if (kind === 'income') return { text: `+${value}`, tone: 'positive' };
  if (kind === 'expense') return { text: `${MINUS}${value}`, tone: null };
  if (amount > 0) return { text: value, tone: 'positive' };
  if (amount < 0) return { text: `${MINUS}${value}`, tone: 'negative' };
  return { text: value, tone: null };
}

/** Valor com o sinal e a cor do tipo (RF-11, RF-12); o sinal fica em texto ao lado da cor (RNF-03). */
export function MoneyAmount({ amount, currency, kind, className }: MoneyAmountProps) {
  const { locale } = usePreferences();
  const { text, tone } = signedMoney(amount, currency, kind, locale);
  return (
    <span
      className={[styles.amount, tone ? styles[tone] : undefined, className]
        .filter(Boolean)
        .join(' ')}
      data-kind={kind}
    >
      {text}
    </span>
  );
}
