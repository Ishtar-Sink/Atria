import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { forgetListLocations, rememberListLocation, useBackTarget } from './back-target';

beforeEach(() => {
  forgetListLocations();
  sessionStorage.clear();
});

describe('useBackTarget', () => {
  it('returns to the last list with its tab and filters', () => {
    rememberListLocation('finance', '/finance?tab=accounts&filter=x');
    const { result } = renderHook(() =>
      useBackTarget({ module: 'finance', fallback_to: '/finance/accounts' }),
    );
    expect(result.current).toBe('/finance?tab=accounts&filter=x');
  });

  it('returns to the dashboard when the item was opened there', () => {
    rememberListLocation('finance', '/finance?tab=accounts');
    rememberListLocation('finance', '/finance/dashboard?period=year');
    const { result } = renderHook(() =>
      useBackTarget({ module: 'finance', fallback_to: '/finance/accounts' }),
    );
    expect(result.current).toBe('/finance/dashboard?period=year');
  });

  it('falls back to the list of the type without history', () => {
    const { result } = renderHook(() =>
      useBackTarget({ module: 'finance', fallback_to: '/finance/accounts' }),
    );
    expect(result.current).toBe('/finance/accounts');
  });

  it('uses the explicit target on the edit screen', () => {
    rememberListLocation('finance', '/finance?tab=accounts');
    const { result } = renderHook(() =>
      useBackTarget({
        module: 'finance',
        fallback_to: '/finance/accounts',
        to: '/finance/accounts/1',
      }),
    );
    expect(result.current).toBe('/finance/accounts/1');
  });

  it('recovers the origin from the session after a reload', () => {
    rememberListLocation('library', '/library?tab=books');
    forgetListLocations({ keep_session: true });
    const { result } = renderHook(() =>
      useBackTarget({ module: 'library', fallback_to: '/library' }),
    );
    expect(result.current).toBe('/library?tab=books');
  });
});
