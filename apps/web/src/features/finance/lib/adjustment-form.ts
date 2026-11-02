import { z } from 'zod';
import type { AdjustmentDto, AdjustmentInput } from '../hooks/use-transactions';
import {
  ADJUSTMENT_NAME_MAX_CHARS,
  computeNet,
  MAX_ADJUSTMENTS,
  RATE_BP_MAX,
  RATE_BP_MIN,
} from './adjustments';

export { MAX_ADJUSTMENTS } from './adjustments';

/** Item do editor: o percentual fica como texto até a validação (RF-05). */
export interface AdjustmentFormItem {
  name: string;
  direction: 'deduction' | 'addition';
  mode: 'fixed' | 'percent';
  amount: number | null;
  rate_text: string;
  base_different: boolean;
  /** Com `base_different`: base digitada (`amount`) ou ligada a itens da lista (`items`). */
  base_source: 'amount' | 'items';
  base_amount: number | null;
  /** Posições, a partir de 0, dos itens que formam a base ligada (RF-03). */
  base_items: number[];
  /** Parcela a deduzir em centavos, só no percentual (RF-04). */
  deduction_amount: number | null;
}

export function emptyAdjustment(): AdjustmentFormItem {
  return {
    name: '',
    direction: 'deduction',
    mode: 'percent',
    amount: null,
    rate_text: '',
    base_different: false,
    base_source: 'amount',
    base_amount: null,
    base_items: [],
    deduction_amount: null,
  };
}

const RATE_PATTERN = /^\s*(\d{1,2})(?:[,.](\d{1,2}))?\s*%?\s*$/;

/** Percentual digitado em centésimos de ponto (`rate_bp`), de 0,01 a 99,99 (RN-05). */
export function parseRate(text: string): number | null {
  const match = RATE_PATTERN.exec(text);
  if (!match) return null;
  const rate_bp = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
  return rate_bp >= RATE_BP_MIN && rate_bp <= RATE_BP_MAX ? rate_bp : null;
}

export function formatRate(rate_bp: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(rate_bp / 100);
}

export const adjustment_item_schema = z
  .object({
    name: z.string(),
    direction: z.enum(['deduction', 'addition']),
    mode: z.enum(['fixed', 'percent']),
    amount: z.number().nullable(),
    rate_text: z.string(),
    base_different: z.boolean(),
    base_source: z.enum(['amount', 'items']),
    base_amount: z.number().nullable(),
    base_items: z.array(z.number().int()),
    deduction_amount: z.number().nullable(),
  })
  .superRefine((item, ctx) => {
    const chars = Array.from(item.name.trim()).length;
    if (chars === 0 || chars > ADJUSTMENT_NAME_MAX_CHARS) {
      ctx.addIssue({
        code: 'custom',
        path: ['name'],
        message: 'finance.adjustments.name_required',
      });
    }
    if (item.mode === 'fixed') {
      if (item.amount === null || !Number.isSafeInteger(item.amount) || item.amount < 1) {
        ctx.addIssue({
          code: 'custom',
          path: ['amount'],
          message: 'finance.adjustments.amount_invalid',
        });
      }
      return;
    }
    if (parseRate(item.rate_text) === null) {
      ctx.addIssue({
        code: 'custom',
        path: ['rate_text'],
        message: 'finance.adjustments.rate_invalid',
      });
    }
    if (
      item.base_different &&
      item.base_source === 'amount' &&
      (item.base_amount === null || item.base_amount < 1)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['base_amount'],
        message: 'finance.adjustments.base_invalid',
      });
    }
    if (item.base_different && item.base_source === 'items' && item.base_items.length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['base_items'],
        message: 'finance.adjustments.base_items_required',
      });
    }
    if (
      item.deduction_amount !== null &&
      (!Number.isSafeInteger(item.deduction_amount) || item.deduction_amount < 1)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['deduction_amount'],
        message: 'finance.adjustments.deduction_invalid',
      });
    }
  });

/** Posições ligadas de fato: só no percentual com a base ligada escolhida. */
function linksOf(item: AdjustmentFormItem | undefined): number[] {
  return item?.mode === 'percent' && item.base_different && item.base_source === 'items'
    ? item.base_items
    : [];
}

/** Itens que, seguindo os vínculos, voltam a si mesmos, inclusive o ligado a si (CB-01, CB-02). */
export function cycleIndexes(items: readonly AdjustmentFormItem[]): number[] {
  const result: number[] = [];
  for (const start of items.keys()) {
    const visited = new Set<number>();
    const stack = [...linksOf(items[start])];
    while (stack.length > 0) {
      const index = stack.pop() as number;
      if (index === start) {
        result.push(start);
        break;
      }
      if (visited.has(index)) continue;
      visited.add(index);
      stack.push(...linksOf(items[index]));
    }
  }
  return result;
}

