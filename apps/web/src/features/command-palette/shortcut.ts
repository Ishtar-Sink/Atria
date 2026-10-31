export const DEFAULT_SHORTCUT = 'mod+k';

export interface ShortcutEvent {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
}

export function isMacPlatform(): boolean {
  return /mac|iphone|ipad/i.test(navigator.platform);
}

/** Aceita `mod+k` e, como no protótipo, só a letra (`k`); o que não for válido volta ao padrão. */
function keyOf(shortcut: string): string {
  const parts = shortcut
    .toLowerCase()
    .split('+')
    .map((part) => part.trim());
  const key = parts[parts.length - 1] ?? '';
  return key.length === 1 ? key : (DEFAULT_SHORTCUT.split('+')[1] ?? 'k');
}

/** `mod` é a tecla Meta no macOS e Ctrl nos demais (decisão 39). */
export function matchesShortcut(event: ShortcutEvent, shortcut: string): boolean {
  const mac = isMacPlatform();
  const mod = mac ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey;
  return mod && !event.altKey && !event.shiftKey && event.key.toLowerCase() === keyOf(shortcut);
}

export function formatShortcut(shortcut: string): string {
  const key = keyOf(shortcut).toUpperCase();
  return isMacPlatform() ? `⌘ ${key}` : `Ctrl ${key}`;
}
