import { openCommandPalette } from '../../shared/command-palette/palette-store';
import { useT } from '../../shared/i18n/i18n';
import { usePreferences } from '../../shared/preferences/preferences-context';
import { DEFAULT_SHORTCUT, formatShortcut } from './shortcut';
import { usePaletteSettings } from './use-palette-search';
import './command-palette.css';

function SearchIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

/** Campo de busca da topbar que abre a paleta e mostra a dica do atalho (decisão 39). */
export function PaletteTrigger({ className }: { className?: string }) {
  const t = useT();
  const settings = usePaletteSettings();
  const preferences = usePreferences();
  const shortcut = settings.palette_shortcut ?? preferences.palette_shortcut;
  const hint = formatShortcut(shortcut === '' ? DEFAULT_SHORTCUT : shortcut);
  return (
    <button
      type="button"
      className={['command-palette-trigger', className].filter(Boolean).join(' ')}
      title={t('command_palette.shortcut_hint', { shortcut: hint })}
      onClick={openCommandPalette}
    >
      <SearchIcon />
      <span className="command-palette-trigger-text">{t('command_palette.trigger_label')}</span>
      <kbd className="command-palette-kbd">{hint}</kbd>
    </button>
  );
}
