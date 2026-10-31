import { hexToRgb, hslToRgb, rgbToHex, rgbToHsl } from './color';

describe('color', () => {
  it('converts between HEX, RGB and HSL', () => {
    const rgb = hexToRgb('#7C3AED');
    expect(rgb).toEqual([124, 58, 237]);
    const [h, s, l] = rgbToHsl(...(rgb as [number, number, number]));
    expect([h, s, l]).toEqual([262, 83, 58]);
    // O HSL inteiro perde precisão: a volta fica a 1 de distância por canal.
    const back = hslToRgb(h, s, l);
    back.forEach((channel, i) => {
      expect(Math.abs(channel - ((rgb as number[])[i] ?? 0))).toBeLessThanOrEqual(1);
    });
    expect(rgbToHex(rgb as number[])).toBe('#7C3AED');
    expect(rgbToHex([124, 58, 237])).toBe('#7C3AED');
  });

  it('accepts 3 and 6 digit HEX with or without #', () => {
    expect(hexToRgb('abc')).toEqual([170, 187, 204]);
    expect(hexToRgb('#AABBCC')).toEqual([170, 187, 204]);
    expect(hexToRgb(' #fff ')).toEqual([255, 255, 255]);
  });

  it('rejects invalid HEX', () => {
    expect(hexToRgb('#12')).toBeNull();
    expect(hexToRgb('#ggg')).toBeNull();
    expect(hexToRgb('')).toBeNull();
  });
});
