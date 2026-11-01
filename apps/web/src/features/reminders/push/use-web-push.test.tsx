import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useWebPush } from './use-web-push';

interface Call {
  method: string;
  path: string;
  body: unknown;
}

let calls: Call[] = [];
let web_push_on = true;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function installFetch() {
  calls = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((input: string, init?: RequestInit) => {
      const call: Call = {
        method: init?.method ?? 'GET',
        path: new URL(input, 'http://localhost').pathname.replace('/api/v1', ''),
        body: typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : undefined,
      };
      calls.push(call);
      if (call.path === '/web-push/public-key') {
        return Promise.resolve(
          web_push_on
            ? json({ public_key: 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9' })
            : json({ code: 'web_push_disabled', title: 'x' }, 404),
        );
      }
      if (call.method === 'POST' && call.path === '/push-subscriptions') {
        return Promise.resolve(
          json({ id: 'sub-1', endpoint: 'https://push.example/1', created_at: '2026-11-05' }, 201),
        );
      }
      if (call.method === 'DELETE') return Promise.resolve(new Response(null, { status: 204 }));
      return Promise.resolve(json({ code: 'not_found', title: 'x' }, 404));
    }),
  );
}

function installBrowser(permission: NotificationPermission) {
  const state = { permission };
  vi.stubGlobal('Notification', {
    get permission() {
      return state.permission;
    },
    requestPermission: vi.fn(() => Promise.resolve(state.permission)),
  });
  const unsubscribe = vi.fn(() => Promise.resolve(true));
  const subscription = {
    endpoint: 'https://push.example/1',
    toJSON: () => ({ endpoint: 'https://push.example/1', keys: { p256dh: 'p', auth: 'a' } }),
    unsubscribe,
  };
  const subscribe = vi.fn(() => Promise.resolve(subscription));
  const registration = {
    pushManager: { subscribe, getSubscription: () => Promise.resolve(subscription) },
  };
  const register = vi.fn(() => Promise.resolve(registration));
  Object.defineProperty(navigator, 'serviceWorker', {
    value: { register, getRegistration: () => Promise.resolve(registration) },
    configurable: true,
  });
  vi.stubGlobal('PushManager', function PushManager() {});
  return { register, subscribe, unsubscribe };
}

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(() => useWebPush(), { wrapper });
}

beforeEach(() => {
  web_push_on = true;
  localStorage.clear();
  installFetch();
});

afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, 'serviceWorker');
});

describe('useWebPush', () => {
  it('does nothing when the instance has web push off', async () => {
    web_push_on = false;
    const browser = installBrowser('granted');
    const { result } = setup();

    await waitFor(() => {
      expect(calls.some((call) => call.path === '/web-push/public-key')).toBe(true);
    });
    expect(result.current.available).toBe(false);
    await act(async () => {
      await result.current.subscribe();
    });

    expect(browser.register).not.toHaveBeenCalled();
    expect(calls.some((call) => call.path === '/push-subscriptions')).toBe(false);
  });

  it('reports disabled when the instance has web push off', async () => {
    web_push_on = false;
    installBrowser('granted');
    const { result } = setup();

    await waitFor(() => {
      expect(result.current.unavailable_reason).toBe('disabled');
    });
    expect(result.current.available).toBe(false);
  });

  it('reports unsupported when the browser has no push manager', () => {
    installBrowser('granted');
    Reflect.deleteProperty(window, 'PushManager');
    const { result } = setup();

    expect(result.current.unavailable_reason).toBe('unsupported');
    expect(result.current.available).toBe(false);
    expect(calls.some((call) => call.path === '/web-push/public-key')).toBe(false);
  });

  it('subscribes after the person turns it on', async () => {
    const browser = installBrowser('granted');
    const { result } = setup();
    await waitFor(() => {
      expect(result.current.available).toBe(true);
    });
    expect(result.current.unavailable_reason).toBeNull();
    // Nada é registrado antes da ação da pessoa.
    expect(browser.register).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.subscribe();
    });

    expect(browser.register).toHaveBeenCalledTimes(1);
    const options = (browser.subscribe.mock.calls as unknown[][])[0]?.[0] as {
      userVisibleOnly: boolean;
      applicationServerKey: Uint8Array;
    };
    expect(options.userVisibleOnly).toBe(true);
    expect(options.applicationServerKey).toBeInstanceOf(Uint8Array);
    const post = calls.find((call) => call.method === 'POST');
    expect(post?.body).toEqual({
      endpoint: 'https://push.example/1',
      keys: { p256dh: 'p', auth: 'a' },
    });
    expect(result.current.subscribed).toBe(true);
  });

  it('does not subscribe when permission is denied', async () => {
    const browser = installBrowser('denied');
    const { result } = setup();
    await waitFor(() => {
      expect(result.current.available).toBe(true);
    });

    await act(async () => {
      await result.current.subscribe();
    });

    expect(browser.register).not.toHaveBeenCalled();
    expect(calls.some((call) => call.path === '/push-subscriptions')).toBe(false);
    expect(result.current.subscribed).toBe(false);
  });

  it('unsubscribes in the browser and on the server', async () => {
    const browser = installBrowser('granted');
    const { result } = setup();
    await waitFor(() => {
      expect(result.current.available).toBe(true);
    });
    await act(async () => {
      await result.current.subscribe();
    });

    await act(async () => {
      await result.current.unsubscribe();
    });

    expect(browser.unsubscribe).toHaveBeenCalled();
    expect(
      calls.some((call) => call.method === 'DELETE' && call.path === '/push-subscriptions/sub-1'),
    ).toBe(true);
    expect(result.current.subscribed).toBe(false);
  });
});
