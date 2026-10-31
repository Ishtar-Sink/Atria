export type PeriodPreset =
  'this_month' | 'last_month' | 'next_30_days' | 'last_30_days' | 'this_year' | 'all';

export interface PeriodValue {
  preset: PeriodPreset | 'custom';
  from?: string;
  to?: string;
}

export interface PeriodRange {
  from: string;
  to: string;
}

const pad = (n: number) => String(n).padStart(2, '0');

function iso(date: Date): string {
  return `${String(date.getFullYear())}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parse(value: string): Date {
  const [y = 1970, m = 1, d = 1] = value.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Intervalo de um período a partir de hoje (`YYYY-MM-DD`); `null` em `all`. */
export function resolvePeriod(value: PeriodValue, today: string): PeriodRange | null {
  const d = parse(today);
  const y = d.getFullYear();
  const m = d.getMonth();
  switch (value.preset) {
    case 'all':
      return null;
    case 'custom':
      return { from: value.from ?? today, to: value.to ?? value.from ?? today };
    case 'last_month':
      return { from: iso(new Date(y, m - 1, 1)), to: iso(new Date(y, m, 0)) };
    case 'next_30_days':
      return { from: today, to: iso(new Date(y, m, d.getDate() + 30)) };
    case 'last_30_days':
      return { from: iso(new Date(y, m, d.getDate() - 30)), to: today };
    case 'this_year':
      return { from: `${String(y)}-01-01`, to: `${String(y)}-12-31` };
    case 'this_month':
      return { from: iso(new Date(y, m, 1)), to: iso(new Date(y, m + 1, 0)) };
  }
}
