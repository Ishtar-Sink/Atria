import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HIDDEN_BLOCKS_KEY, useHiddenBlocks } from './use-hidden-blocks';

const KEY = `${HIDDEN_BLOCKS_KEY}.u1`;

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useHiddenBlocks', () => {
  it('reads the hidden blocks saved by the dashboard settings', () => {
    localStorage.setItem(KEY, JSON.stringify(['journal', 'balance']));
    const { result } = renderHook(() => useHiddenBlocks('u1'));
    expect(result.current.hidden).toEqual(['journal', 'balance']);
    expect(result.current.isHidden('journal')).toBe(true);
    expect(result.current.isHidden('today')).toBe(false);
  });

  it('keeps a block hidden after remount', () => {
    localStorage.setItem(KEY, JSON.stringify(['reading']));
    const first = renderHook(() => useHiddenBlocks('u1'));
    first.unmount();
    const second = renderHook(() => useHiddenBlocks('u1'));
    expect(second.result.current.isHidden('reading')).toBe(true);
  });

  it('follows a change made in another tab', () => {
    const { result } = renderHook(() => useHiddenBlocks('u1'));
    expect(result.current.hidden).toEqual([]);
    act(() => {
      localStorage.setItem(KEY, JSON.stringify(['upcoming']));
      window.dispatchEvent(new StorageEvent('storage', { key: KEY }));
    });
    expect(result.current.isHidden('upcoming')).toBe(true);
  });

  it('ignores unknown ids and invalid json from storage', () => {
    localStorage.setItem(KEY, JSON.stringify(['goals', 'today', 7]));
    const known = renderHook(() => useHiddenBlocks('u1'));
    expect(known.result.current.hidden).toEqual(['today']);
    localStorage.setItem(KEY, '{not json');
    const broken = renderHook(() => useHiddenBlocks('u1'));
    expect(broken.result.current.hidden).toEqual([]);
  });

  it('shows every block when storage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const { result } = renderHook(() => useHiddenBlocks('u1'));
    expect(result.current.hidden).toEqual([]);
  });
});
