import { describe, expect, it } from 'vitest';
import { readingScale } from './pdf-viewer';

describe('readingScale', () => {
  it('uses the reading width at 100 percent on a wide stage', () => {
    expect(readingScale(1888, 600, 1, 960)).toBeCloseTo(1.6);
  });

  it('fits the stage on a narrow screen', () => {
    expect(readingScale(360, 600, 1, 960)).toBeCloseTo((360 - 32) / 600);
  });

  it('scales a small pdf up to the reading width', () => {
    expect(readingScale(1888, 300, 1, 960)).toBeCloseTo(3.2);
  });

  it('keeps the other zoom levels relative to the reading width', () => {
    expect(readingScale(1888, 600, 1.5, 960)).toBeCloseTo(2.4);
  });

  it('falls back to the zoom before the stage is measured', () => {
    expect(readingScale(0, 600, 1.25, 960)).toBe(1.25);
    expect(readingScale(0, 600, 0.05, 960)).toBe(0.1);
  });
});
