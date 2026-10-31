import type { ReactNode } from 'react';
import { usePreferences } from '../../shared/preferences/preferences-context';
import { CommandPalette } from './command-palette';
import { DEFAULT_SHORTCUT } from './shortcut';
import { useCommandPalette } from './use-command-palette';
import { usePaletteShortcut } from './use-palette-shortcut';
import { usePaletteSettings } from './use-palette-search';

/** Registra o atalho global e mostra a paleta quando aberta; a TASK-35 monta no layout. */
export function CommandPaletteProvider({ children }: { children: ReactNode }) {
  const { is_open, toggle } = useCommandPalette();
  const settings = usePaletteSettings();
  const preferences = usePreferences();
  const shortcut = settings.palette_shortcut ?? preferences.palette_shortcut;
  usePaletteShortcut(shortcut === '' ? DEFAULT_SHORTCUT : shortcut, toggle);
  return (
    <>
      {children}
      {is_open ? <CommandPalette /> : null}
    </>
  );
}
