import { describe, expect, it } from 'vitest';
import { formatDateTime, formatMoney, formatPercent } from './intl';

describe('format', () => {
  it('formats cents as BRL in pt-BR', () => {
    expect(formatMoney(150000, 'BRL', 'pt-BR')).toContain('1.500,00');
  });

  it('formats UTC instants in the user time zone', () => {
    const iso = '2026-03-10T02:30:00Z';
    expect(formatDateTime(iso, 'pt-BR', 'America/Sao_Paulo')).toContain('9 de mar');
    expect(formatDateTime(iso, 'pt-BR', 'UTC')).toContain('10 de mar');
  });

  it('formats percent with one decimal', () => {
    expect(formatPercent(0.255, 'pt-BR')).toContain('25,5');
  });
});
