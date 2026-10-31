import { describe, expect, it, vi } from 'vitest';
import { handleNotificationClick, handlePush } from './handle-push';

describe('handlePush', () => {
  it('shows the pushed reminder with its tag', async () => {
    const showNotification = vi.fn(() => Promise.resolve());

    await handlePush(
      { reminder_id: 'r1', title: 'Beber água', fire_at: '2026-11-05T12:01:00Z' },
      { showNotification },
    );

    expect(showNotification).toHaveBeenCalledWith('Beber água', {
      tag: 'r1:2026-11-05T12:01:00Z',
      data: { path: '/reminders' },
    });
  });

  it('ignores an invalid push payload', async () => {
    const showNotification = vi.fn(() => Promise.resolve());

    await handlePush(null, { showNotification });
    await handlePush({ title: 'Sem id' }, { showNotification });
    await handlePush({ reminder_id: 'r1', title: '', fire_at: 'x' }, { showNotification });

    expect(showNotification).not.toHaveBeenCalled();
  });
});

describe('handleNotificationClick', () => {
  it('focuses or opens the app on click', async () => {
    const close = vi.fn();
    const focus = vi.fn(() => Promise.resolve());
    const openWindow = vi.fn(() => Promise.resolve());

    await handleNotificationClick(
      { notification: { close, data: { path: '/reminders' } } },
      { matchAll: () => Promise.resolve([{ focus }]), openWindow },
    );
    expect(close).toHaveBeenCalled();
    expect(focus).toHaveBeenCalled();
    expect(openWindow).not.toHaveBeenCalled();

    await handleNotificationClick(
      { notification: { close, data: { path: '/reminders' } } },
      { matchAll: () => Promise.resolve([]), openWindow },
    );
    expect(openWindow).toHaveBeenCalledWith('/reminders');
  });
});
