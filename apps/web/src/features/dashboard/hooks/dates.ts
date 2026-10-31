/** Datas do dashboard: tudo calculado no fuso do usuário, a partir do relógio da página. */

const PARTS = new Map<string, Intl.DateTimeFormat>();

function formatter(time_zone: string): Intl.DateTimeFormat {
  let found = PARTS.get(time_zone);
  if (found === undefined) {
    found = new Intl.DateTimeFormat('en-CA', {
      timeZone: time_zone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    PARTS.set(time_zone, found);
  }
  return found;
}

function partsOf(date: Date, time_zone: string) {
  const out: Record<string, number> = {};
  for (const part of formatter(time_zone).formatToParts(date)) {
    if (part.type !== 'literal') out[part.type] = Number(part.value);
  }
  return {
    year: out['year'] ?? 1970,
    month: out['month'] ?? 1,
    day: out['day'] ?? 1,
    hour: out['hour'] ?? 0,
    minute: out['minute'] ?? 0,
    second: out['second'] ?? 0,
  };
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** `AAAA-MM-DD` do instante no fuso. */
export function localDate(date: Date, time_zone: string): string {
  const p = partsOf(date, time_zone);
  return `${String(p.year)}-${pad(p.month)}-${pad(p.day)}`;
}

export function localHour(date: Date, time_zone: string): number {
  return partsOf(date, time_zone).hour;
}

function utcMs(ymd: string): number {
  const [y, m, d] = ymd.split('-').map(Number);
  return Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

export function addDays(ymd: string, days: number): string {
  return new Date(utcMs(ymd) + days * 86_400_000).toISOString().slice(0, 10);
}

/** Primeiro instante (UTC) do dia local. */
export function startOfDayUtc(ymd: string, time_zone: string): Date {
  let guess = utcMs(ymd);
  for (let i = 0; i < 2; i += 1) {
    const p = partsOf(new Date(guess), time_zone);
    const shown = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    const wanted = utcMs(ymd);
    guess -= shown - wanted;
  }
  return new Date(guess);
}

/** Último instante (UTC) do dia local. */
export function endOfDayUtc(ymd: string, time_zone: string): Date {
  return new Date(startOfDayUtc(addDays(ymd, 1), time_zone).getTime() - 1);
}

export interface MonthRange {
  /** Dia 1 do mês, `AAAA-MM-DD`. */
  from: string;
  /** Último dia do mês. */
  to: string;
}

export function monthOf(ymd: string, offset = 0): MonthRange {
  const [y, m] = ymd.split('-').map(Number);
  const first = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1 + offset, 1));
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0));
  return { from: first.toISOString().slice(0, 10), to: last.toISOString().slice(0, 10) };
}
