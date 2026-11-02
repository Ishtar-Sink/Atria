import { describe, expect, it } from 'vitest';
import {
  computeNet,
  grossForNet,
  MAX_ADJUSTMENTS,
  validateAdjustments,
  type Adjustment,
  type AdjustmentDirection,
  type AdjustmentResult,
  type Breakdown,
} from './adjustments';

function percent(
  name: string,
  direction: AdjustmentDirection,
  rate_bp: number,
  base_amount?: number,
): Adjustment {
  return { name, direction, mode: 'percent', rate_bp, base_amount };
}

function fixed(name: string, direction: AdjustmentDirection, amount: number): Adjustment {
  return { name, direction, mode: 'fixed', amount };
}

const inss = (): Adjustment => percent('INSS', 'deduction', 1100);
const irpf = (rate_bp: number): Adjustment => percent('IRPF', 'deduction', rate_bp, 712_000);
const sindical = (): Adjustment => fixed('Sindical', 'deduction', 4_000);

function breakdownOf(result: AdjustmentResult): Breakdown {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error('expected an ok result');
  return result.breakdown;
}

function amountsOf(result: AdjustmentResult): number[] {
  return breakdownOf(result).adjustments.map((item) => item.computed_amount);
}

function issueOf(result: AdjustmentResult): [string, string] {
  if (result.ok) throw new Error('expected a refused result');
  return [result.issue.field, result.issue.code];
}

function linked(
  name: string,
  rate_bp: number,
  base_items: number[],
  deduction_amount?: number,
): Adjustment {
  return { name, direction: 'deduction', mode: 'percent', rate_bp, base_items, deduction_amount };
}

function payslip(): Adjustment[] {
  return [
    fixed('INSS', 'deduction', 98_807),
    linked('IRPF', 2750, [0], 90_873),
    fixed('Sindical', 'deduction', 3_500),
    fixed('Consignados', 'deduction', 374_670),
  ];
}

