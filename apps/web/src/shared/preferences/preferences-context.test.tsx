import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PreferencesProvider, usePreferences } from './preferences-context';

function wrapper(user_id?: string) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <PreferencesProvider {...(user_id ? { user_id } : {})}>{children}</PreferencesProvider>;
  };
}

let current_id: string | undefined;

afterEach(() => {
  current_id = undefined;
  vi.restoreAllMocks();
});

describe('usePreferences', () => {
  it('defaults the create layout to grid', () => {
    const { result } = renderHook(() => usePreferences(), { wrapper: wrapper('u1') });
    expect(result.current.create_layout).toBe('grid');
  });

  it('reads the saved create layout of the current user', () => {
    localStorage.setItem('atria.settings.create_layout.u1', 'list');
    const { result } = renderHook(() => usePreferences(), { wrapper: wrapper('u1') });
    expect(result.current.create_layout).toBe('list');
  });

  it('saves the create layout under the user key', () => {
    const { result } = renderHook(() => usePreferences(), { wrapper: wrapper('u1') });
    act(() => {
      result.current.set_create_layout('list');
    });
    expect(result.current.create_layout).toBe('list');
    expect(localStorage.getItem('atria.settings.create_layout.u1')).toBe('list');
  });

  it('keeps the create layout per user', () => {
    localStorage.setItem('atria.settings.create_layout.u1', 'list');
    const { result } = renderHook(() => usePreferences(), { wrapper: wrapper('u2') });
    expect(result.current.create_layout).toBe('grid');
  });

  it('reads the layout again when the user arrives after the first render', () => {
    localStorage.setItem('atria.settings.create_layout.u1', 'list');
    function Dynamic({ children }: { children: ReactNode }) {
      return <PreferencesProvider user_id={current_id}>{children}</PreferencesProvider>;
    }
    const { result, rerender } = renderHook(() => usePreferences(), { wrapper: Dynamic });
    expect(result.current.create_layout).toBe('grid');
    current_id = 'u1';
    rerender();
    expect(result.current.create_layout).toBe('list');
  });

  it('falls back to grid when the saved value is invalid', () => {
    localStorage.setItem('atria.settings.create_layout.u1', 'cards');
    const { result } = renderHook(() => usePreferences(), { wrapper: wrapper('u1') });
    expect(result.current.create_layout).toBe('grid');
  });

  it('falls back to grid when localStorage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const { result } = renderHook(() => usePreferences(), { wrapper: wrapper('u1') });
    expect(result.current.create_layout).toBe('grid');
    act(() => {
      result.current.set_create_layout('list');
    });
    expect(result.current.create_layout).toBe('list');
  });

  it('does not save without a known user', () => {
    const { result } = renderHook(() => usePreferences(), { wrapper: wrapper() });
    act(() => {
      result.current.set_create_layout('list');
    });
    expect(result.current.create_layout).toBe('list');
    expect(localStorage.length).toBe(0);
  });

  it('keeps the other defaults', () => {
    const { result } = renderHook(() => usePreferences(), { wrapper: wrapper('u1') });
    expect(result.current.locale).toBe('pt-BR');
    expect(result.current.time_zone).toBe('America/Sao_Paulo');
  });

  it('follows a change made in another tab through the storage event', () => {
    const { result } = renderHook(() => usePreferences(), { wrapper: wrapper('u1') });
    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', { key: 'atria.settings.create_layout.u1', newValue: 'list' }),
      );
    });
    expect(result.current.create_layout).toBe('list');
    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', { key: 'atria.settings.create_layout.u1', newValue: null }),
      );
    });
    expect(result.current.create_layout).toBe('grid');
  });

  it('ignores storage events of other keys and of other users', () => {
    const { result } = renderHook(() => usePreferences(), { wrapper: wrapper('u1') });
    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', { key: 'atria.settings.create_layout.u2', newValue: 'list' }),
      );
      window.dispatchEvent(new StorageEvent('storage', { key: 'other', newValue: 'list' }));
    });
    expect(result.current.create_layout).toBe('grid');
  });
});
