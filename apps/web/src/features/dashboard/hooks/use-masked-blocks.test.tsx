import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MASKED_BLOCKS_KEY, useMaskedBlocks } from './use-masked-blocks';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useMaskedBlocks', () => {
  it('masks a sensitive block and remembers it after remount', () => {
    const first = renderHook(() => useMaskedBlocks('u1'));
    expect(first.result.current.isMasked('balance')).toBe(false);
    act(() => {
      first.result.current.toggleMask('balance');
    });
    expect(first.result.current.isMasked('balance')).toBe(true);
    expect(localStorage.getItem(`${MASKED_BLOCKS_KEY}.u1`)).toBe('["balance"]');
    first.unmount();
    const second = renderHook(() => useMaskedBlocks('u1'));
    expect(second.result.current.isMasked('balance')).toBe(true);
  });

  it('shows a masked block again', () => {
    localStorage.setItem(`${MASKED_BLOCKS_KEY}.u1`, '["journal"]');
    const { result } = renderHook(() => useMaskedBlocks('u1'));
    expect(result.current.isMasked('journal')).toBe(true);
    act(() => {
      result.current.toggleMask('journal');
    });
    expect(result.current.isMasked('journal')).toBe(false);
    expect(localStorage.getItem(`${MASKED_BLOCKS_KEY}.u1`)).toBe('[]');
  });

  it('ignores blocks that are not sensitive', () => {
    const { result } = renderHook(() => useMaskedBlocks('u1'));
    act(() => {
      result.current.toggleMask('today');
    });
    expect(result.current.isMasked('today')).toBe(false);
    expect(localStorage.getItem(`${MASKED_BLOCKS_KEY}.u1`)).toBeNull();
  });

  it('keeps working when storage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const { result } = renderHook(() => useMaskedBlocks('u1'));
    act(() => {
      result.current.toggleMask('balance');
    });
    expect(result.current.isMasked('balance')).toBe(true);
  });
});