describe('adjustments', () => {
  it('ct01 percent on gross and fixed deduction', () => {
    const result = computeNet(800_000, [inss(), sindical()]);
    expect(breakdownOf(result).gross_amount).toBe(800_000);
    expect(amountsOf(result)).toEqual([88_000, 4_000]);
    expect(breakdownOf(result).net_amount).toBe(708_000);
  });

  it('ct02 typed base and order do not change net', () => {
    const first = computeNet(800_000, [inss(), irpf(1500)]);
    expect(amountsOf(first)).toEqual([88_000, 106_800]);
    expect(breakdownOf(first).net_amount).toBe(605_200);
    const second = computeNet(800_000, [irpf(1500), inss()]);
    expect(amountsOf(second)).toEqual([106_800, 88_000]);
    expect(breakdownOf(second).net_amount).toBe(605_200);
  });

  it('ct03 percent deduction and fixed addition', () => {
    const result = computeNet(20_000, [
      percent('Desconto', 'deduction', 1000),
      fixed('Taxa', 'addition', 500),
    ]);
    expect(amountsOf(result)).toEqual([2_000, 500]);
    expect(breakdownOf(result).net_amount).toBe(18_500);
  });

  it('rn03 percent rounds half up per item', () => {
    const result = computeNet(33_333, [percent('Desconto', 'deduction', 1250)]);
    expect(amountsOf(result)).toEqual([4_167]);
    expect(breakdownOf(result).net_amount).toBe(29_166);
  });

  it('rn09 without items net equals gross', () => {
    const result = computeNet(50_000, []);
    expect(breakdownOf(result).net_amount).toBe(50_000);
    expect(breakdownOf(result).adjustments).toEqual([]);
  });

  it('ct05 reverse scales typed base with gross', () => {
    const result = grossForNet(650_000, [inss(), irpf(1500)], 800_000);
    const data = breakdownOf(result);
    expect(data.gross_amount).toBe(859_220);
    expect(data.net_amount).toBe(650_000);
    expect(amountsOf(result)).toEqual([94_514, 114_706]);
    expect(data.adjustments[1]?.base_amount).toBe(764_706);
    expect(data.adjustments[0]?.base_amount).toBeFalsy();
  });

  it('cb02 reverse with only fixed items', () => {
    const result = grossForNet(100_000, [sindical()], 104_000);
    expect(breakdownOf(result).gross_amount).toBe(104_000);
    expect(amountsOf(result)).toEqual([4_000]);
    expect(breakdownOf(result).net_amount).toBe(100_000);
  });

  it('ct07 residual cent goes to last percent', () => {
    const result = grossForNet(650_000, [inss(), irpf(2250)], 800_000);
    const data = breakdownOf(result);
    expect(data.gross_amount).toBe(942_370);
    expect(amountsOf(result)).toEqual([103_661, 188_709]);
    expect(data.adjustments[1]?.base_amount).toBe(838_709);
    expect(data.net_amount).toBe(650_000);
    expect(942_370 - 103_661 - 188_709).toBe(650_000);
  });

  it('ct07 residual follows list order', () => {
    const a = percent('A', 'deduction', 1250);
    const b = percent('B', 'deduction', 3333);
    const forward = grossForNet(10_000, [a, b], 20_000);
    expect(breakdownOf(forward).gross_amount).toBe(18_460);
    expect(amountsOf(forward)).toEqual([2_308, 6_152]);
    expect(breakdownOf(forward).net_amount).toBe(10_000);
    const backward = grossForNet(10_000, [b, a], 20_000);
    expect(breakdownOf(backward).gross_amount).toBe(18_460);
    expect(amountsOf(backward)).toEqual([6_153, 2_307]);
    expect(breakdownOf(backward).net_amount).toBe(10_000);
  });

  it('cb01 reverse with zero net', () => {
    const result = grossForNet(0, [inss(), sindical()], 800_000);
    expect(breakdownOf(result).gross_amount).toBe(4_494);
    expect(amountsOf(result)).toEqual([494, 4_000]);
    expect(breakdownOf(result).net_amount).toBe(0);
  });

  it('cb01 reverse without possible gross is refused', () => {
    const noGross: [string, string] = ['adjustments', 'no_gross_for_net'];
    const heavy = [percent('A', 'deduction', 6000), percent('B', 'deduction', 5000)];
    expect(issueOf(grossForNet(100, heavy, 10_000))).toEqual(noGross);
    expect(issueOf(grossForNet(1_000, [fixed('Bônus', 'addition', 5_000)], 1))).toEqual(noGross);
    expect(issueOf(grossForNet(-1, [], 1_000))).toEqual(['settled_amount', 'must_not_be_negative']);
    expect(issueOf(grossForNet(1_000, [], 0))).toEqual([
      'expected_gross_amount',
      'must_be_positive',
    ]);
  });

  it('cb03 net not positive is refused', () => {
    expect(issueOf(computeNet(1_000, [fixed('Tudo', 'deduction', 1_000)]))).toEqual([
      'adjustments',
      'net_not_positive',
    ]);
    expect(issueOf(computeNet(0, []))).toEqual(['gross_amount', 'must_be_positive']);
  });

  it('cb04 rate outside range is refused', () => {
    const outOfRange: [string, string] = ['adjustments.rate_bp', 'out_of_range'];
    expect(issueOf(computeNet(10_000, [percent('X', 'deduction', 0)]))).toEqual(outOfRange);
    expect(issueOf(computeNet(10_000, [percent('X', 'deduction', 10_000)]))).toEqual(outOfRange);
    expect(computeNet(10_000, [percent('X', 'deduction', 1)]).ok).toBe(true);
    expect(computeNet(10_000, [percent('X', 'deduction', 9_999)]).ok).toBe(true);
  });

  it('cb09 typed base must be positive', () => {
    const notPositive: [string, string] = ['adjustments.base_amount', 'must_be_positive'];
    expect(issueOf(computeNet(10_000, [percent('X', 'deduction', 1000, 0)]))).toEqual(notPositive);
    expect(issueOf(computeNet(10_000, [percent('X', 'deduction', 1000, -1)]))).toEqual(notPositive);
  });

  it('ct13 invalid items are refused', () => {
    const many = (count: number): Adjustment[] =>
      Array.from({ length: count }, () => fixed('Item', 'deduction', 1));
    expect(validateAdjustments(many(20))).toBeNull();
    expect(validateAdjustments(many(21))).toEqual({
      field: 'adjustments',
      code: 'too_many',
    });
    expect(issueOf(computeNet(10_000, many(21)))).toEqual(['adjustments', 'too_many']);
    expect(validateAdjustments([fixed('   ', 'deduction', 1)])).toEqual({
      field: 'adjustments.name',
      code: 'required',
    });
    expect(validateAdjustments([fixed('a'.repeat(61), 'deduction', 1)])).toEqual({
      field: 'adjustments.name',
      code: 'too_long',
    });
    expect(validateAdjustments([fixed('a'.repeat(60), 'deduction', 1)])).toBeNull();
    expect(validateAdjustments([fixed('X', 'deduction', 0)])).toEqual({
      field: 'adjustments.amount',
      code: 'must_be_positive',
    });
    expect(
      validateAdjustments([{ name: 'X', direction: 'deduction', mode: 'fixed', amount: null }]),
    ).toEqual({ field: 'adjustments.amount', code: 'must_be_positive' });
    expect(
      validateAdjustments([
        {
          name: 'X',
          direction: 'deduction',
          mode: 'fixed',
          amount: 100,
          rate_bp: 100,
        },
      ]),
    ).toEqual({ field: 'adjustments.mode', code: 'fields_mismatch' });
    expect(
      validateAdjustments([
        {
          name: 'X',
          direction: 'deduction',
          mode: 'percent',
          rate_bp: 100,
          amount: 100,
        },
      ]),
    ).toEqual({ field: 'adjustments.mode', code: 'fields_mismatch' });
    expect(
      validateAdjustments([{ name: 'X', direction: 'deduction', mode: 'percent', rate_bp: null }]),
    ).toEqual({ field: 'adjustments.rate_bp', code: 'out_of_range' });
  });

  it('overflow is refused as too large', () => {
    const tooLarge: [string, string] = ['adjustments', 'too_large'];
    expect(issueOf(computeNet(Number.MAX_SAFE_INTEGER, [fixed('X', 'addition', 1)]))).toEqual(
      tooLarge,
    );
    expect(
      issueOf(
        grossForNet(
          Number.MAX_SAFE_INTEGER,
          [fixed('X', 'deduction', Number.MAX_SAFE_INTEGER)],
          Number.MAX_SAFE_INTEGER,
        ),
      ),
    ).toEqual(tooLarge);
  });

  it('max adjustments matches the server', () => {
    expect(MAX_ADJUSTMENTS).toBe(20);
  });
});

