import { describe, expect, it } from 'vitest';
import { SALARY_ADJUSTMENTS } from '../test-utils';
import {
  adjustment_item_schema,
  adjustments_schema,
  emptyAdjustment,
  formatRate,
  fromAdjustments,
  MAX_ADJUSTMENTS,
  parseRate,
  toAdjustments,
  type AdjustmentFormItem,
} from './adjustment-form';

function percentItem(overrides: Partial<AdjustmentFormItem> = {}): AdjustmentFormItem {
  return { ...emptyAdjustment(), name: 'INSS', rate_text: '11', ...overrides };
}

function issuesOf(item: AdjustmentFormItem) {
  const result = adjustment_item_schema.safeParse(item);
  return result.success ? [] : result.error.issues;
}

describe('adjustment form', () => {
  it('rf05 turns a percent with up to two decimals into basis points', () => {
    expect(parseRate('11')).toBe(1100);
    expect(parseRate('11,5')).toBe(1150);
    expect(parseRate('11,50')).toBe(1150);
    expect(parseRate('0,01')).toBe(1);
    expect(parseRate('99,99')).toBe(9999);
    expect(parseRate('15.25')).toBe(1525);
    expect(parseRate(' 7,5 % ')).toBe(750);
  });

  it('ct13 refuses a percent of zero, of 100 or more and with three decimals', () => {
    for (const text of ['0', '0,00', '100', '12,345', '', 'abc']) {
      expect(parseRate(text)).toBeNull();
    }
  });

  it('writes the basis points back as a percent in the locale', () => {
    expect(formatRate(1100, 'pt-BR')).toBe('11,00');
    expect(formatRate(1525, 'pt-BR')).toBe('15,25');
  });

  it('rf06 sends the base only when it differs from the gross', () => {
    expect(toAdjustments([percentItem({ name: ' INSS ' })])).toEqual([
      { name: 'INSS', direction: 'deduction', mode: 'percent', rate_bp: 1100 },
    ]);
    expect(toAdjustments([percentItem({ base_different: true, base_amount: 712000 })])).toEqual([
      { name: 'INSS', direction: 'deduction', mode: 'percent', rate_bp: 1100, base_amount: 712000 },
    ]);
    expect(toAdjustments([percentItem({ base_different: false, base_amount: 712000 })])).toEqual([
      { name: 'INSS', direction: 'deduction', mode: 'percent', rate_bp: 1100 },
    ]);
    expect(
      toAdjustments([{ ...emptyAdjustment(), name: 'Sindical', mode: 'fixed', amount: 4000 }]),
    ).toEqual([{ name: 'Sindical', direction: 'deduction', mode: 'fixed', amount: 4000 }]);
    expect(toAdjustments([percentItem({ rate_text: '0' })])).toBeNull();
  });

  it('loads saved items back into the form', () => {
    const items = fromAdjustments(SALARY_ADJUSTMENTS, 'pt-BR');
    expect(items.map((entry) => entry.rate_text)).toEqual(['11,00', '15,00']);
    expect(items.map((entry) => entry.base_different)).toEqual([false, true]);
    expect(items.map((entry) => entry.base_amount)).toEqual([null, 712000]);
    expect(items.map((entry) => entry.name)).toEqual(['INSS', 'IRPF']);
  });

  it('cb09 refuses a different base without value or zero', () => {
    for (const base_amount of [null, 0]) {
      const issues = issuesOf(percentItem({ base_different: true, base_amount }));
      expect(issues).toEqual([
        expect.objectContaining({
          path: ['base_amount'],
          message: 'finance.adjustments.base_invalid',
        }),
      ]);
    }
  });

  it('rf03 refuses an empty name or one longer than 60 characters', () => {
    for (const name of ['', '   ', 'x'.repeat(61)]) {
      expect(issuesOf(percentItem({ name }))).toEqual([
        expect.objectContaining({ path: ['name'], message: 'finance.adjustments.name_required' }),
      ]);
    }
    expect(issuesOf(percentItem({ name: 'x'.repeat(60) }))).toEqual([]);
  });

  it('cb08 accepts up to 20 items', () => {
    const items = Array.from({ length: MAX_ADJUSTMENTS }, () => percentItem());
    expect(MAX_ADJUSTMENTS).toBe(20);
    expect(adjustments_schema.safeParse(items).success).toBe(true);
    expect(adjustments_schema.safeParse([...items, percentItem()]).success).toBe(false);
  });
});