export const adjustments_schema = z
  .array(adjustment_item_schema)
  .max(MAX_ADJUSTMENTS)
  .superRefine((items, ctx) => {
    for (const index of cycleIndexes(items)) {
      ctx.addIssue({
        code: 'custom',
        path: [index, 'base_items'],
        message: 'finance.adjustments.base_items_cycle',
      });
    }
  });

/** Itens cuja base ligada usa o item da posição `index`. */
export function dependentsOf(items: readonly AdjustmentFormItem[], index: number): number[] {
  const result: number[] = [];
  for (const [position, item] of items.entries()) {
    if (linksOf(item).includes(index)) result.push(position);
  }
  return result;
}

/**
 * Lista sem o item, com as posições dos vínculos ajustadas, ou `null` se outro item usa o item
 * como base (RN-10, CB-07, CT-14).
 */
export function removeAdjustment(
  items: readonly AdjustmentFormItem[],
  index: number,
): AdjustmentFormItem[] | null {
  if (dependentsOf(items, index).length > 0) return null;
  return items
    .filter((_, position) => position !== index)
    .map((item) => ({
      ...item,
      base_items: item.base_items
        .filter((position) => position !== index)
        .map((position) => (position > index ? position - 1 : position)),
    }));
}

/** Bruto menos os descontos e mais os acréscimos ligados, com o valor calculado de cada um (RN-02). */
export function linkedBase(
  gross: number,
  items: readonly { direction: 'deduction' | 'addition'; computed_amount: number }[],
  base_items: readonly number[],
): number {
  return base_items.reduce((base, position) => {
    const item = items[position];
    if (!item) return base;
    return item.direction === 'deduction'
      ? base - item.computed_amount
      : base + item.computed_amount;
  }, gross);
}

/** Itens do contrato, ou `null` se algum item do editor é inválido. */
export function toAdjustments(items: readonly AdjustmentFormItem[]): AdjustmentInput[] | null {
  if (cycleIndexes(items).length > 0) return null;
  const result: AdjustmentInput[] = [];
  for (const item of items) {
    if (!adjustment_item_schema.safeParse(item).success) return null;
    const name = item.name.trim();
    if (item.mode === 'fixed') {
      result.push({ name, direction: item.direction, mode: 'fixed', amount: item.amount });
      continue;
    }
    // A mesma ordem de chaves do `AdjustmentDto` do servidor.
    const linked = item.base_different && item.base_source === 'items';
    result.push({
      name,
      direction: item.direction,
      mode: 'percent',
      rate_bp: parseRate(item.rate_text),
      ...(item.base_different && !linked ? { base_amount: item.base_amount } : {}),
      ...(linked ? { base_items: [...item.base_items].sort((a, b) => a - b) } : {}),
      ...(item.deduction_amount !== null ? { deduction_amount: item.deduction_amount } : {}),
    });
  }
  return result;
}

export function fromAdjustments(
  items: readonly AdjustmentDto[],
  locale: string,
): AdjustmentFormItem[] {
  return items.map((item) => {
    const links = item.base_items ?? [];
    return {
      name: item.name,
      direction: item.direction,
      mode: item.mode,
      amount: item.mode === 'fixed' ? (item.amount ?? null) : null,
      rate_text: item.rate_bp != null ? formatRate(item.rate_bp, locale) : '',
      base_different: item.base_amount != null || links.length > 0,
      base_source: links.length > 0 ? 'items' : 'amount',
      base_amount: item.base_amount ?? null,
      base_items: [...links],
      deduction_amount: item.deduction_amount ?? null,
    };
  });
}

/**
 * Problema de valor da lista (líquido, parcela ou base ligada), no campo do item. O cálculo não
 * diz a posição: o primeiro item com o campo é o mais provável, e a mensagem é a mesma.
 */
export function adjustmentsIssue(
  gross: number | null,
  items: readonly AdjustmentFormItem[],
): { path: (string | number)[]; message: string } | null {
  if (gross === null || items.length === 0) return null;
  const adjustments = toAdjustments(items);
  if (adjustments === null) return null;
  const result = computeNet(gross, adjustments);
  if (result.ok) return null;
  const { field, code } = result.issue;
  if (code === 'net_not_positive') {
    return { path: [], message: 'finance.adjustments.net_not_positive' };
  }
  if (field === 'adjustments.deduction_amount' && code === 'exceeds_amount') {
    const index = items.findIndex(
      (item) => item.mode === 'percent' && item.deduction_amount !== null,
    );
    return { path: [index, 'deduction_amount'], message: 'finance.adjustments.deduction_exceeds' };
  }
  if (field === 'adjustments.base_items' && (code === 'not_positive' || code === 'too_deep')) {
    const index = items.findIndex((item) => linksOf(item).length > 0);
    return {
      path: [index, 'base_items'],
      message:
        code === 'too_deep'
          ? 'finance.adjustments.base_items_too_deep'
          : 'finance.adjustments.base_items_not_positive',
    };
  }
  return null;
}