describe('linked base and deduction', () => {
  it('ct01 payslip with linked base and deduction', () => {
    const result = computeNet(1_450_000, payslip());
    expect(amountsOf(result)).toEqual([98_807, 280_705, 3_500, 374_670]);
    expect(breakdownOf(result).net_amount).toBe(692_318);
    const swapped = computeNet(1_450_000, [
      linked('IRPF', 2750, [1], 90_873),
      fixed('INSS', 'deduction', 98_807),
      fixed('Sindical', 'deduction', 3_500),
      fixed('Consignados', 'deduction', 374_670),
    ]);
    expect(amountsOf(swapped)).toEqual([280_705, 98_807, 3_500, 374_670]);
    expect(breakdownOf(swapped).net_amount).toBe(692_318);
  });

  it('ct02 reverse of payslip keeps deduction', () => {
    const result = grossForNet(692_318, payslip(), 1_450_000);
    const data = breakdownOf(result);
    expect(data.gross_amount).toBe(1_450_000);
    expect(amountsOf(result)).toEqual([98_807, 280_705, 3_500, 374_670]);
    expect(data.net_amount).toBe(692_318);
    expect(data.adjustments[1]?.deduction_amount).toBe(90_873);
    expect(data.adjustments[1]?.base_items).toEqual([0]);
  });

  it('ct03 linked to a percent item', () => {
    const items = [percent('INSS', 'deduction', 681), linked('IRPF', 2750, [0], 90_873)];
    const result = computeNet(1_450_000, items);
    expect(amountsOf(result)).toEqual([98_745, 280_722]);
    expect(breakdownOf(result).net_amount).toBe(1_070_533);
    const reverse = grossForNet(1_070_533, items, 1_450_000);
    expect(breakdownOf(reverse).gross_amount).toBe(1_450_000);
    expect(amountsOf(reverse)).toEqual([98_745, 280_722]);
  });

  it('ct04 linked to two items', () => {
    const result = computeNet(1_450_000, [
      fixed('INSS', 'deduction', 98_807),
      fixed('Pensão', 'deduction', 100_000),
      linked('IRPF', 2750, [0, 1], 90_873),
    ]);
    expect(amountsOf(result)).toEqual([98_807, 100_000, 253_205]);
    expect(breakdownOf(result).net_amount).toBe(997_988);
  });

  it('cb06 chain follows dependencies', () => {
    const result = computeNet(100_000, [
      linked('A', 1000, [1]),
      linked('B', 1000, [2]),
      percent('C', 'deduction', 1000),
    ]);
    expect(amountsOf(result)).toEqual([9_100, 9_000, 10_000]);
    expect(breakdownOf(result).net_amount).toBe(71_900);
  });

  it('rn09 residual goes to the percent nobody depends on', () => {
    const result = grossForNet(
      1_070_557,
      [linked('IRPF', 2750, [1], 90_873), percent('INSS', 'deduction', 681)],
      1_450_000,
    );
    const data = breakdownOf(result);
    expect(data.gross_amount).toBe(1_450_036);
    expect(amountsOf(result)).toEqual([280_732, 98_747]);
    expect(data.net_amount).toBe(1_070_557);
    expect(1_450_036 - 280_732 - 98_747).toBe(1_070_557);
  });

  it('ct05 self reference and cycle are refused', () => {
    expect(issueOf(computeNet(10_000, [linked('A', 1000, [0])]))).toEqual([
      'adjustments.base_items',
      'self_reference',
    ]);
    const loop = [linked('A', 1000, [1]), linked('B', 1000, [0])];
    expect(issueOf(computeNet(10_000, loop))).toEqual(['adjustments.base_items', 'cycle']);
    expect(validateAdjustments(loop)).toEqual({ field: 'adjustments.base_items', code: 'cycle' });
  });

  it('base items out of range or mismatched are refused', () => {
    const other = fixed('X', 'deduction', 100);
    const baseItems = (code: string) => ({ field: 'adjustments.base_items', code });
    expect(validateAdjustments([other, linked('A', 1000, [2])])).toEqual(baseItems('out_of_range'));
    expect(validateAdjustments([other, linked('A', 1000, [-1])])).toEqual(
      baseItems('out_of_range'),
    );
    expect(validateAdjustments([other, linked('A', 1000, [0.5])])).toEqual(
      baseItems('out_of_range'),
    );
    expect(validateAdjustments([other, linked('A', 1000, [])])).toBeNull();
    expect(validateAdjustments([other, linked('A', 1000, [0, 0])])).toEqual(
      baseItems('fields_mismatch'),
    );
    const chain = (size: number): Adjustment[] =>
      Array.from({ length: size }, (_, index) =>
        index === 0
          ? percent('N0', 'deduction', 1000)
          : linked('N' + String(index), 1000, [index - 1]),
      );
    expect(validateAdjustments(chain(5))).toEqual(baseItems('too_deep'));
    expect(validateAdjustments(chain(4))).toBeNull();
    expect(validateAdjustments([other, { ...linked('A', 1000, [0]), base_amount: 5_000 }])).toEqual(
      baseItems('fields_mismatch'),
    );
    expect(validateAdjustments([{ ...other, base_items: [0] }, other])).toEqual(
      baseItems('fields_mismatch'),
    );
  });

  it('cb03 linked base not positive is refused', () => {
    const result = computeNet(100_000, [fixed('X', 'deduction', 150_000), linked('A', 1000, [0])]);
    expect(issueOf(result)).toEqual(['adjustments.base_items', 'not_positive']);
  });

  it('ct06 deduction above percent is refused', () => {
    const above = { ...percent('IRPF', 'deduction', 2750), deduction_amount: 90_873 };
    expect(issueOf(computeNet(100_000, [above]))).toEqual([
      'adjustments.deduction_amount',
      'exceeds_amount',
    ]);
    const equal = { ...percent('IRPF', 'deduction', 2750), deduction_amount: 27_500 };
    const result = computeNet(100_000, [equal]);
    expect(amountsOf(result)).toEqual([0]);
    expect(breakdownOf(result).net_amount).toBe(100_000);
  });

  it('cb05 deduction must be positive and only in percent', () => {
    expect(
      validateAdjustments([{ ...fixed('X', 'deduction', 100), deduction_amount: 10 }]),
    ).toEqual({ field: 'adjustments.deduction_amount', code: 'fields_mismatch' });
    for (const value of [0, -1, 1.5]) {
      expect(
        validateAdjustments([{ ...percent('X', 'deduction', 1000), deduction_amount: value }]),
      ).toEqual({ field: 'adjustments.deduction_amount', code: 'must_be_positive' });
    }
  });

  it('cb08 reverse refuses a deduction that leaves the item negative', () => {
    const item = { ...percent('IRPF', 'deduction', 2750), deduction_amount: 90_873 };
    expect(issueOf(grossForNet(50_000, [item], 1_450_000))).toEqual([
      'adjustments',
      'no_gross_for_net',
    ]);
  });
});
