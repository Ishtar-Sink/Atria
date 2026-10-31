import { describe, expect, it } from 'vitest';
import { contrastRatio } from './contrast';
import { dark, light } from './tokens';

const themes = { light, dark } as const;

function ratio(theme: keyof typeof themes, fg: keyof typeof light, bg: keyof typeof light): number {
  const t = themes[theme];
  return contrastRatio(t[fg], t[bg]);
}

describe('contrast', () => {
  it('light: text on bg >= 4.5', () => {
    expect(ratio('light', 'text', 'bg')).toBeGreaterThanOrEqual(4.5);
  });

  it('light: text on surface >= 4.5', () => {
    expect(ratio('light', 'text', 'surface')).toBeGreaterThanOrEqual(4.5);
  });

  it('light: textMuted on bg >= 4.5', () => {
    expect(ratio('light', 'textMuted', 'bg')).toBeGreaterThanOrEqual(4.5);
  });

  it('light: textMuted on surface >= 4.5', () => {
    expect(ratio('light', 'textMuted', 'surface')).toBeGreaterThanOrEqual(4.5);
  });

  it('light: primary on bg >= 4.5', () => {
    expect(ratio('light', 'primary', 'bg')).toBeGreaterThanOrEqual(4.5);
  });

  it('light: primary on surface >= 4.5', () => {
    expect(ratio('light', 'primary', 'surface')).toBeGreaterThanOrEqual(4.5);
  });

  it('light: primary on primarySoft >= 4.5', () => {
    expect(ratio('light', 'primary', 'primarySoft')).toBeGreaterThanOrEqual(4.5);
  });

  it('light: accent on bg >= 4.5', () => {
    expect(ratio('light', 'accent', 'bg')).toBeGreaterThanOrEqual(4.5);
  });

  it('light: accent on accentSoft >= 4.5', () => {
    expect(ratio('light', 'accent', 'accentSoft')).toBeGreaterThanOrEqual(4.5);
  });

  it('light: success on successSoft >= 4.5', () => {
    expect(ratio('light', 'success', 'successSoft')).toBeGreaterThanOrEqual(4.5);
  });

  it('light: warning on warningSoft >= 4.5', () => {
    expect(ratio('light', 'warning', 'warningSoft')).toBeGreaterThanOrEqual(4.5);
  });

  it('light: danger on dangerSoft >= 4.5', () => {
    expect(ratio('light', 'danger', 'dangerSoft')).toBeGreaterThanOrEqual(4.5);
  });

  it('light: info on infoSoft >= 4.5', () => {
    expect(ratio('light', 'info', 'infoSoft')).toBeGreaterThanOrEqual(4.5);
  });

  it('light: primaryOn on primary >= 4.5', () => {
    expect(ratio('light', 'primaryOn', 'primary')).toBeGreaterThanOrEqual(4.5);
  });

  it('dark: text on bg >= 4.5', () => {
    expect(ratio('dark', 'text', 'bg')).toBeGreaterThanOrEqual(4.5);
  });

  it('dark: text on surface >= 4.5', () => {
    expect(ratio('dark', 'text', 'surface')).toBeGreaterThanOrEqual(4.5);
  });

  it('dark: textMuted on bg >= 4.5', () => {
    expect(ratio('dark', 'textMuted', 'bg')).toBeGreaterThanOrEqual(4.5);
  });

  it('dark: textMuted on surface >= 4.5', () => {
    expect(ratio('dark', 'textMuted', 'surface')).toBeGreaterThanOrEqual(4.5);
  });

  it('dark: primary on bg >= 4.5', () => {
    expect(ratio('dark', 'primary', 'bg')).toBeGreaterThanOrEqual(4.5);
  });

  it('dark: primary on surface >= 4.5', () => {
    expect(ratio('dark', 'primary', 'surface')).toBeGreaterThanOrEqual(4.5);
  });

  it('dark: primary on primarySoft >= 4.5', () => {
    expect(ratio('dark', 'primary', 'primarySoft')).toBeGreaterThanOrEqual(4.5);
  });

  it('dark: accent on surface >= 4.5', () => {
    expect(ratio('dark', 'accent', 'surface')).toBeGreaterThanOrEqual(4.5);
  });

  it('dark: success on successSoft >= 4.5', () => {
    expect(ratio('dark', 'success', 'successSoft')).toBeGreaterThanOrEqual(4.5);
  });

  it('dark: warning on warningSoft >= 4.5', () => {
    expect(ratio('dark', 'warning', 'warningSoft')).toBeGreaterThanOrEqual(4.5);
  });

  it('dark: danger on dangerSoft >= 4.5', () => {
    expect(ratio('dark', 'danger', 'dangerSoft')).toBeGreaterThanOrEqual(4.5);
  });

  it('dark: info on infoSoft >= 4.5', () => {
    expect(ratio('dark', 'info', 'infoSoft')).toBeGreaterThanOrEqual(4.5);
  });

  it('dark: primaryOn on primary >= 4.5', () => {
    expect(ratio('dark', 'primaryOn', 'primary')).toBeGreaterThanOrEqual(4.5);
  });

  it('textFaint is below 4.5 and only decorative', () => {
    for (const theme of ['light', 'dark'] as const) {
      for (const bg of ['bg', 'surface'] as const) {
        const value = ratio(theme, 'textFaint', bg);
        expect(value).toBeLessThan(4.5);
        expect(value).toBeGreaterThanOrEqual(3);
      }
    }
  });
});
