import { Badge, type BadgeTone } from '@atria/ui';
import { Link } from '@tanstack/react-router';
import { formatDate, formatMoney } from '../../../shared/format/intl';
import { useT } from '../../../shared/i18n/i18n';
import { usePreferences } from '../../../shared/preferences/preferences-context';
import type { ItemStatus, TransactionItem } from '../hooks/finance-cache';
import { listItemHref } from '../hooks/use-transactions';
import { DifferenceBadge } from './difference-badge';
import styles from './finance.module.css';

/** Status nunca em vermelho: prevista e atrasada em âmbar ([project/frontend-14]). */
export const STATUS_TONE: Record<ItemStatus, BadgeTone> = {
  settled: 'success',
  open: 'warning',
  overdue: 'warning',
  forecast: 'info',
};

export interface TransactionRowProps {
  item: TransactionItem;
  account_name?: string | undefined;
  category_name?: string | undefined;
}

export function useTransactionTitle() {
  const t = useT();
  return (item: Pick<TransactionItem, 'description' | 'kind'>) =>
    item.description?.trim() || t(`finance.transactions.no_description_${item.kind}`);
}

/** Linha de movimentação: o valor em cima e os selos embaixo dele (PD-53, PD-54). */
export function TransactionRow({ item, account_name, category_name }: TransactionRowProps) {
  const t = useT();
  const { locale } = usePreferences();
  const title = useTransactionTitle();
  const amount =
    item.status === 'settled' && item.settled_amount != null
      ? item.settled_amount
      : item.expected_amount;
  const subtitle = [
    category_name ?? t('finance.transactions.no_category'),
    account_name,
    formatDate(item.effective_date, locale, 'UTC'),
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <li className={styles.row}>
      <div className={styles.rowText}>
        <Link to={listItemHref(item)} className={styles.rowTitle}>
          {title(item)}
        </Link>
        <span className={styles.rowSub}>{subtitle}</span>
      </div>
      <div className={styles.rowMeta}>
        <span className={styles.rowEnd}>{formatMoney(amount, item.currency, locale)}</span>
        <div className={styles.badges}>
          <Badge tone={STATUS_TONE[item.status]}>{t(`finance.status.${item.status}`)}</Badge>
          {item.recurrence_id ? (
            <Badge tone="info">{t('finance.transactions.recurring')}</Badge>
          ) : null}
          <DifferenceBadge
            kind={item.kind}
            difference_kind={item.difference_kind}
            difference_amount={item.difference_amount}
            currency={item.currency}
          />
        </div>
      </div>
    </li>
  );
}
