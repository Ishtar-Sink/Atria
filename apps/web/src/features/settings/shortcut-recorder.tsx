import { Button } from '@atria/ui';
import { useEffect, useId, useState } from 'react';
import { useT } from '../../shared/i18n/i18n';
import styles from './settings.module.css';

export const DEFAULT_PALETTE_SHORTCUT = 'mod+k';

const MODIFIER_KEYS = new Set(['Control', 'Meta', 'Alt', 'Shift', 'AltGraph']);

/** `mod` vale Ctrl no Windows e no Linux e ⌘ no Mac; quem usa a paleta vê o nome da tecla dela. */
function isMac(): boolean {
  return typeof navigator !== 'undefined' && /mac|iphone|ipad/i.test(navigator.platform);
}

export function formatShortcut(shortcut: string): string {
  return shortcut
    .split('+')
    .map((part) => {
      if (part === 'mod') return isMac() ? '⌘' : 'Ctrl';
      if (part === 'alt') return isMac() ? '⌥' : 'Alt';
      if (part === 'shift') return isMac() ? '⇧' : 'Shift';
      return part.length === 1 ? part.toUpperCase() : part;
    })
    .join(' + ');
}

/** Converte a tecla pressionada no formato do atalho (`mod+k`); sem modificador não vale. */
export function shortcutFromEvent(event: KeyboardEvent): string | undefined {
  if (MODIFIER_KEYS.has(event.key)) return undefined;
  const has_mod = event.ctrlKey || event.metaKey;
  if (!has_mod && !event.altKey) return undefined;
  const parts: string[] = [];
  if (has_mod) parts.push('mod');
  if (event.altKey) parts.push('alt');
  if (event.shiftKey) parts.push('shift');
  parts.push(event.key.length === 1 ? event.key.toLowerCase() : event.key);
  return parts.join('+');
}

export interface ShortcutRecorderProps {
  value: string;
  onChange: (value: string) => void;
}

/** Campo que grava a próxima combinação de teclas, só pelo teclado (RF-58). */
export function ShortcutRecorder({ value, onChange }: ShortcutRecorderProps) {
  const t = useT();
  const id = useId();
  const [recording, setRecording] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [announce, setAnnounce] = useState('');

  useEffect(() => {
    if (!recording) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        setRecording(false);
        setInvalid(false);
        return;
      }
      if (event.key === 'Tab') return;
      event.preventDefault();
      if (MODIFIER_KEYS.has(event.key)) return;
      const shortcut = shortcutFromEvent(event);
      if (shortcut === undefined) {
        setInvalid(true);
        return;
      }
      setInvalid(false);
      setRecording(false);
      setAnnounce(t('settings.shortcut_recorded', { shortcut: formatShortcut(shortcut) }));
      onChange(shortcut);
    }
    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
    };
  }, [recording, onChange, t]);

  return (
    <div className={styles.shortcut} data-span="full">
      <span id={`${id}-label`} className={styles.fieldLabel}>
        {t('settings.palette_shortcut')}
      </span>
      <div className={styles.shortcutRow} role="group" aria-labelledby={`${id}-label`}>
        <kbd className={styles.keys}>
          {recording ? t('settings.shortcut_press_keys') : formatShortcut(value)}
        </kbd>
        <Button
          onClick={() => {
            setInvalid(false);
            setRecording((current) => !current);
          }}
          aria-pressed={recording}
        >
          {t('settings.shortcut_record')}
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            setRecording(false);
            setInvalid(false);
            setAnnounce(
              t('settings.shortcut_recorded', {
                shortcut: formatShortcut(DEFAULT_PALETTE_SHORTCUT),
              }),
            );
            onChange(DEFAULT_PALETTE_SHORTCUT);
          }}
          disabled={value === DEFAULT_PALETTE_SHORTCUT && !recording}
        >
          {t('settings.shortcut_reset')}
        </Button>
      </div>
      <p aria-live="polite" className={styles.visuallyHidden}>
        {announce}
      </p>
      {invalid ? (
        <p role="alert" className={styles.error}>
          {t('settings.shortcut_invalid')}
        </p>
      ) : null}
    </div>
  );
}
