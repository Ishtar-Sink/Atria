import { formatMoney } from '../../../shared/format/intl';
import { useT } from '../../../shared/i18n/i18n';
import { usePreferences } from '../../../shared/preferences/preferences-context';
import type { AdjustmentDto } from '../hooks/use-transactions';
import { formatRate, linkedBase } from '../lib/adjustment-form';
import styles from './finance.module.css';

export interface BreakdownItem {
  name: string;
  direction: 'deduction' | 'addition';
  mode: 'fixed' | 'percent';
  rate_bp?: number | null;
  base_amount?: number | null;
  base_items?: readonly number[] | null;
  deduction_amount?: number | null;
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
    // O valor do item já vem com a parcela; a dica mostra a base ligada calculada (RF-07).
    const links = item.base_items ?? [];
    const base =
      links.length > 0 ? linkedBase(gross_amount, items, links) : (item.base_amount ?? null);
    const deduction =
      item.deduction_amount != null ? formatMoney(item.deduction_amount, currency, locale) : null;
    if (base === null) {
      return deduction === null
        ? t('finance.adjustments.on_gross', { rate })
        : t('finance.adjustments.on_gross_less', { rate, deduction });
    }
    const amount = formatMoney(base, currency, locale);
    return deduction === null
      ? t('finance.adjustments.on_base', { rate, base: amount })
      : t('finance.adjustments.on_base_less', { rate, base: amount, deduction });
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
