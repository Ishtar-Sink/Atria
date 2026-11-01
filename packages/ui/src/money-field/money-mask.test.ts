import { formatCents, maskMoneyInput, parseMoneyInput } from './money-mask';

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const prefix = brl.format(0).replace(/0,00$/, '');

describe('money mask', () => {
  it('formats the whole part with thousands while typing', () => {
    expect(maskMoneyInput('14500', 'pt-BR', 'BRL')).toBe(`${prefix}14.500`);
  });

  it('keeps a typed comma and up to two decimals', () => {
    expect(maskMoneyInput('14500,', 'pt-BR', 'BRL')).toBe(`${prefix}14.500,`);
    expect(maskMoneyInput('14500,509', 'pt-BR', 'BRL')).toBe(`${prefix}14.500,50`);
  });

  it('accepts a pasted value with separators', () => {
    expect(maskMoneyInput('14500,5', 'pt-BR', 'BRL')).toBe(`${prefix}14.500,5`);
    expect(maskMoneyInput('R$ 14.500,5', 'pt-BR', 'BRL')).toBe(`${prefix}14.500,5`);
  });

  it('starts with zero when only the comma is typed', () => {
    expect(maskMoneyInput(',', 'pt-BR', 'BRL')).toBe(`${prefix}0,`);
  });

  it('clears when nothing is left', () => {
    expect(maskMoneyInput('', 'pt-BR', 'BRL')).toBe('');
    expect(maskMoneyInput('R$ ', 'pt-BR', 'BRL')).toBe('');
  });

  it('converts to integer cents', () => {
    expect(parseMoneyInput('R$ 14.500', 'pt-BR', 'BRL')).toBe(1450000);
    expect(parseMoneyInput('R$ 14.500,5', 'pt-BR', 'BRL')).toBe(1450050);
    expect(parseMoneyInput('', 'pt-BR', 'BRL')).toBeNull();
  });

  it('formats cents with two decimals', () => {
    expect(formatCents(1450050, 'pt-BR', 'BRL')).toBe(brl.format(14500.5));
  });
});
