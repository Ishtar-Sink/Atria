import { zodResolver } from '@hookform/resolvers/zod';
import { Button, ConfirmDialog } from '@atria/ui';
import { useId, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { formatDate, formatMoney } from '../../../shared/format/intl';
import { FormDate } from '../../../shared/forms/form-fields';
import { useT } from '../../../shared/i18n/i18n';
import { usePreferences } from '../../../shared/preferences/preferences-context';
import type { TransactionKind } from '../hooks/finance-cache';
import { installmentsTotal, type PayrollLoan } from '../hooks/use-payroll-loans';
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
import { MoneyAmount } from './money-amount';
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
  /** Com consignados no período: o valor que caiu na conta (RF-08). */
  account_amount?: number;
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
  /** Parcelas dos consignados do período, já filtradas (RF-08). */
  payroll_loans?: readonly PayrollLoan[];
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
  payroll_loans = [],
  today,
  settled,
  caption,
  pending = false,
  onSettle,
}: SettlementCardProps) {
  const t = useT();
  const { locale } = usePreferences();
  const loans_total = installmentsTotal(payroll_loans);
  // A liquidação abaixo das parcelas, esperando a confirmação.
  const [below, setBelow] = useState<SettlementValues | null>(null);
  const { control, handleSubmit } = useForm<SettleValues>({
    resolver: zodResolver(settle_schema),
    defaultValues: {
      settled_amount: loans_total > 0 ? expected_amount - loans_total : expected_amount,
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
  // Com consignados, o líquido da entrada é o que caiu na conta mais as parcelas (RN-02).
  const net_amount = settled_amount != null ? settled_amount + loans_total : null;
  // Prévia calculada pelo servidor (decisão 13), só com itens válidos e o líquido informado.
  const preview_input =
    watched.length > 0 && net_amount != null && items
      ? { settled_amount: net_amount, adjustments: items, expected_gross_amount: gross_amount }
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
      {loans_total > 0 ? (
        <p className={styles.cardHelp}>{t('finance.settlement.account_help')}</p>
      ) : watched.length > 0 ? (
        <p className={styles.cardHelp}>{t('finance.settlement.net_help')}</p>
      ) : null}
      <form
        noValidate
        className={styles.settleForm}
        onSubmit={(event) => {
          void handleSubmit((values) => {
            const informed = values.settled_amount ?? 0;
            const settlement: SettlementValues = {
              settled_amount: informed + loans_total,
              ...(loans_total > 0 ? { account_amount: informed } : {}),
              settled_at: values.settled_at,
              ...(values.adjustments.length > 0 || adjustments.length > 0
                ? { adjustments: toAdjustments(values.adjustments) ?? [] }
                : {}),
            };
            if (loans_total > 0 && informed < loans_total) {
              setBelow(settlement);
              return;
            }
            onSettle(settlement);
          })(event);
        }}
      >
        <MoneyField
          control={control}
          name="settled_amount"
          label={t(
            loans_total > 0 ? 'finance.settlement.account_amount' : 'finance.settlement.amount',
          )}
        />
        <FormDate control={control} name="settled_at" label={t('finance.settlement.date')} />
        {watched.length > 0 || loans_total > 0 ? (
          <section
            className={styles.settlePreview}
            data-span="full"
            aria-live="polite"
            aria-labelledby={preview_id}
          >
            <h3 id={preview_id}>{t('finance.settlement.preview')}</h3>
            {loans_total > 0 ? (
              <>
                <ul aria-label={t('finance.settlement.loans_label')} className={styles.breakdown}>
                  {payroll_loans.map((loan) => (
                    <li key={loan.id} className={styles.factRow}>
                      <span>{loan.name}</span>
                      <MoneyAmount
                        amount={loan.installment_amount}
                        currency={currency}
                        kind="expense"
                      />
                    </li>
                  ))}
                </ul>
                <Facts
                  items={[
                    {
                      label: t('finance.settlement.account_row'),
                      value: (
                        <span className={styles.num}>
                          {formatMoney(settled_amount ?? 0, currency, locale)}
                        </span>
                      ),
                    },
                    {
                      label: t('finance.settlement.entry_net'),
                      value: (
                        <span className={styles.num}>
                          {formatMoney(net_amount ?? 0, currency, locale)}
                        </span>
                      ),
                    },
                  ]}
                />
              </>
            ) : null}
            {watched.length === 0 ? null : preview_input === null ? (
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
                net_label={t(
                  loans_total > 0
                    ? 'finance.settlement.entry_net'
                    : 'finance.settlement.net_informed',
                )}
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
      {/* Valor abaixo das parcelas é aceito; o aviso só pega erro de digitação. */}
      <ConfirmDialog
        open={below !== null}
        title={t('finance.settlement.below_loans_title')}
        description={t('finance.settlement.below_loans_description', {
          account: formatMoney(below?.account_amount ?? 0, currency, locale),
          installments: formatMoney(loans_total, currency, locale),
          net: formatMoney(below?.settled_amount ?? 0, currency, locale),
        })}
        confirmLabel={t('finance.settlement.below_loans_confirm')}
        cancelLabel={t('common.cancel')}
        onConfirm={() => {
          if (below) onSettle(below);
          setBelow(null);
        }}
        onCancel={() => {
          setBelow(null);
        }}
      />
    </DataCard>
  );
}
