import { describe, expect, it } from 'vitest';
import { encodeQr } from './qr-encoder';

const OTPAUTH = 'otpauth://totp/Atria:ana@exemplo.com?secret=JBSWY3DPEHPK3PXP&issuer=Atria';

function finderAt(modules: boolean[][], row: number, col: number): string {
  return [0, 1, 2, 3, 4, 5, 6]
    .map((dr) =>
      [0, 1, 2, 3, 4, 5, 6].map((dc) => (modules[row + dr]?.[col + dc] ? '#' : '.')).join(''),
    )
    .join('/');
}

describe('encodeQr', () => {
  it('draws the three finder patterns of a square symbol', () => {
    const modules = encodeQr(OTPAUTH);
    const size = modules.length;
    const finder = '#######/#.....#/#.###.#/#.###.#/#.###.#/#.....#/#######';
    expect((size - 17) % 4).toBe(0);
    expect(modules.every((line) => line.length === size)).toBe(true);
    expect(finderAt(modules, 0, 0)).toBe(finder);
    expect(finderAt(modules, 0, size - 7)).toBe(finder);
    expect(finderAt(modules, size - 7, 0)).toBe(finder);
  });

  it('is deterministic for the same text', () => {
    expect(encodeQr(OTPAUTH)).toEqual(encodeQr(OTPAUTH));
  });

  it('grows the symbol with the payload', () => {
    expect(encodeQr('x'.repeat(150)).length).toBeGreaterThan(encodeQr('x').length);
  });

  it('refuses a payload that does not fit', () => {
    expect(() => encodeQr('x'.repeat(400))).toThrow('qr_payload_too_long');
  });
});
