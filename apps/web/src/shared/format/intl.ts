// Formatadores de Intl são caros de criar: ficam em cache por locale e opções.
const cache = new Map<string, Intl.NumberFormat | Intl.DateTimeFormat>();

function numberFormat(locale: string, options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = `n|${locale}|${JSON.stringify(options)}`;
  let found = cache.get(key);
  if (found === undefined) {
    found = new Intl.NumberFormat(locale, options);
    cache.set(key, found);
  }
  return found as Intl.NumberFormat;
}

function dateFormat(locale: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `d|${locale}|${JSON.stringify(options)}`;
  let found = cache.get(key);
  if (found === undefined) {
    found = new Intl.DateTimeFormat(locale, options);
    cache.set(key, found);
  }
  return found as Intl.DateTimeFormat;
}

/** Dinheiro é inteiro em centavos ([project/code-style-05]). */
export function formatMoney(cents: number, currency: string, locale: string): string {
  return numberFormat(locale, { style: 'currency', currency }).format(cents / 100);
}

export function formatNumber(value: number, locale: string): string {
  return numberFormat(locale, {}).format(value);
}

/** Recebe a fração (0,25 = 25%) e mostra uma casa decimal. */
export function formatPercent(fraction: number, locale: string): string {
  return numberFormat(locale, {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(fraction);
}

/** O instante chega em UTC e só aqui vira o fuso do usuário ([project/code-style-06]). */
export function formatDate(iso: string, locale: string, time_zone: string): string {
  return dateFormat(locale, { dateStyle: 'medium', timeZone: time_zone }).format(new Date(iso));
}

export function formatDateTime(iso: string, locale: string, time_zone: string): string {
  return dateFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: time_zone,
  }).format(new Date(iso));
}
