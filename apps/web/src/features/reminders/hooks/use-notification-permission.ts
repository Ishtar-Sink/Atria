import { useCallback, useSyncExternalStore } from 'react';

export type NotificationStatus = 'unsupported' | 'default' | 'granted' | 'denied';

const listeners = new Set<() => void>();

/** Lê a permissão do navegador na hora: nunca pede nada ([project/frontend-15]). */
export function readNotificationStatus(): NotificationStatus {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return window.Notification.permission;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function emit() {
  listeners.forEach((listener) => {
    listener();
  });
}

/**
 * Estado da permissão de notificações e o pedido explícito. A permissão só é pedida por
 * `request()`, chamado por um clique: nunca ao montar (CB-14).
 */
export function useNotificationPermission() {
  const status = useSyncExternalStore(subscribe, readNotificationStatus, () => 'unsupported');

  const request = useCallback(async (): Promise<NotificationStatus> => {
    // Negada ou sem suporte, não há o que pedir; já concedida, nada a fazer.
    if (readNotificationStatus() !== 'default') return readNotificationStatus();
    try {
      await window.Notification.requestPermission();
    } catch {
      // O navegador recusou o pedido: vale o estado que ele informar.
    }
    emit();
    return readNotificationStatus();
  }, []);

  return { status, request };
}
