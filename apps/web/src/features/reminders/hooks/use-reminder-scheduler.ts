import type { Schemas } from '@atria/contracts';
import { useEffect, useRef } from 'react';
import { api } from '../../../shared/api/client';
import { readNotificationStatus } from './use-notification-permission';

export type UpcomingFire = Schemas['UpcomingFireResponse'];

/** Quanto à frente o agendador olha, e de quanto em quanto tempo ele consulta de novo. */
export const LOOKAHEAD_MS = 6 * 60 * 60 * 1000;
export const REFETCH_MS = 15 * 60 * 1000;

export interface ReminderSchedulerOptions {
  /** Relógio injetável; o padrão é o do navegador. */
  now?: () => Date;
  /** Mostra a notificação do navegador; só é chamada com a permissão concedida. */
  notify?: (fire: UpcomingFire) => void;
  /** Aviso dentro do app, quando o navegador não pode notificar (CB-14). */
  showInApp: (fire: UpcomingFire) => void;
  /** Liga ou desliga o agendador. */
  enabled?: boolean;
}

/** Chave da ocorrência, igual à `tag` do push: `<reminder_id>:<fire_at>`. */
export function fireKey(fire: Pick<UpcomingFire, 'reminder_id' | 'fire_at'>): string {
  return `${fire.reminder_id}:${fire.fire_at}`;
}

/** Notificação do navegador com a `tag` da ocorrência: a do push não duplica. */
export function browserNotify(fire: UpcomingFire): void {
  new window.Notification(fire.title, { tag: fireKey(fire) });
}

/**
 * Com a aba aberta, agenda as ocorrências das próximas horas e avisa na hora de cada uma
 * (RF-41). O horário vem do servidor em UTC: o cliente não recalcula fuso nem horário de
 * verão (CB-04).
 */
export function useReminderScheduler(options: ReminderSchedulerOptions) {
  const latest = useRef(options);
  useEffect(() => {
    latest.current = options;
  });
  const enabled = options.enabled ?? true;

  useEffect(() => {
    if (!enabled) return;
    const timers = new Map<string, ReturnType<typeof setTimeout>>();
    const fired = new Set<string>();
    let alive = true;
    let controller: AbortController | null = null;

    const clock = () => (latest.current.now ?? (() => new Date()))();

    function fire(item: UpcomingFire) {
      const key = fireKey(item);
      timers.delete(key);
      if (fired.has(key)) return;
      fired.add(key);
      const { notify, showInApp } = latest.current;
      if (readNotificationStatus() === 'granted') (notify ?? browserNotify)(item);
      else showInApp(item);
    }

    async function load() {
      controller?.abort();
      controller = new AbortController();
      const from = clock();
      const to = new Date(from.getTime() + LOOKAHEAD_MS);
      let items: UpcomingFire[];
      try {
        const response = await api.get<Schemas['UpcomingResponse']>('/reminders/upcoming', {
          query: { from: from.toISOString(), to: to.toISOString() },
          signal: controller.signal,
        });
        items = response.items;
      } catch {
        // Sem conexão agora: a próxima consulta tenta de novo.
        return;
      }
      if (!alive) return;
      const keep = new Set(items.map(fireKey));
      for (const [key, timer] of timers) {
        if (!keep.has(key)) {
          clearTimeout(timer);
          timers.delete(key);
        }
      }
      for (const item of items) {
        const key = fireKey(item);
        if (fired.has(key) || timers.has(key)) continue;
        const delay = new Date(item.fire_at).getTime() - clock().getTime();
        if (delay < 0) continue;
        timers.set(
          key,
          setTimeout(() => {
            fire(item);
          }, delay),
        );
      }
    }

    function onVisibility() {
      if (document.visibilityState === 'visible') void load();
    }

    void load();
    const interval = setInterval(() => {
      void load();
    }, REFETCH_MS);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      alive = false;
      controller?.abort();
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
      timers.forEach((timer) => {
        clearTimeout(timer);
      });
      timers.clear();
    };
  }, [enabled]);
}
