/// <reference lib="webworker" />
import { handleNotificationClick, handlePush } from './handle-push';

const sw = self as unknown as ServiceWorkerGlobalScope;

// Sem cache nem lógica offline: o service worker serve só ao Web Push (RF-42).
sw.addEventListener('push', (event) => {
  let payload: unknown = null;
  try {
    payload = event.data?.json();
  } catch {
    // Mensagem que não é JSON: `handlePush` ignora.
  }
  event.waitUntil(handlePush(payload, sw.registration));
});

sw.addEventListener('notificationclick', (event) => {
  event.waitUntil(handleNotificationClick(event, sw.clients));
});
