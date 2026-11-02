import { Badge, Button, SegmentedField, TextField } from '@atria/ui';
import { Controller, useFieldArray, useWatch, type Control } from 'react-hook-form';
import { formatDate, formatMoney } from '../../../shared/format/intl';
import { FormDate } from '../../../shared/forms/form-fields';
import { useT } from '../../../shared/i18n/i18n';
import { usePreferences } from '../../../shared/preferences/preferences-context';
import {
  emptyPayrollLoan,
  formInstallmentsTotal,
  installmentsTotal,
  type PayrollLoan,
  type PayrollLoanFormItem,
} from '../hooks/use-payroll-loans';
import styles from './finance.module.css';
import { MoneyAmount } from './money-amount';
import { MoneyField } from './money-field';
import { DataCard, Facts } from './record-card';

export interface PayrollLoansFormShape {
  payroll_loans: PayrollLoanFormItem[];
}

export interface PayrollLoansFieldProps<T extends PayrollLoansFormShape> {
  control: Control<T>;
  currency: string;
  /** Nomes dos descontos da entrada, aparados e em minúsculas, para avisar do desconto em dobro. */
  adjustment_names: readonly string[];
}

/** Editor dos consignados da entrada: lista, total das parcelas e aviso de desconto em dobro (RF-11). */
export function PayrollLoansField<T extends PayrollLoansFormShape>({
  control,
  currency,
  adjustment_names,
}: PayrollLoansFieldProps<T>) {
  const t = useT();
  const { locale } = usePreferences();
  const shaped = control as unknown as Control<PayrollLoansFormShape>;
  const { fields, append, remove } = useFieldArray({ control: shaped, name: 'payroll_loans' });
  const values = useWatch({ control: shaped, name: 'payroll_loans' });

  return (
    <fieldset className={styles.adjustments}>
      <legend>{t('finance.payroll_loans.title')}</legend>
      <p className={styles.cardHelp}>{t('finance.payroll_loans.help')}</p>
      {fields.length === 0 ? (
        <p className={styles.cardHelp}>{t('finance.payroll_loans.empty')}</p>
      ) : null}
      {fields.map((field, index) => {
        const current = values[index] ?? field;
        const legend = t('finance.payroll_loans.item', { number: index + 1 });
        const prefix = `payroll_loans.${String(index)}` as `payroll_loans.${number}`;
        const duplicated = adjustment_names.includes(current.name.trim().toLocaleLowerCase());
        return (
          <fieldset key={field.id} className={styles.adjustmentItem}>
            <legend>{legend}</legend>
            <div data-span="full">
              <Controller
                control={shaped}
                name={`${prefix}.name`}
                render={({ field: input, fieldState }) => (
                  <TextField
                    label={t('finance.payroll_loans.name')}
                    autoComplete="off"
                    maxLength={60}
                    name={input.name}
                    value={input.value}
                    onChange={input.onChange}
                    onBlur={input.onBlur}
                    {...(fieldState.error?.message ? { error: t(fieldState.error.message) } : {})}
                  />
                )}
              />
            </div>
            <Controller
              control={shaped}
              name={`${prefix}.contract_number`}
              render={({ field: input }) => (
                <TextField
                  label={t('finance.payroll_loans.contract_number')}
                  autoComplete="off"
                  maxLength={40}
                  name={input.name}
                  value={input.value}
                  onChange={input.onChange}
                  onBlur={input.onBlur}
                />
              )}
            />
            <MoneyField
              control={shaped}
              name={`${prefix}.installment_amount`}
              label={t('finance.payroll_loans.installment_amount')}
            />
            <div data-span="full">
              <Controller
                control={shaped}
                name={`${prefix}.term`}
                render={({ field: input }) => (
                  <SegmentedField
                    label={t('finance.payroll_loans.term')}
                    name={input.name}
                    value={input.value}
                    onChange={input.onChange}
                    onBlur={input.onBlur}
                    options={[
                      {
                        value: 'installments',
                        label: t('finance.payroll_loans.term_installments'),
                      },
                      { value: 'end_date', label: t('finance.payroll_loans.term_end_date') },
                    ]}
                  />
                )}
              />
            </div>
            {current.term === 'end_date' ? (
              <FormDate
                control={shaped}
                name={`${prefix}.ends_on`}
                label={t('finance.payroll_loans.ends_on')}
              />
            ) : (
              <>
                <Controller
                  control={shaped}
                  name={`${prefix}.current_installment`}
                  render={({ field: input, fieldState }) => (
                    <TextField
                      label={t('finance.payroll_loans.current_installment')}
                      inputMode="numeric"
                      autoComplete="off"
                      name={input.name}
                      value={input.value}
                      onChange={input.onChange}
                      onBlur={input.onBlur}
                      {...(fieldState.error?.message ? { error: t(fieldState.error.message) } : {})}
                    />
                  )}
                />
                <Controller
                  control={shaped}
                  name={`${prefix}.total_installments`}
                  render={({ field: input, fieldState }) => (
                    <TextField
                      label={t('finance.payroll_loans.total_installments')}
                      inputMode="numeric"
                      autoComplete="off"
                      name={input.name}
                      value={input.value}
                      onChange={input.onChange}
                      onBlur={input.onBlur}
                      {...(fieldState.error?.message ? { error: t(fieldState.error.message) } : {})}
                    />
                  )}
                />
              </>
            )}
            {duplicated ? (
              <p className={styles.notice} data-span="full">
                {t('finance.payroll_loans.duplicate', { name: current.name.trim() })}
              </p>
            ) : null}
            <div className={styles.adjustmentRemove} data-span="full">
              <Button
                type="button"
                variant="muted"
                aria-label={t('finance.payroll_loans.remove_label', {
                  name: current.name.trim() || legend,
                })}
                onClick={() => {
                  remove(index);
                }}
              >
                {t('finance.payroll_loans.remove')}
              </Button>
            </div>
          </fieldset>
        );
      })}
      {values.length > 0 ? (
        <p role="status" className={styles.cardHelp}>
          {t('finance.payroll_loans.total', {
            value: formatMoney(formInstallmentsTotal(values), currency, locale),
          })}
        </p>
      ) : null}
      <div>
        <Button
          type="button"
          onClick={() => {
            append(emptyPayrollLoan());
          }}
        >
          {t('finance.payroll_loans.add')}
        </Button>
      </div>
    </fieldset>
  );
}

