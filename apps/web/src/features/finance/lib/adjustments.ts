// Mesma regra de apps/server/src/finance/domain/adjustment.rs. As contas usam
// BigInt porque o numerador do reverso passa de Number.MAX_SAFE_INTEGER (RNF-02).

export type AdjustmentDirection = 'deduction' | 'addition';
export type AdjustmentMode = 'fixed' | 'percent';

export interface Adjustment {
  name: string;
  direction: AdjustmentDirection;
  mode: AdjustmentMode;
  amount?: number | null;
  rate_bp?: number | null;
  base_amount?: number | null;
}

export type ComputedAdjustment = Adjustment & { computed_amount: number };

export interface Breakdown {
  gross_amount: number;
  net_amount: number;
  adjustments: ComputedAdjustment[];
}

export interface AdjustmentIssue {
  field: string;
  code: string;
}

export type AdjustmentResult =
  { ok: true; breakdown: Breakdown } | { ok: false; issue: AdjustmentIssue };

export const MAX_ADJUSTMENTS = 20;
export const ADJUSTMENT_NAME_MAX_CHARS = 60;
export const RATE_BP_MIN = 1;
export const RATE_BP_MAX = 9_999;
const BP_SCALE = 10_000n;

// num >= 0 e den > 0: a divisão de BigInt trunca, então somar den dá meio para cima.
function roundHalfUp(num: bigint, den: bigint): bigint {
  return (2n * num + den) / (2n * den);
}

function sign(direction: AdjustmentDirection): bigint {
  return direction === 'deduction' ? -1n : 1n;
}

function fail(field: string, code: string): AdjustmentResult {
  return { ok: false, issue: { field, code } };
}

function toSafe(value: bigint): number | null {
  const inRange =
    value >= BigInt(Number.MIN_SAFE_INTEGER) && value <= BigInt(Number.MAX_SAFE_INTEGER);
  return inRange ? Number(value) : null;
}

function isFilled(value: number | null | undefined): boolean {
  return value !== null && value !== undefined;
}

function isPositiveSafe(value: number | null | undefined): boolean {
  return value !== null && value !== undefined && Number.isSafeInteger(value) && value > 0;
}

function validateName(name: string): AdjustmentIssue | null {
  const chars = Array.from(name.trim()).length;
  if (chars === 0) return { field: 'adjustments.name', code: 'required' };
  if (chars > ADJUSTMENT_NAME_MAX_CHARS) {
    return { field: 'adjustments.name', code: 'too_long' };
  }
  return null;
}

function validateFixed(item: Adjustment): AdjustmentIssue | null {
  if (isFilled(item.rate_bp) || isFilled(item.base_amount)) {
    return { field: 'adjustments.mode', code: 'fields_mismatch' };
  }
  if (!isPositiveSafe(item.amount)) {
    return { field: 'adjustments.amount', code: 'must_be_positive' };
  }
  return null;
}

function validatePercent(item: Adjustment): AdjustmentIssue | null {
  if (isFilled(item.amount)) {
    return { field: 'adjustments.mode', code: 'fields_mismatch' };
  }
  const rate = item.rate_bp;
  const validRate =
    rate !== null &&
    rate !== undefined &&
    Number.isSafeInteger(rate) &&
    rate >= RATE_BP_MIN &&
    rate <= RATE_BP_MAX;
  if (!validRate) return { field: 'adjustments.rate_bp', code: 'out_of_range' };
  const base = item.base_amount;
  if (isFilled(base) && !isPositiveSafe(base)) {
    return { field: 'adjustments.base_amount', code: 'must_be_positive' };
  }
  return null;
}

function validateItem(item: Adjustment): AdjustmentIssue | null {
  const nameIssue = validateName(item.name);
  if (nameIssue) return nameIssue;
  return item.mode === 'fixed' ? validateFixed(item) : validatePercent(item);
}

export function validateAdjustments(items: readonly Adjustment[]): AdjustmentIssue | null {
  if (items.length > MAX_ADJUSTMENTS) {
    return { field: 'adjustments', code: 'too_many' };
  }
  for (const item of items) {
    const issue = validateItem(item);
    if (issue) return issue;
  }
  return null;
}

function itemAmount(item: Adjustment, gross: bigint): bigint {
  if (item.mode === 'fixed') return BigInt(item.amount ?? 0);
  const base = isFilled(item.base_amount) ? BigInt(item.base_amount ?? 0) : gross;
  return roundHalfUp(base * BigInt(item.rate_bp ?? 0), BP_SCALE);
}

