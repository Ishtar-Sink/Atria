import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@atria/ui';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { formatDate, formatMoney } from '../../../shared/format/intl';
import { FormDate } from '../../../shared/forms/form-fields';
import { useT } from '../../../shared/i18n/i18n';
import { usePreferences } from '../../../shared/preferences/preferences-context';
import type { TransactionKind } from '../hooks/finance-cache';
import type { Schemas } from '@atria/contracts';
import { DifferenceBadge } from './difference-badge';
import styles from './finance.module.css';
import { MoneyField } from './money-field';
import { DataCard, Facts } from './record-card';

const settle_schema = z.object({
  settled_amount: z
    .number({ message: 'finance.transaction_form.amount_invalid' })
    .int()
    .min(0, 'finance.transaction_form.amount_invalid')
    .nullable()
    .refine((value) => value !== null, 'finance.transaction_form.amount_invalid'),
  settled_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'finance.transaction_form.date_required'),
});

type SettleValues = z.input<typeof settle_schema>;

export interface SettlementValues {
  settled_amount: number;
  settled_at: string;
}

export interface SettlementCardProps {
  kind: TransactionKind;
  currency: string;
  /** Prevista: o formulário vem com o valor previsto e hoje; liquidada: os dados efetivos. */
  expected_amount: number;
  today: string;
  settled?: {
    settled_amount: number;
    settled_at: string;
    difference_kind: Schemas['DifferenceKindDto'] | null | undefined;
    difference_amount: number | null | undefined;
  } | null;
  /** Texto acima do formulário (ex.: a data da ocorrência aberta). */
  caption?: string;
  pending?: boolean;
  onSettle: (values: SettlementValues) => void;
}

/** Liquidação num cartão abaixo dos dados, no lugar de uma rota própria (PD-59, RF-32). */
export function SettlementCard({
  kind,
  currency,
  expected_amount,
  today,
  settled,
  caption,
  pending = false,
  onSettle,
}: SettlementCardProps) {
  const t = useT();
  const { locale } = usePreferences();
  const { control, handleSubmit } = useForm<SettleValues>({
    resolver: zodResolver(settle_schema),
    defaultValues: { settled_amount: expected_amount, settled_at: today },
  });

  if (settled) {
    return (
      <DataCard title={t('finance.settlement.title')}>
        <div className={styles.settledFacts}>
          <Facts
            items={[
              {
                label: t('finance.settlement.settled_amount'),
                value: (
                  <span className={styles.num}>
                    {formatMoney(settled.settled_amount, currency, locale)}
                  </span>
                ),
              },
              {
                label: t('finance.settlement.settled_at'),
                value: formatDate(settled.settled_at, locale, 'UTC'),
              },
            ]}
          />
          <div>
            {settled.difference_kind ? (
              <DifferenceBadge
                kind={kind}
                difference_kind={settled.difference_kind}
                difference_amount={settled.difference_amount}
                currency={currency}
              />
            ) : (
              <p className={styles.cardHelp}>{t('finance.settlement.exact')}</p>
            )}
          </div>
        </div>
      </DataCard>
    );
  }

  return (
    <DataCard title={t('finance.settlement.title')}>
      <p className={styles.cardHelp}>{caption ?? t('finance.settlement.description')}</p>
      <form
        noValidate
        className={styles.settleForm}
        onSubmit={(event) => {
          void handleSubmit((values) => {
            onSettle({
              settled_amount: values.settled_amount ?? 0,
              settled_at: values.settled_at,
            });
          })(event);
        }}
      >
        <MoneyField
          control={control}
          name="settled_amount"
          label={t('finance.settlement.amount')}
        />
        <FormDate control={control} name="settled_at" label={t('finance.settlement.date')} />
        <div className={styles.settleActions} data-span="full">
          <Button type="submit" variant="success" loading={pending}>
            {t('finance.settlement.submit')}
          </Button>
        </div>
      </form>
    </DataCard>
  );
}
