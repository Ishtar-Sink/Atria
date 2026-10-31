import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useReminderScheduler, type UpcomingFire } from './use-reminder-scheduler';

const NOW = new Date('2026-11-05T12:00:00Z');
const FIRE: UpcomingFire = {
  reminder_id: 'r1',
  title: 'Beber água',
  fire_at: '2026-11-05T12:01:00Z',
};

let upcoming: UpcomingFire[] = [];
let fetches = 0;

function fakeNotification(permission: NotificationPermission) {
  const created: { title: string; options: NotificationOptions | undefined }[] = [];
  const FakeNotification = Object.assign(
    function FakeNotification(title: string, options?: NotificationOptions) {
      created.push({ title, options });
    },
    { permission },
  );
  vi.stubGlobal('Notification', FakeNotification);
  return created;
}

function mount(showInApp = vi.fn()) {
  const view = renderHook(() => {
    useReminderScheduler({ now: () => new Date(Date.now()), showInApp });
  });
  return { ...view, showInApp };
}

async function flush() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
}

beforeEach(() => {
  vi.useFakeTimers({ now: NOW });
  upcoming = [FIRE];
  fetches = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn(() => {
      fetches += 1;
      return Promise.resolve(
        new Response(JSON.stringify({ items: upcoming }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    }),
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('useReminderScheduler', () => {
  it('notifies a reminder one minute from now with the tab open', async () => {
    const created = fakeNotification('granted');
    const { showInApp } = mount();
    await flush();
    expect(created).toHaveLength(0);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });

    expect(created).toHaveLength(1);
    expect(created[0]?.title).toBe('Beber água');
    expect(showInApp).not.toHaveBeenCalled();
  });

  it('does not notify the same occurrence twice', async () => {
    const created = fakeNotification('granted');
    mount();
    await flush();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(created).toHaveLength(1);

    // A consulta seguinte ainda devolve a mesma ocorrência.
    upcoming = [{ ...FIRE, fire_at: '2026-11-05T12:01:00Z' }];
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15 * 60_000);
    });

    expect(fetches).toBeGreaterThan(1);
    expect(created).toHaveLength(1);
  });

  it('uses reminder id and fire time as notification tag', async () => {
    const created = fakeNotification('granted');
    mount();
    await flush();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });

    expect(created[0]?.options?.tag).toBe('r1:2026-11-05T12:01:00Z');
  });

  it('shows the reminder inside the app when permission is denied', async () => {
    const created = fakeNotification('denied');
    const { showInApp } = mount();
    await flush();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });

    expect(created).toHaveLength(0);
    expect(showInApp).toHaveBeenCalledTimes(1);
    expect(showInApp).toHaveBeenCalledWith(FIRE);
  });

  it('refetches when the tab becomes visible', async () => {
    fakeNotification('granted');
    mount();
    await flush();
    const before = fetches;

    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(fetches).toBe(before + 1);
  });

  it('cancels the timers on unmount', async () => {
    const created = fakeNotification('granted');
    const { unmount } = mount();
    await flush();
    unmount();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(120_000);
    });

    expect(created).toHaveLength(0);
  });
});
