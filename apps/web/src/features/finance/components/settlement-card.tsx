import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@atria/ui';
import { useId, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { formatDate, formatMoney } from '../../../shared/format/intl';
import { FormDate } from '../../../shared/forms/form-fields';
import { useT } from '../../../shared/i18n/i18n';
import { usePreferences } from '../../../shared/preferences/preferences-context';
import type { TransactionKind } from '../hooks/finance-cache';
import {
  previewErrorKey,
  useSettlementPreview,
  type AdjustmentDto,
  type AdjustmentInput,
} from '../hooks/use-transactions';
import { adjustments_schema, fromAdjustments, toAdjustments } from '../lib/adjustment-form';
import type { Schemas } from '@atria/contracts';
import { AdjustmentsBreakdown, breakdownItems } from './adjustments-breakdown';
import { AdjustmentsField } from './adjustments-field';
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
  adjustments: adjustments_schema,
});

type SettleValues = z.input<typeof settle_schema>;

export interface SettlementValues {
  settled_amount: number;
  settled_at: string;
  /** Os itens do formulário; ausente quando a movimentação não tem e não ganhou itens. */
  adjustments?: AdjustmentInput[];
}

export interface SettlementCardProps {
  kind: TransactionKind;
  currency: string;
  /** Prevista: o formulário vem com o valor previsto e hoje; liquidada: os dados efetivos. */
  expected_amount: number;
  /** Bruto e itens previstos: com itens, a liquidação é pelo líquido, com a prévia do servidor. */
  gross_amount: number;
  adjustments: readonly AdjustmentDto[];
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
  gross_amount,
  adjustments,
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
    defaultValues: {
      settled_amount: expected_amount,
      settled_at: today,
      adjustments: fromAdjustments(adjustments, locale),
    },
  });
  const [editing, setEditing] = useState(false);
  const preview_id = useId();
  const editor_id = useId();
  const settled_amount = useWatch({ control, name: 'settled_amount' });
  const watched = useWatch({ control, name: 'adjustments' });
  const items = toAdjustments(watched);
  // Prévia calculada pelo servidor (decisão 13), só com itens válidos e o líquido informado.
  const preview_input =
    watched.length > 0 && settled_amount != null && items
      ? { settled_amount, adjustments: items, expected_gross_amount: gross_amount }
      : null;
  const preview = useSettlementPreview(settled ? null : preview_input);

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
      {watched.length > 0 ? (
        <p className={styles.cardHelp}>{t('finance.settlement.net_help')}</p>
      ) : null}
      <form
        noValidate
        className={styles.settleForm}
        onSubmit={(event) => {
          void handleSubmit((values) => {
            onSettle({
              settled_amount: values.settled_amount ?? 0,
              settled_at: values.settled_at,
              ...(values.adjustments.length > 0 || adjustments.length > 0
                ? { adjustments: toAdjustments(values.adjustments) ?? [] }
                : {}),
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
        {watched.length > 0 ? (
          <section
            className={styles.settlePreview}
            data-span="full"
            aria-live="polite"
            aria-labelledby={preview_id}
          >
            <h3 id={preview_id}>{t('finance.settlement.preview')}</h3>
            {preview_input === null ? (
              <p className={styles.cardHelp}>{t('finance.settlement.preview_incomplete')}</p>
            ) : preview.error ? (
              <p role="alert" className={styles.formError}>
                {t(previewErrorKey(preview.error))}
              </p>
            ) : preview.data ? (
              <AdjustmentsBreakdown
                currency={currency}
                gross_amount={preview.data.gross_amount}
                items={breakdownItems(preview.data.adjustments)}
                net_amount={preview.data.net_amount}
                net_label={t('finance.settlement.net_informed')}
              />
            ) : (
              <p className={styles.cardHelp}>{t('finance.settlement.preview_loading')}</p>
            )}
          </section>
        ) : null}
        <div data-span="full">
          <Button
            type="button"
            variant="muted"
            aria-expanded={editing}
            aria-controls={editor_id}
            onClick={() => {
              setEditing((open) => !open);
            }}
          >
            {t('finance.settlement.edit_adjustments')}
          </Button>
        </div>
        {editing ? (
          <div id={editor_id} data-span="full">
            <AdjustmentsField
              control={control}
              base_help={t('finance.settlement.base_scaled_help')}
              linked_help={t('finance.settlement.base_linked_help')}
            />
          </div>
        ) : null}
        <div className={styles.settleActions} data-span="full">
          <Button type="submit" variant="success" loading={pending}>
            {t('finance.settlement.submit')}
          </Button>
        </div>
      </form>
    </DataCard>
  );
}
