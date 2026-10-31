/** Tratamento puro do evento `push` e do clique, usado pelo service worker (RF-42). */

export interface PushPayload {
  reminder_id: string;
  title: string;
  fire_at: string;
}

interface Registration {
  showNotification: (title: string, options?: NotificationOptions) => Promise<void>;
}

interface ClickEvent {
  notification: { close: () => void; data?: unknown };
}

interface ClientLike {
  url?: string;
  focus?: () => Promise<unknown>;
}

interface Clients {
  matchAll: (options?: {
    type?: 'window';
    includeUncontrolled?: boolean;
  }) => Promise<readonly ClientLike[]>;
  openWindow: (url: string) => Promise<unknown>;
}

const DEFAULT_PATH = '/reminders';

export function parsePayload(payload: unknown): PushPayload | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const { reminder_id, title, fire_at } = payload as Record<string, unknown>;
  if (typeof reminder_id !== 'string' || reminder_id === '') return null;
  if (typeof title !== 'string' || title === '') return null;
  if (typeof fire_at !== 'string' || fire_at === '') return null;
  return { reminder_id, title, fire_at };
}

/** A mesma `tag` do aviso da aba aberta evita a notificação em dobro. */
export function notificationTag(reminder_id: string, fire_at: string): string {
  return `${reminder_id}:${fire_at}`;
}

export async function handlePush(payload: unknown, registration: Registration): Promise<void> {
  const message = parsePayload(payload);
  if (message === null) return;
  await registration.showNotification(message.title, {
    tag: notificationTag(message.reminder_id, message.fire_at),
    data: { path: DEFAULT_PATH },
  });
}

export async function handleNotificationClick(event: ClickEvent, clients: Clients): Promise<void> {
  event.notification.close();
  const data = event.notification.data as { path?: unknown } | undefined;
  const path = typeof data?.path === 'string' ? data.path : DEFAULT_PATH;
  const open = await clients.matchAll({ type: 'window', includeUncontrolled: true });
  const existing = open.find((client) => client.focus !== undefined);
  if (existing?.focus) {
    await existing.focus();
    return;
  }
  await clients.openWindow(path);
}
