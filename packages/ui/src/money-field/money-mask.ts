// Dinheiro é sempre inteiro em centavos (RN-09); esta máscara é só de exibição: o texto formatado
// nunca é gravado, só o valor em centavos que `parseMoneyInput` extrai dele.

interface Affixes {
  prefix: string;
  suffix: string;
  group: string;
  decimal: string;
}

const cache = new Map<string, Affixes>();

function affixesOf(locale: string, currency: string): Affixes {
  const key = `${locale}|${currency}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const format = new Intl.NumberFormat(locale, { style: 'currency', currency });
  const parts = format.formatToParts(1);
  const firstInteger = parts.findIndex((part) => part.type === 'integer');
  let lastNumber = firstInteger;
  parts.forEach((part, index) => {
    if (part.type === 'integer' || part.type === 'fraction') lastNumber = index;
  });
  const sample = format.formatToParts(1234567.5);
  const found: Affixes = {
    prefix: parts
      .slice(0, firstInteger)
      .map((part) => part.value)
      .join(''),
    suffix: parts
      .slice(lastNumber + 1)
      .map((part) => part.value)
      .join(''),
    group: sample.find((part) => part.type === 'group')?.value ?? '',
    decimal: sample.find((part) => part.type === 'decimal')?.value ?? ',',
  };
  cache.set(key, found);
  return found;
}

function strip(text: string, a: Affixes): string {
  let out = text;
  if (a.prefix.trim() !== '') out = out.split(a.prefix.trim()).join('');
  if (a.suffix.trim() !== '') out = out.split(a.suffix.trim()).join('');
  return out;
}

function split(text: string, a: Affixes): { whole: string; fraction: string; hasDecimal: boolean } {
  const body = strip(text, a);
  const at = body.lastIndexOf(a.decimal);
  const hasDecimal = at >= 0;
  const wholeRaw = hasDecimal ? body.slice(0, at) : body;
  const fractionRaw = hasDecimal ? body.slice(at + a.decimal.length) : '';
  return {
    whole: wholeRaw.replace(/\D/g, '').replace(/^0+/, ''),
    fraction: fractionRaw.replace(/\D/g, '').slice(0, 2),
    hasDecimal,
  };
}

export function maskMoneyInput(text: string, locale: string, currency: string): string {
  const a = affixesOf(locale, currency);
  const { whole, fraction, hasDecimal } = split(text, a);
  if (whole === '' && fraction === '' && !hasDecimal) return '';
  const grouped = (whole === '' ? '0' : whole).replace(/\B(?=(\d{3})+(?!\d))/g, a.group);
  return `${a.prefix}${grouped}${hasDecimal ? a.decimal + fraction : ''}${a.suffix}`;
}

export function parseMoneyInput(text: string, locale: string, currency: string): number | null {
  const a = affixesOf(locale, currency);
  const { whole, fraction } = split(text, a);
  if (whole === '' && fraction === '') return null;
  const cents = Number(whole === '' ? '0' : whole) * 100 + Number(fraction.padEnd(2, '0'));
  return Number.isSafeInteger(cents) ? cents : null;
}

export function formatCents(cents: number, locale: string, currency: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}
