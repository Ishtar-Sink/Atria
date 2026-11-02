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
  base_items?: readonly number[] | null;
  deduction_amount?: number | null;
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
export const MAX_LINK_DEPTH = 3;
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

function isFilledList(value: readonly number[] | null | undefined): value is readonly number[] {
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
  if (isFilledList(item.base_items)) {
    return { field: 'adjustments.base_items', code: 'fields_mismatch' };
  }
  if (isFilled(item.deduction_amount)) {
    return { field: 'adjustments.deduction_amount', code: 'fields_mismatch' };
  }
  if (!isPositiveSafe(item.amount)) {
    return { field: 'adjustments.amount', code: 'must_be_positive' };
  }
  return null;
}

function validateBaseItems(item: Adjustment, index: number, count: number): AdjustmentIssue | null {
  const list = item.base_items;
  if (!isFilledList(list)) return null;
  if (isFilled(item.base_amount)) {
    return { field: 'adjustments.base_items', code: 'fields_mismatch' };
  }
  if (list.length === 0) return null;
  if (
    list.some((position) => !Number.isSafeInteger(position) || position < 0 || position >= count)
  ) {
    return { field: 'adjustments.base_items', code: 'out_of_range' };
  }
  if (list.includes(index)) return { field: 'adjustments.base_items', code: 'self_reference' };
  if (new Set(list).size !== list.length) {
    return { field: 'adjustments.base_items', code: 'fields_mismatch' };
  }
  return null;
}

function validatePercent(item: Adjustment, index: number, count: number): AdjustmentIssue | null {
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
  const linkIssue = validateBaseItems(item, index, count);
  if (linkIssue) return linkIssue;
  if (isFilled(item.deduction_amount) && !isPositiveSafe(item.deduction_amount)) {
    return { field: 'adjustments.deduction_amount', code: 'must_be_positive' };
  }
  return null;
}

function validateItem(item: Adjustment, index: number, count: number): AdjustmentIssue | null {
  const nameIssue = validateName(item.name);
  if (nameIssue) return nameIssue;
  return item.mode === 'fixed' ? validateFixed(item) : validatePercent(item, index, count);
}

function linksOf(item: Adjustment | undefined): readonly number[] {
  return item?.base_items ?? [];
}

// Ordem de cálculo: cada item vem depois dos itens da sua base ligada. Devolve
// null quando há ciclo.
function evaluationOrder(items: readonly Adjustment[]): number[] | null {
  const order: number[] = [];
  const placed = new Set<number>();
  while (order.length < items.length) {
    const next = items.findIndex(
      (item, index) => !placed.has(index) && linksOf(item).every((link) => placed.has(link)),
    );
    if (next === -1) return null;
    order.push(next);
    placed.add(next);
  }
  return order;
}

function exceedsDepth(items: readonly Adjustment[], order: readonly number[]): boolean {
  const depth: number[] = items.map(() => 0);
  for (const index of order) {
    const links = linksOf(items[index]);
    if (links.length === 0) continue;
    const level = 1 + Math.max(...links.map((link) => depth[link] ?? 0));
    depth[index] = level;
    if (level > MAX_LINK_DEPTH) return true;
  }
  return false;
}

export function validateAdjustments(items: readonly Adjustment[]): AdjustmentIssue | null {
  if (items.length > MAX_ADJUSTMENTS) {
    return { field: 'adjustments', code: 'too_many' };
  }
  for (const [index, item] of items.entries()) {
    const issue = validateItem(item, index, items.length);
    if (issue) return issue;
  }
  const order = evaluationOrder(items);
  if (order === null) return { field: 'adjustments.base_items', code: 'cycle' };
  if (exceedsDepth(items, order)) return { field: 'adjustments.base_items', code: 'too_deep' };
  return null;
}

