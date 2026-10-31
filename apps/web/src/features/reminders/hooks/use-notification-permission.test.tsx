import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useNotificationPermission } from './use-notification-permission';

function fakeNotification(permission: NotificationPermission) {
  const state = { permission };
  const requestPermission = vi.fn(() => {
    state.permission = 'granted';
    return Promise.resolve('granted' as NotificationPermission);
  });
  vi.stubGlobal('Notification', {
    get permission() {
      return state.permission;
    },
    requestPermission,
  });
  return requestPermission;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useNotificationPermission', () => {
  it('never asks for permission on mount', () => {
    const request = fakeNotification('default');
    const { result } = renderHook(() => useNotificationPermission());

    expect(result.current.status).toBe('default');
    expect(request).not.toHaveBeenCalled();
  });

  it('asks only when the person clicks', async () => {
    const request = fakeNotification('default');
    const { result } = renderHook(() => useNotificationPermission());

    await act(async () => {
      await result.current.request();
    });

    expect(request).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe('granted');
  });

  it('does not ask again when denied', async () => {
    const request = fakeNotification('denied');
    const { result } = renderHook(() => useNotificationPermission());

    await act(async () => {
      await result.current.request();
    });

    expect(request).not.toHaveBeenCalled();
    expect(result.current.status).toBe('denied');
  });

  it('reports unsupported browsers', () => {
    const original = Object.getOwnPropertyDescriptor(window, 'Notification');
    Reflect.deleteProperty(window, 'Notification');
    try {
      const { result } = renderHook(() => useNotificationPermission());
      expect(result.current.status).toBe('unsupported');
    } finally {
      if (original) Object.defineProperty(window, 'Notification', original);
    }
  });
});
