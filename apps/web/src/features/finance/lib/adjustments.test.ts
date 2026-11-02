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