function itemAmounts(
  gross: bigint,
  items: readonly Adjustment[],
): { amounts: bigint[] } | { issue: AdjustmentIssue } {
  const amounts: bigint[] = items.map(() => 0n);
  for (const index of evaluationOrder(items) ?? []) {
    const item = items[index];
    if (!item) continue;
    if (item.mode === 'fixed') {
      amounts[index] = BigInt(item.amount ?? 0);
      continue;
    }
    const links = linksOf(item);
    let base = isFilled(item.base_amount) ? BigInt(item.base_amount ?? 0) : gross;
    if (links.length > 0) {
      base = links.reduce(
        (sum, link) => sum + sign(items[link]?.direction ?? 'deduction') * (amounts[link] ?? 0n),
        gross,
      );
      if (base <= 0n) return { issue: { field: 'adjustments.base_items', code: 'not_positive' } };
    }
    const value =
      roundHalfUp(base * BigInt(item.rate_bp ?? 0), BP_SCALE) - BigInt(item.deduction_amount ?? 0);
    if (value < 0n) {
      return { issue: { field: 'adjustments.deduction_amount', code: 'exceeds_amount' } };
    }
    amounts[index] = value;
  }
  return { amounts };
}

function breakdown(gross: bigint, items: readonly Adjustment[]): AdjustmentResult {
  const calculated = itemAmounts(gross, items);
  if ('issue' in calculated) return { ok: false, issue: calculated.issue };
  const { amounts } = calculated;
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

// Valor (slope x bruto + offset) / scale, com scale > 0.
interface Affine {
  slope: bigint;
  offset: bigint;
  scale: bigint;
}

const GROSS: Affine = { slope: 1n, offset: 0n, scale: 1n };

function affineConst(value: bigint): Affine {
  return { slope: 0n, offset: value, scale: 1n };
}

// x + factor * y, sem simplificar as frações: o arredondamento só depende do valor.
function affineAdd(x: Affine, y: Affine, factor: bigint): Affine {
  return {
    slope: x.slope * y.scale + factor * y.slope * x.scale,
    offset: x.offset * y.scale + factor * y.offset * x.scale,
    scale: x.scale * y.scale,
  };
}

function affineRate(x: Affine, rate: bigint): Affine {
  return { slope: x.slope * rate, offset: x.offset * rate, scale: x.scale * BP_SCALE };
}

// O reverso é exato porque cada item continua afim no bruto, com base ligada e
// parcela (RF-06).
function reverseGross(
  net: number,
  items: readonly Adjustment[],
  expectedGross: number,
): bigint | null {
  const expected = BigInt(expectedGross);
  const affines: Affine[] = items.map(() => affineConst(0n));
  for (const index of evaluationOrder(items) ?? []) {
    const item = items[index];
    if (!item) continue;
    if (item.mode === 'fixed') {
      affines[index] = affineConst(BigInt(item.amount ?? 0));
      continue;
    }
    let base = GROSS;
    if (isFilled(item.base_amount)) {
      base = { slope: BigInt(item.base_amount ?? 0), offset: 0n, scale: expected };
    }
    for (const link of linksOf(item)) {
      base = affineAdd(
        base,
        affines[link] ?? affineConst(0n),
        sign(items[link]?.direction ?? 'deduction'),
      );
    }
    affines[index] = affineAdd(
      affineRate(base, BigInt(item.rate_bp ?? 0)),
      affineConst(BigInt(item.deduction_amount ?? 0)),
      -1n,
    );
  }
  const total = items.reduce(
    (sum, item, index) => affineAdd(sum, affines[index] ?? affineConst(0n), sign(item.direction)),
    GROSS,
  );
  const num = BigInt(net) * total.scale - total.offset;
  if (total.slope <= 0n || num < 0n) return null;
  return roundHalfUp(num, total.slope);
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

function residualTarget(items: readonly Adjustment[]): number {
  const used = new Set(items.flatMap((item) => linksOf(item)));
  for (let index = items.length - 1; index >= 0; index -= 1) {
    if (items[index]?.mode === 'percent' && !used.has(index)) return index;
  }
  return -1;
}

// O resíduo vai para um percentual do qual nenhum item depende, para não mudar
// uma base ligada (RN-09).
function absorbResidual(computed: Breakdown, net: number): AdjustmentResult {
  const residual = net - computed.net_amount;
  if (residual === 0) return { ok: true, breakdown: computed };
  const index = residualTarget(computed.adjustments);
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
  if (!result.ok) {
    const { field } = result.issue;
    const linked = field === 'adjustments.base_items' || field === 'adjustments.deduction_amount';
    return linked ? fail('adjustments', 'no_gross_for_net') : result;
  }
  return absorbResidual(result.breakdown, net);
}