function breakdown(gross: bigint, items: readonly Adjustment[]): AdjustmentResult {
  const amounts = items.map((item) => itemAmount(item, gross));
  const net = items.reduce(
    (sum, item, index) => sum + sign(item.direction) * (amounts[index] ?? 0n),
    gross,
  );
  const grossSafe = toSafe(gross);
  const netSafe = toSafe(net);
  const computed: ComputedAdjustment[] = [];
  for (const [index, item] of items.entries()) {
    const value = toSafe(amounts[index] ?? 0n);
    if (value === null) return fail('adjustments', 'too_large');
    computed.push({ ...item, computed_amount: value });
  }
  if (grossSafe === null || netSafe === null) {
    return fail('adjustments', 'too_large');
  }
  return {
    ok: true,
    breakdown: {
      gross_amount: grossSafe,
      net_amount: netSafe,
      adjustments: computed,
    },
  };
}

export function computeNet(gross: number, items: readonly Adjustment[]): AdjustmentResult {
  if (!isPositiveSafe(gross)) return fail('gross_amount', 'must_be_positive');
  const issue = validateAdjustments(items);
  if (issue) return { ok: false, issue };
  const result = breakdown(BigInt(gross), items);
  if (result.ok && result.breakdown.net_amount <= 0) {
    return fail('adjustments', 'net_not_positive');
  }
  return result;
}

function reverseGross(
  net: number,
  items: readonly Adjustment[],
  expectedGross: number,
): bigint | null {
  const expected = BigInt(expectedGross);
  let fixedSum = 0n;
  let den = expected * BP_SCALE;
  for (const item of items) {
    if (item.mode === 'fixed') {
      fixedSum -= sign(item.direction) * BigInt(item.amount ?? 0);
      continue;
    }
    const base = isFilled(item.base_amount) ? BigInt(item.base_amount ?? 0) : expected;
    den += sign(item.direction) * BigInt(item.rate_bp ?? 0) * base;
  }
  const num = (BigInt(net) + fixedSum) * expected * BP_SCALE;
  if (den <= 0n || num < 0n) return null;
  return roundHalfUp(num, den);
}

// A base digitada acompanha o bruto na mesma proporção (RN-06).
function scaleBases(
  items: readonly Adjustment[],
  gross: bigint,
  expectedGross: number,
): Adjustment[] | null {
  const expected = BigInt(expectedGross);
  const scaled: Adjustment[] = [];
  for (const item of items) {
    if (item.mode !== 'percent' || !isFilled(item.base_amount)) {
      scaled.push(item);
      continue;
    }
    const base = toSafe(roundHalfUp(BigInt(item.base_amount ?? 0) * gross, expected));
    if (base === null || base === 0) return null;
    scaled.push({ ...item, base_amount: base });
  }
  return scaled;
}

function lastPercentIndex(items: readonly Adjustment[]): number {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    if (items[index]?.mode === 'percent') return index;
  }
  return -1;
}

// O resíduo de arredondamento vai para o último percentual da lista (RN-07).
function absorbResidual(computed: Breakdown, net: number): AdjustmentResult {
  const residual = net - computed.net_amount;
  if (residual === 0) return { ok: true, breakdown: computed };
  const index = lastPercentIndex(computed.adjustments);
  const target = computed.adjustments[index];
  if (!target) return fail('adjustments', 'no_gross_for_net');
  const shift = target.direction === 'deduction' ? -residual : residual;
  const value = target.computed_amount + shift;
  if (value < 0) return fail('adjustments', 'no_gross_for_net');
  const adjustments = computed.adjustments.map((item, position) =>
    position === index ? { ...item, computed_amount: value } : item,
  );
  return {
    ok: true,
    breakdown: { ...computed, adjustments, net_amount: net },
  };
}

export function grossForNet(
  net: number,
  items: readonly Adjustment[],
  expectedGross: number,
): AdjustmentResult {
  if (!Number.isSafeInteger(net) || net < 0) {
    return fail('settled_amount', 'must_not_be_negative');
  }
  if (!isPositiveSafe(expectedGross)) {
    return fail('expected_gross_amount', 'must_be_positive');
  }
  const issue = validateAdjustments(items);
  if (issue) return { ok: false, issue };
  const exact = reverseGross(net, items, expectedGross);
  if (exact === null) return fail('adjustments', 'no_gross_for_net');
  const gross = toSafe(exact);
  if (gross === null) return fail('adjustments', 'too_large');
  const scaled = scaleBases(items, exact, expectedGross);
  if (scaled === null) return fail('adjustments', 'no_gross_for_net');
  const result = breakdown(exact, scaled);
  if (!result.ok) return result;
  return absorbResidual(result.breakdown, net);
}
