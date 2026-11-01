import type { Schemas } from '@atria/contracts';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { api } from '../../../shared/api/client';
import { ApiProblem } from '../../../shared/api/problem';
import { useNotificationPermission } from '../hooks/use-notification-permission';
import serviceWorkerUrl from './service-worker.ts?worker&url';

const SUBSCRIPTION_KEY = 'atria.reminders.push_subscription_id';

function readStoredId(): string | null {
  try {
    return localStorage.getItem(SUBSCRIPTION_KEY);
  } catch {
    return null;
  }
}

function writeStoredId(id: string | null) {
  try {
    if (id === null) localStorage.removeItem(SUBSCRIPTION_KEY);
    else localStorage.setItem(SUBSCRIPTION_KEY, id);
  } catch {
    // Sem armazenamento a inscrição vale só nesta sessão.
  }
}

/** A chave VAPID chega em base64url; o navegador quer bytes. */
function keyToBytes(key: string): Uint8Array<ArrayBuffer> {
  const padded = key
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(key.length / 4) * 4, '=');
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index);
  return bytes;
}

function browserSupportsPush(): boolean {
  return (
    typeof navigator !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window
  );
}

/** Por que o aviso com o app fechado não está disponível: sem suporte no navegador ou desligado na instância. */
export type PushUnavailableReason = 'unsupported' | 'disabled';

/**
 * Web Push (RF-42): disponível quando a instância tem o recurso ligado e o navegador o aceita.
 * Só `subscribe()` e `unsubscribe()` mexem em algo, e só por ação da pessoa.
 */
export function useWebPush() {
  const { request } = useNotificationPermission();
  const [subscription_id, setSubscriptionId] = useState<string | null>(readStoredId);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const supported = browserSupportsPush();
  const key = useQuery({
    queryKey: ['reminders', 'web-push-key'],
    enabled: supported,
    retry: false,
    staleTime: Infinity,
    queryFn: async ({ signal }) => {
      try {
        const body = await api.get<Schemas['PublicKeyResponse']>('/web-push/public-key', {
          signal,
        });
        return body.public_key;
      } catch (error) {
        // 404 `web_push_disabled`: o admin não ligou o recurso.
        if (error instanceof ApiProblem && error.status === 404) return null;
        throw error;
      }
    },
  });
  const public_key = key.data ?? null;
  const available = public_key !== null;
  // Enquanto a consulta carrega ou falha por outro motivo, `key.data` é `undefined` e não há motivo.
  const unavailable_reason: PushUnavailableReason | null = !supported
    ? 'unsupported'
    : key.data === null
      ? 'disabled'
      : null;

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (public_key === null) return false;
    setFailed(false);
    setBusy(true);
    try {
      const status = await request();
      if (status !== 'granted') return false;
      const registration = await navigator.serviceWorker.register(serviceWorkerUrl);
      const push = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: keyToBytes(public_key),
      });
      const json = push.toJSON();
      const created = await api.post<Schemas['SubscriptionResponse']>('/push-subscriptions', {
        endpoint: json.endpoint ?? push.endpoint,
        keys: { p256dh: json.keys?.p256dh ?? '', auth: json.keys?.auth ?? '' },
      });
      writeStoredId(created.id);
      setSubscriptionId(created.id);
      return true;
    } catch {
      setFailed(true);
      return false;
    } finally {
      setBusy(false);
    }
  }, [public_key, request]);

  const unsubscribe = useCallback(async (): Promise<boolean> => {
    setFailed(false);
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      const push = await registration?.pushManager.getSubscription();
      await push?.unsubscribe();
      if (subscription_id !== null) await api.delete(`/push-subscriptions/${subscription_id}`);
      writeStoredId(null);
      setSubscriptionId(null);
      return true;
    } catch {
      setFailed(true);
      return false;
    } finally {
      setBusy(false);
    }
  }, [subscription_id]);

  return {
    available,
    unavailable_reason,
    subscribed: subscription_id !== null,
    busy,
    failed,
    subscribe,
    unsubscribe,
  };
}
