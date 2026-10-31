import type { ReactNode } from 'react';
import { CommandPaletteProvider } from '../features/command-palette/command-palette-provider';
import { PaletteTrigger } from '../features/command-palette/palette-trigger';
import { ReminderNotifier } from '../features/reminders';
import type { AppShell } from './router';

/** Paleta e aviso de lembretes montados uma vez, para não duplicar atalhos nem avisos. */
function Services({ children }: { children: ReactNode }) {
  return (
    <CommandPaletteProvider>
      <ReminderNotifier />
      {children}
    </CommandPaletteProvider>
  );
}

export const APP_SHELL: AppShell = { Services, SearchTrigger: PaletteTrigger };
