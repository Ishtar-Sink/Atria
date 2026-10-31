import { describe, expect, it } from 'vitest';
import { artPalettes, paletteFor } from './palette';

describe('paletteFor', () => {
  it('returns the same pair for the same seed', () => {
    expect(paletteFor('item-1')).toEqual(paletteFor('item-1'));
  });

  it('returns a pair from artPalettes', () => {
    expect(artPalettes).toContainEqual(paletteFor('qualquer-id'));
  });
});
