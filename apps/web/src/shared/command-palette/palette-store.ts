import { useSyncExternalStore } from 'react';

let open = false;
const listeners = new Set<() => void>();

function set(next: boolean) {
  if (open === next) return;
  open = next;
  listeners.forEach((listener) => {
    listener();
  });
}

export function openCommandPalette() {
  set(true);
}

export function closeCommandPalette() {
  set(false);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function snapshot() {
  return open;
}

export function useCommandPaletteOpen(): boolean {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}
