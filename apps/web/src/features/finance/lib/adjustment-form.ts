import { z } from 'zod';
import type { AdjustmentDto, AdjustmentInput } from '../hooks/use-transactions';
import {
  ADJUSTMENT_NAME_MAX_CHARS,
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
  base_amount: number | null;
}

export function emptyAdjustment(): AdjustmentFormItem {
  return {
    name: '',
    direction: 'deduction',
    mode: 'percent',
    amount: null,
    rate_text: '',
    base_different: false,
    base_amount: null,
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
    base_amount: z.number().nullable(),
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
    if (item.base_different && (item.base_amount === null || item.base_amount < 1)) {
      ctx.addIssue({
        code: 'custom',
        path: ['base_amount'],
        message: 'finance.adjustments.base_invalid',
      });
    }
  });

export const adjustments_schema = z.array(adjustment_item_schema).max(MAX_ADJUSTMENTS);

/** Itens do contrato, ou `null` se algum item do editor é inválido. */
export function toAdjustments(items: readonly AdjustmentFormItem[]): AdjustmentInput[] | null {
  const result: AdjustmentInput[] = [];
  for (const item of items) {
    if (!adjustment_item_schema.safeParse(item).success) return null;
    const name = item.name.trim();
    if (item.mode === 'fixed') {
      result.push({ name, direction: item.direction, mode: 'fixed', amount: item.amount });
      continue;
    }
    result.push({
      name,
      direction: item.direction,
      mode: 'percent',
      rate_bp: parseRate(item.rate_text),
      ...(item.base_different ? { base_amount: item.base_amount } : {}),
    });
  }
  return result;
}

export function fromAdjustments(
  items: readonly AdjustmentDto[],
  locale: string,
): AdjustmentFormItem[] {
  return items.map((item) => ({
    name: item.name,
    direction: item.direction,
    mode: item.mode,
    amount: item.mode === 'fixed' ? (item.amount ?? null) : null,
    rate_text: item.rate_bp != null ? formatRate(item.rate_bp, locale) : '',
    base_different: item.base_amount != null,
    base_amount: item.base_amount ?? null,
  }));
}
