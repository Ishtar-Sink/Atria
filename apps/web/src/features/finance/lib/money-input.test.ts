import { describe, expect, it } from 'vitest';
import { parseMoneyToCents } from './money-input';

describe('parseMoneyToCents', () => {
  it('reads thousands separator and decimal comma in pt-BR', () => {
    expect(parseMoneyToCents('1.500,00', 'pt-BR')).toBe(150000);
  });

  it('reads an integer amount', () => {
    expect(parseMoneyToCents('1500', 'pt-BR')).toBe(150000);
  });

  it('reads a single decimal digit', () => {
    expect(parseMoneyToCents('0,5', 'pt-BR')).toBe(50);
  });

  it('refuses more than two decimal digits', () => {
    expect(parseMoneyToCents('1,234', 'pt-BR')).toBeNull();
  });

  it('refuses negative amounts', () => {
    expect(parseMoneyToCents('-10', 'pt-BR')).toBeNull();
  });

  it('refuses empty and non numeric text', () => {
    expect(parseMoneyToCents('', 'pt-BR')).toBeNull();
    expect(parseMoneyToCents('abc', 'pt-BR')).toBeNull();
    expect(parseMoneyToCents('1,2,3', 'pt-BR')).toBeNull();
  });

  it('uses the separators of the locale', () => {
    expect(parseMoneyToCents('1,500.25', 'en-US')).toBe(150025);
  });

  it('ignores spaces and the currency symbol', () => {
    expect(parseMoneyToCents('R$ 12,30', 'pt-BR')).toBe(1230);
  });
});
