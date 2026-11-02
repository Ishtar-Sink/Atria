import { Button, Checkbox, SegmentedField, TextField } from '@atria/ui';
import { useState, type ReactNode } from 'react';
import { Controller, useFieldArray, useWatch, type Control } from 'react-hook-form';
import { useT } from '../../../shared/i18n/i18n';
import { usePreferences } from '../../../shared/preferences/preferences-context';
import {
  dependentsOf,
  emptyAdjustment,
  MAX_ADJUSTMENTS,
  removeAdjustment,
  type AdjustmentFormItem,
} from '../lib/adjustment-form';
import styles from './finance.module.css';
import { MoneyField } from './money-field';

export interface AdjustmentsFormShape {
  adjustments: AdjustmentFormItem[];
}

export interface AdjustmentsFieldProps<T extends AdjustmentsFormShape> {
  control: Control<T>;
  /** Texto abaixo do campo da base digitada. */
  base_help?: string;
  /** Texto abaixo dos itens da base ligada, como o aviso da liquidação. */
  linked_help?: string;
  /** Conteúdo no fim do grupo, como o líquido ao vivo do formulário. */
  children?: ReactNode;
}

/** Lista editável de descontos e acréscimos, fixos ou percentuais (RF-03 a RF-06, CB-08). */
export function AdjustmentsField<T extends AdjustmentsFormShape>({
  control,
  base_help,
  linked_help,
  children,
}: AdjustmentsFieldProps<T>) {
  const t = useT();
  const { locale } = usePreferences();
  const shaped = control as unknown as Control<AdjustmentsFormShape>;
  const { fields, append, replace } = useFieldArray({ control: shaped, name: 'adjustments' });
  const values = useWatch({ control: shaped, name: 'adjustments' });
  const [blocked, setBlocked] = useState<number | null>(null);
  const full = fields.length >= MAX_ADJUSTMENTS;
  const labelOf = (index: number) =>
    values[index]?.name.trim() || t('finance.adjustments.item', { number: index + 1 });

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
                    <Controller
                      control={shaped}
                      name={`${prefix}.base_source`}
                      render={({ field: input }) => (
                        <SegmentedField
                          label={t('finance.adjustments.base_source')}
                          name={input.name}
                          value={input.value}
                          onChange={input.onChange}
                          onBlur={input.onBlur}
                          options={[
                            { value: 'amount', label: t('finance.adjustments.base_source_amount') },
                            { value: 'items', label: t('finance.adjustments.base_source_items') },
                          ]}
                        />
                      )}
                    />
                  </div>
                ) : null}
                {current.base_different && current.base_source === 'amount' ? (
                  <div data-span="full">
                    <MoneyField
                      control={shaped}
                      name={`${prefix}.base_amount`}
                      label={t('finance.adjustments.base_amount')}
                    />
                    {base_help ? <p className={styles.cardHelp}>{base_help}</p> : null}
                  </div>
                ) : null}
                {current.base_different && current.base_source === 'items' ? (
                  <Controller
                    control={shaped}
                    name={`${prefix}.base_items`}
                    render={({ field: input, fieldState }) => {
                      const errorId = `${prefix}.base_items-error`;
                      const chosen: number[] = input.value;
                      const others = fields
                        .map((_, position) => position)
                        .filter((position) => position !== index);
                      return (
                        <fieldset className={styles.adjustmentLinks} data-span="full">
                          <legend>{t('finance.adjustments.base_items')}</legend>
                          <p className={styles.cardHelp}>
                            {t('finance.adjustments.base_items_help')}
                          </p>
                          {linked_help ? <p className={styles.cardHelp}>{linked_help}</p> : null}
                          {others.length === 0 ? (
                            <p className={styles.cardHelp}>
                              {t('finance.adjustments.base_items_empty')}
                            </p>
                          ) : null}
                          {others.map((position) => (
                            <Checkbox
                              key={position}
                              label={labelOf(position)}
                              name={`${input.name}.${String(position)}`}
                              value={String(position)}
                              checked={chosen.includes(position)}
                              aria-invalid={fieldState.error ? true : undefined}
                              aria-describedby={fieldState.error ? errorId : undefined}
                              onChange={(event) => {
                                setBlocked(null);
                                input.onChange(
                                  event.target.checked
                                    ? [...chosen, position]
                                    : chosen.filter((entry) => entry !== position),
                                );
                              }}
                              onBlur={input.onBlur}
                            />
                          ))}
                          {fieldState.error?.message ? (
                            <p id={errorId} role="alert" className={styles.formError}>
                              {t(fieldState.error.message)}
                            </p>
                          ) : null}
                        </fieldset>
                      );
                    }}
                  />
                ) : null}
                <div data-span="full">
                  <MoneyField
                    control={shaped}
                    name={`${prefix}.deduction_amount`}
                    label={t('finance.adjustments.deduction_amount')}
                  />
                  <p className={styles.cardHelp}>{t('finance.adjustments.deduction_help')}</p>
                </div>
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
                  // Um item usado como base não sai sem desfazer o vínculo (RN-10, CB-07).
                  const next = removeAdjustment(values, index);
                  if (next === null) {
                    setBlocked(index);
                    return;
                  }
                  setBlocked(null);
                  replace(next);
                }}
              >
                {t('finance.adjustments.remove')}
              </Button>
              {blocked === index ? (
                <p role="alert" className={styles.formError}>
                  {t('finance.adjustments.remove_linked', {
                    name: labelOf(index),
                    items: new Intl.ListFormat(locale, { type: 'conjunction' }).format(
                      dependentsOf(values, index).map(labelOf),
                    ),
                  })}
                </p>
              ) : null}
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
