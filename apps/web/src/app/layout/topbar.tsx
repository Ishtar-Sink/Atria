import { IconButton } from '@atria/ui';
import { openCommandPalette } from '../../shared/command-palette/palette-store';
import { useT } from '../../shared/i18n/i18n';
import { useScreenInfo } from '../../shared/layout/screen-info';
import { Breadcrumbs } from './breadcrumbs';
import styles from './app-layout.module.css';

function isMac(): boolean {
  return /mac|iphone|ipad/i.test(navigator.platform);
}

export function shortcutHint(): string {
  return isMac() ? '⌘ K' : 'Ctrl K';
}

function MenuIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

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
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

export interface TopbarProps {
  drawer: boolean;
  drawer_open: boolean;
  onToggleDrawer: () => void;
}

export function Topbar({ drawer, drawer_open, onToggleDrawer }: TopbarProps) {
  const t = useT();
  const { items } = useScreenInfo();
  return (
    <header className={styles.topbar}>
      {drawer ? (
        <IconButton
          id="menu-button"
          className={styles.menuButton}
          aria-label={t('common.open_menu')}
          aria-expanded={drawer_open}
          aria-controls="sidebar"
          icon={<MenuIcon />}
          onClick={onToggleDrawer}
        />
      ) : null}
      <button type="button" className={styles.searchTrigger} onClick={openCommandPalette}>
        <span aria-hidden="true" className={styles.searchIcon}>
          <SearchIcon />
        </span>
        <span className={styles.searchText}>{t('common.search_placeholder')}</span>
        <kbd className={styles.shortcut}>{shortcutHint()}</kbd>
      </button>
      <Breadcrumbs />
      {items.length > 0 ? (
        <ul aria-label={t('common.screen_info')} className={styles.screenInfo}>
          {items.map((item) => (
            <li key={item.label}>
              <span className={styles.infoLabel}>{item.label}</span> {item.value}
            </li>
          ))}
        </ul>
      ) : null}
    </header>
  );
}
