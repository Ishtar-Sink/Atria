import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { bookProgressPercent, formatBookPercent, useBookProgress } from './use-book-progress';

describe('book progress', () => {
  it('sums the registered pages over the total', () => {
    const { result } = renderHook(() =>
      useBookProgress(200, [{ pages_read: 25 }, { pages_read: 30 }]),
    );
    expect(result.current.pages_read).toBe(55);
    expect(result.current.percent).toBe(27.5);
    expect(result.current.label).toBe('27,5%');
  });

  it('caps the progress at 100 percent', () => {
    expect(bookProgressPercent(200, 260)).toBe(100);
    const { result } = renderHook(() => useBookProgress(100, [{ pages_read: 150 }]));
    expect(result.current.percent).toBe(100);
    expect(result.current.label).toBe('100%');
  });

  it('formats the percentage with Intl in the user locale', () => {
    expect(formatBookPercent(27.5, 'pt-BR')).toBe('27,5%');
    expect(formatBookPercent(27.5, 'en-US')).toBe('27.5%');
    expect(formatBookPercent(50, 'pt-BR')).toBe('50%');
  });

  it('has no progress without the total of pages', () => {
    expect(bookProgressPercent(null, 40)).toBeNull();
    expect(bookProgressPercent(0, 40)).toBeNull();
    const { result } = renderHook(() => useBookProgress(undefined, [{ pages_read: 40 }]));
    expect(result.current.percent).toBeNull();
    expect(result.current.label).toBeNull();
  });
});
