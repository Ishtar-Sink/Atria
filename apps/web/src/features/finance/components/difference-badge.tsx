import { Badge } from '@atria/ui';
import { formatMoney } from '../../../shared/format/intl';
import { registerMessages, useT } from '../../../shared/i18n/i18n';
import { usePreferences } from '../../../shared/preferences/preferences-context';
import type { Schemas } from '@atria/contracts';
import messages from '../i18n/pt-br.json';
import type { TransactionKind } from '../hooks/finance-cache';

registerMessages('finance', messages);

export interface DifferenceBadgeProps {
  kind: TransactionKind;
  difference_kind: Schemas['DifferenceKindDto'] | null | undefined;
  difference_amount: number | null | undefined;
  currency: string;
}

/** Chave do texto da diferença (PD-54); `null` sem diferença. */
export function differenceKey(
  kind: TransactionKind,
  difference_kind: Schemas['DifferenceKindDto'] | null | undefined,
): string | null {
  if (!difference_kind) return null;
  if (difference_kind === 'saving') return 'finance.difference.saving';
  if (difference_kind === 'gain') return 'finance.difference.gain';
  return kind === 'expense' ? 'finance.difference.expense_loss' : 'finance.difference.income_loss';
}

/** Economia e ganho em verde; perda em âmbar, nunca em vermelho ([project/frontend-14]). */
export function DifferenceBadge({
  kind,
  difference_kind,
  difference_amount,
  currency,
}: DifferenceBadgeProps) {
  const t = useT();
  const { locale } = usePreferences();
  const key = differenceKey(kind, difference_kind);
  if (key === null || !difference_amount) return null;
  const value = formatMoney(Math.abs(difference_amount), currency, locale);
  return (
    <Badge tone={difference_kind === 'loss' ? 'warning' : 'success'}>{t(key, { value })}</Badge>
  );
}
