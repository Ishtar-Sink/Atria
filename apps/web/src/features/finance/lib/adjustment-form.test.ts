import { describe, expect, it } from 'vitest';
import { PAYSLIP_ADJUSTMENTS, SALARY_ADJUSTMENTS } from '../test-utils';
import {
  adjustment_item_schema,
  adjustments_schema,
  adjustmentsIssue,
  cycleIndexes,
  dependentsOf,
  emptyAdjustment,
  formatRate,
  fromAdjustments,
  MAX_ADJUSTMENTS,
  linkedBase,
  parseRate,
  removeAdjustment,
  toAdjustments,
  type AdjustmentFormItem,
} from './adjustment-form';

function percentItem(overrides: Partial<AdjustmentFormItem> = {}): AdjustmentFormItem {
  return { ...emptyAdjustment(), name: 'INSS', rate_text: '11', ...overrides };
}

function linked(
  name: string,
  base_items: number[],
  overrides: Partial<AdjustmentFormItem> = {},
): AdjustmentFormItem {
  return percentItem({
    name,
    rate_text: '27,5',
    base_different: true,
    base_source: 'items',
    base_items,
    ...overrides,
  });
}

function fixedItem(name: string, amount: number): AdjustmentFormItem {
  return { ...emptyAdjustment(), name, mode: 'fixed', amount };
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

  it('rf03 sends a linked base and a deduction in the contract order', () => {
    const result = toAdjustments([
      fixedItem('INSS', 98807),
      linked('IRPF', [0], { deduction_amount: 90873 }),
    ]);
    expect(result).toEqual([
      { name: 'INSS', direction: 'deduction', mode: 'fixed', amount: 98807 },
      {
        name: 'IRPF',
        direction: 'deduction',
        mode: 'percent',
        rate_bp: 2750,
        base_items: [0],
        deduction_amount: 90873,
      },
    ]);
    expect(JSON.stringify(result?.[1])).toBe(
      '{"name":"IRPF","direction":"deduction","mode":"percent","rate_bp":2750,"base_items":[0],"deduction_amount":90873}',
    );
    const items = [fixedItem('A', 100), fixedItem('B', 100), fixedItem('C', 100)];
    expect(toAdjustments([...items, linked('IRPF', [2, 0])])?.[3]).toEqual(
      expect.objectContaining({ base_items: [0, 2] }),
    );
    expect(
      toAdjustments([fixedItem('INSS', 1), linked('IRPF', [0], { base_different: false })])?.[1],
    ).not.toHaveProperty('base_items');
    const typed = toAdjustments([
      fixedItem('INSS', 1),
      linked('IRPF', [0], { base_source: 'amount', base_amount: 712000 }),
    ])?.[1];
    expect(typed).toEqual(expect.objectContaining({ base_amount: 712000 }));
    expect(typed).not.toHaveProperty('base_items');
  });

  it('loads a linked base and a deduction back into the form', () => {
    const items = fromAdjustments(PAYSLIP_ADJUSTMENTS, 'pt-BR');
    expect(items[1]).toEqual(
      expect.objectContaining({
        base_different: true,
        base_source: 'items',
        base_items: [0],
        deduction_amount: 90873,
        base_amount: null,
        rate_text: '27,50',
      }),
    );
    expect(items[0]).toEqual(
      expect.objectContaining({ base_source: 'amount', base_items: [], deduction_amount: null }),
    );
    expect(fromAdjustments(SALARY_ADJUSTMENTS, 'pt-BR')[1]).toEqual(
      expect.objectContaining({ base_source: 'amount', base_amount: 712000 }),
    );
  });

  it('rf03 asks for at least one item in a linked base', () => {
    expect(issuesOf(linked('IRPF', []))).toEqual([
      expect.objectContaining({
        path: ['base_items'],
        message: 'finance.adjustments.base_items_required',
      }),
    ]);
  });

  it('rf04 refuses a deduction of zero', () => {
    expect(issuesOf(percentItem({ deduction_amount: 0 }))).toEqual([
      expect.objectContaining({
        path: ['deduction_amount'],
        message: 'finance.adjustments.deduction_invalid',
      }),
    ]);
    expect(issuesOf(percentItem({ deduction_amount: null }))).toEqual([]);
  });

  it('cb02 refuses links that form a cycle', () => {
    const items = [linked('A', [1]), linked('B', [0]), fixedItem('C', 100)];
    const result = adjustments_schema.safeParse(items);
    expect(result.success).toBe(false);
    const issues = result.success ? [] : result.error.issues;
    expect(issues.map((issue) => [issue.path, issue.message])).toEqual([
      [[0, 'base_items'], 'finance.adjustments.base_items_cycle'],
      [[1, 'base_items'], 'finance.adjustments.base_items_cycle'],
    ]);
    expect(cycleIndexes(items)).toEqual([0, 1]);
    expect(cycleIndexes([linked('A', [0])])).toEqual([0]);
    expect(cycleIndexes([linked('A', [1]), linked('B', [2]), percentItem({ name: 'C' })])).toEqual(
      [],
    );
  });

  it('cb07 refuses to remove an item used as a base', () => {
    const items = [fixedItem('INSS', 98807), linked('IRPF', [0]), fixedItem('Sindical', 3500)];
    expect(dependentsOf(items, 0)).toEqual([1]);
    expect(removeAdjustment(items, 0)).toBeNull();
  });

  it('ct14 shifts the links when an earlier item is removed', () => {
    const items = [fixedItem('Pensão', 100000), fixedItem('INSS', 98807), linked('IRPF', [1])];
    const next = removeAdjustment(items, 0);
    expect(next?.map((item) => item.name)).toEqual(['INSS', 'IRPF']);
    expect(next?.[1]?.base_items).toEqual([0]);
    expect(items[2]?.base_items).toEqual([1]);
    expect(items).toHaveLength(3);
  });

  it('rf07 computes a linked base from the computed items', () => {
    const computed = [
      { direction: 'deduction' as const, computed_amount: 98807 },
      { direction: 'addition' as const, computed_amount: 500 },
    ];
    expect(linkedBase(1450000, computed, [0, 1])).toBe(1351693);
    expect(linkedBase(1450000, computed, [0])).toBe(1351193);
  });

  it('places value problems on the field of the item', () => {
    expect(
      adjustmentsIssue(100000, [
        percentItem({ name: 'IRPF', rate_text: '27,5', deduction_amount: 90873 }),
      ]),
    ).toEqual({ path: [0, 'deduction_amount'], message: 'finance.adjustments.deduction_exceeds' });
    expect(adjustmentsIssue(100000, [fixedItem('X', 150000), linked('A', [0])])).toEqual({
      path: [1, 'base_items'],
      message: 'finance.adjustments.base_items_not_positive',
    });
    expect(adjustmentsIssue(10000, [fixedItem('X', 10000)])).toEqual({
      path: [],
      message: 'finance.adjustments.net_not_positive',
    });
    expect(
      adjustmentsIssue(1450000, [
        fixedItem('INSS', 98807),
        linked('IRPF', [0], { deduction_amount: 90873 }),
      ]),
    ).toBeNull();
    expect(adjustmentsIssue(null, [fixedItem('X', 1)])).toBeNull();
  });
});
