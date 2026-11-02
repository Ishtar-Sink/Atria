import { Button, Checkbox, SegmentedField, TextField } from '@atria/ui';
import type { ReactNode } from 'react';
import { Controller, useFieldArray, useWatch, type Control } from 'react-hook-form';
import { useT } from '../../../shared/i18n/i18n';
import { emptyAdjustment, MAX_ADJUSTMENTS, type AdjustmentFormItem } from '../lib/adjustment-form';
import styles from './finance.module.css';
import { MoneyField } from './money-field';

export interface AdjustmentsFormShape {
  adjustments: AdjustmentFormItem[];
}

export interface AdjustmentsFieldProps<T extends AdjustmentsFormShape> {
  control: Control<T>;
  /** Texto abaixo do campo da base digitada. */
  base_help?: string;
  /** Conteúdo no fim do grupo, como o líquido ao vivo do formulário. */
  children?: ReactNode;
}

/** Lista editável de descontos e acréscimos, fixos ou percentuais (RF-03 a RF-06, CB-08). */
export function AdjustmentsField<T extends AdjustmentsFormShape>({
  control,
  base_help,
  children,
}: AdjustmentsFieldProps<T>) {
  const t = useT();
  const shaped = control as unknown as Control<AdjustmentsFormShape>;
  const { fields, append, remove } = useFieldArray({ control: shaped, name: 'adjustments' });
  const values = useWatch({ control: shaped, name: 'adjustments' });
  const full = fields.length >= MAX_ADJUSTMENTS;

  return (
    <fieldset className={styles.adjustments}>
      <legend>{t('finance.adjustments.title')}</legend>
      {fields.length > 0 ? (
        <>
          <p className={styles.cardHelp}>{t('finance.adjustments.gross_help')}</p>
          <p className={styles.cardHelp}>{t('finance.adjustments.help')}</p>
        </>
      ) : null}
      {fields.map((field, index) => {
        const current = values[index] ?? field;
        const legend = t('finance.adjustments.item', { number: index + 1 });
        const prefix = `adjustments.${String(index)}` as `adjustments.${number}`;
        return (
          <fieldset key={field.id} className={styles.adjustmentItem}>
            <legend>{legend}</legend>
            <div data-span="full">
              <Controller
                control={shaped}
                name={`${prefix}.name`}
                render={({ field: input, fieldState }) => (
                  <TextField
                    label={t('finance.adjustments.name')}
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
              name={`${prefix}.direction`}
              render={({ field: input }) => (
                <SegmentedField
                  label={t('finance.adjustments.direction')}
                  name={input.name}
                  value={input.value}
                  onChange={input.onChange}
                  onBlur={input.onBlur}
                  options={[
                    { value: 'deduction', label: t('finance.adjustments.deduction') },
                    { value: 'addition', label: t('finance.adjustments.addition') },
                  ]}
                />
              )}
            />
            <Controller
              control={shaped}
              name={`${prefix}.mode`}
              render={({ field: input }) => (
                <SegmentedField
                  label={t('finance.adjustments.mode')}
                  name={input.name}
                  value={input.value}
                  onChange={input.onChange}
                  onBlur={input.onBlur}
                  options={[
                    { value: 'percent', label: t('finance.adjustments.percent') },
                    { value: 'fixed', label: t('finance.adjustments.fixed') },
                  ]}
                />
              )}
            />
            {current.mode === 'fixed' ? (
              <div data-span="full">
                <MoneyField
                  control={shaped}
                  name={`${prefix}.amount`}
                  label={t('finance.adjustments.amount')}
                />
              </div>
            ) : (
              <>
                <Controller
                  control={shaped}
                  name={`${prefix}.rate_text`}
                  render={({ field: input, fieldState }) => (
                    <TextField
                      label={t('finance.adjustments.rate')}
                      inputMode="decimal"
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
                  name={`${prefix}.base_different`}
                  render={({ field: input }) => (
                    <Checkbox
                      label={t('finance.adjustments.base_different')}
                      name={input.name}
                      checked={input.value}
                      onChange={(event) => {
                        input.onChange(event.target.checked);
                      }}
                      onBlur={input.onBlur}
                    />
                  )}
                />
                {current.base_different ? (
                  <div data-span="full">
                    <MoneyField
                      control={shaped}
                      name={`${prefix}.base_amount`}
                      label={t('finance.adjustments.base_amount')}
                    />
                    {base_help ? <p className={styles.cardHelp}>{base_help}</p> : null}
                  </div>
                ) : null}
              </>
            )}
            <div className={styles.adjustmentRemove} data-span="full">
              <Button
                type="button"
                variant="muted"
                aria-label={t('finance.adjustments.remove_label', {
                  name: current.name.trim() || legend,
                })}
                onClick={() => {
                  remove(index);
                }}
              >
                {t('finance.adjustments.remove')}
              </Button>
            </div>
          </fieldset>
        );
      })}
      {children}
      <div>
        <Button
          type="button"
          disabled={full}
          onClick={() => {
            append(emptyAdjustment());
          }}
        >
          {t('finance.adjustments.add')}
        </Button>
      </div>
      {full ? <p className={styles.cardHelp}>{t('finance.adjustments.limit')}</p> : null}
    </fieldset>
  );
}
