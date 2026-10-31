import { useSyncExternalStore } from 'react';

export type ToastTone = 'info' | 'success' | 'warning' | 'danger';

export interface ToastInput {
  tone: ToastTone;
  message_key: string;
  params?: Record<string, string | number>;
}

export interface ToastEntry extends ToastInput {
  id: number;
}

const AUTO_DISMISS_MS = 6000;

let entries: readonly ToastEntry[] = [];
let next_id = 1;
const listeners = new Set<() => void>();

function emit(next: readonly ToastEntry[]) {
  entries = next;
  listeners.forEach((listener) => {
    listener();
  });
}

export function dismissToast(id: number) {
  emit(entries.filter((entry) => entry.id !== id));
}

export function pushToast(input: ToastInput): number {
  const id = next_id++;
  emit([...entries, { ...input, id }]);
  setTimeout(() => {
    dismissToast(id);
  }, AUTO_DISMISS_MS);
  return id;
}

export function getToasts(): readonly ToastEntry[] {
  return entries;
}

export function clearToasts() {
  emit([]);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useToast() {
  const toasts = useSyncExternalStore(subscribe, getToasts, getToasts);
  return { toasts, push: pushToast, dismiss: dismissToast };
}