export interface PayrollLoansCardProps {
  loans: readonly PayrollLoan[];
  currency: string;
  /** A entrada do período já foi liquidada, e as parcelas junto com ela. */
  settled: boolean;
}

/**
 * Os consignados de uma entrada ou recorrência, só de leitura, nos detalhes (RF-12, CT-09). O
 * encerrado fica em tom neutro e fora do total ([project/frontend-14], CB-01).
 */
export function PayrollLoansCard({ loans, currency, settled }: PayrollLoansCardProps) {
  const t = useT();
  const { locale } = usePreferences();
  return (
    <DataCard title={t('finance.payroll_loans.title')}>
      {settled ? (
        <p className={styles.cardHelp}>{t('finance.payroll_loans.settled_together')}</p>
      ) : null}
      <ul aria-label={t('finance.payroll_loans.list_label')} className={styles.list}>
        {loans.map((loan) => {
          const term = [
            loan.contract_number
              ? t('finance.payroll_loans.contract', { number: loan.contract_number })
              : null,
            loan.current_installment != null && loan.total_installments != null
              ? t('finance.payroll_loans.next_installment', {
                  current: loan.current_installment,
                  total: loan.total_installments,
                })
              : null,
          ].filter(Boolean);
          const end = [
            loan.last_installment_on
              ? t('finance.payroll_loans.last_installment', {
                  date: formatDate(loan.last_installment_on, locale, 'UTC'),
                })
              : null,
            t('finance.payroll_loans.remaining', { count: loan.remaining_installments }),
          ].filter(Boolean);
          return (
            <li key={loan.id} className={styles.row}>
              <div className={styles.rowText}>
                <strong>{loan.name}</strong>
                {term.length > 0 ? (
                  <span className={styles.breakdownHint}>{term.join(' · ')}</span>
                ) : null}
                <span className={styles.breakdownHint}>{end.join(' · ')}</span>
              </div>
              <div className={styles.rowMeta}>
                <MoneyAmount
                  amount={loan.installment_amount}
                  currency={currency}
                  kind="expense"
                  className={styles.rowEnd}
                />
                {loan.status === 'ended' ? (
                  <Badge tone="neutral">{t('finance.payroll_loans.ended')}</Badge>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
      <Facts
        items={[
          {
            label: t('finance.payroll_loans.total_label'),
            value: (
              <span className={styles.num}>
                {formatMoney(installmentsTotal(loans), currency, locale)}
              </span>
            ),
          },
        ]}
      />
    </DataCard>
  );
}
