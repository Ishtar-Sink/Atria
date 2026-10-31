// Dinheiro é inteiro em centavos ([project/code-style-05]): a conversão é só com texto e inteiros.

interface Separators {
  group: string;
  decimal: string;
}

const separators_cache = new Map<string, Separators>();

function separatorsOf(locale: string): Separators {
  const cached = separators_cache.get(locale);
  if (cached) return cached;
  const parts = new Intl.NumberFormat(locale).formatToParts(1234567.5);
  const found = {
    group: parts.find((part) => part.type === 'group')?.value ?? '.',
    decimal: parts.find((part) => part.type === 'decimal')?.value ?? ',',
  };
  separators_cache.set(locale, found);
  return found;
}

// Espaço comum, sem quebra e estreito: o Intl usa os dois últimos como separador de milhar.
const SPACES = /[\s  ]/g;
const CURRENCY_SYMBOLS = /[^\d.,'  \s-]/g;

/** Texto digitado no locale do usuário em centavos; `null` quando não é um valor válido. */
export function parseMoneyToCents(text: string, locale: string): number | null {
  const { group, decimal } = separatorsOf(locale);
  const clean = text.replace(CURRENCY_SYMBOLS, '').replace(SPACES, '');
  if (clean === '' || clean.includes('-')) return null;

  const pieces = clean.split(decimal);
  if (pieces.length > 2) return null;
  const [whole_raw = '', fraction = ''] = pieces;
  const whole = group.trim() === '' ? whole_raw : whole_raw.split(group).join('');
  if (!/^\d*$/.test(whole) || !/^\d{0,2}$/.test(fraction)) return null;
  if (whole === '' && fraction === '') return null;

  const cents = Number(whole === '' ? '0' : whole) * 100 + Number(fraction.padEnd(2, '0'));
  return Number.isSafeInteger(cents) ? cents : null;
}

/** Centavos no texto editável do campo, sem símbolo e sem separador de milhar. */
export function formatCentsForInput(cents: number, locale: string): string {
  const { decimal } = separatorsOf(locale);
  const whole = Math.trunc(cents / 100);
  const fraction = String(cents % 100).padStart(2, '0');
  return `${String(whole)}${decimal}${fraction}`;
}
