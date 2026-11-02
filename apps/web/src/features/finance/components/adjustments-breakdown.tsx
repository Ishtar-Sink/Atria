import { formatMoney } from '../../../shared/format/intl';
import { useT } from '../../../shared/i18n/i18n';
import { usePreferences } from '../../../shared/preferences/preferences-context';
import type { AdjustmentDto } from '../hooks/use-transactions';
import { formatRate } from '../lib/adjustment-form';
import styles from './finance.module.css';

export interface BreakdownItem {
  name: string;
  direction: 'deduction' | 'addition';
  mode: 'fixed' | 'percent';
  rate_bp?: number | null;
  base_amount?: number | null;
  computed_amount: number;
}

export interface AdjustmentsBreakdownProps {
  currency: string;
  gross_amount: number;
  items: readonly BreakdownItem[];
  net_amount: number;
  net_label: string;
}

/** Itens da resposta com o valor calculado, que o servidor sempre devolve. */
export function breakdownItems(items: readonly AdjustmentDto[]): BreakdownItem[] {
  return items.map((item) => ({ ...item, computed_amount: item.computed_amount ?? 0 }));
}

/** Valor do item com o sinal do sentido (U+2212 no desconto), sem cor (RN-07 da SPEC-003). */
export function adjustmentText(
  direction: 'deduction' | 'addition',
  amount: number,
  currency: string,
  locale: string,
): string {
  const sign = direction === 'deduction' ? '−' : '+';
  return `${sign}${formatMoney(Math.abs(amount), currency, locale)}`;
}

/** Bruto, cada item com o valor calculado e o líquido (RF-12). */
export function AdjustmentsBreakdown({
  currency,
  gross_amount,
  items,
  net_amount,
  net_label,
}: AdjustmentsBreakdownProps) {
  const t = useT();
  const { locale } = usePreferences();

  function hint(item: BreakdownItem): string {
    if (item.mode === 'fixed' || item.rate_bp == null) return t('finance.adjustments.fixed_hint');
    const rate = formatRate(item.rate_bp, locale);
    if (item.base_amount == null) return t('finance.adjustments.on_gross', { rate });
    return t('finance.adjustments.on_base', {
      rate,
      base: formatMoney(item.base_amount, currency, locale),
    });
  }

  return (
    <dl className={styles.breakdown}>
      <div className={styles.factRow}>
        <dt>{t('finance.adjustments.gross')}</dt>
        <dd>{formatMoney(gross_amount, currency, locale)}</dd>
      </div>
      {items.map((item, index) => (
        <div key={`${String(index)}-${item.name}`} className={styles.factRow}>
          <dt>
            {item.name}
            <span className={styles.breakdownHint}>{hint(item)}</span>
          </dt>
          <dd>{adjustmentText(item.direction, item.computed_amount, currency, locale)}</dd>
        </div>
      ))}
      <div className={styles.breakdownTotal}>
        <dt>{net_label}</dt>
        <dd>{formatMoney(net_amount, currency, locale)}</dd>
      </div>
    </dl>
  );
}
