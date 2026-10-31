import type { ComponentType } from 'react';
import { IconButton } from '@atria/ui';
import { useT } from '../../shared/i18n/i18n';
import { useScreenInfo } from '../../shared/layout/screen-info';
import { Breadcrumbs } from './breadcrumbs';
import styles from './app-layout.module.css';

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

export interface TopbarProps {
  drawer: boolean;
  drawer_open: boolean;
  onToggleDrawer: () => void;
  /** Gatilho da paleta na topbar; vem do `shell` do roteador (TASK-35). */
  SearchTrigger?: ComponentType<{ className?: string }>;
}

export function Topbar({ drawer, drawer_open, onToggleDrawer, SearchTrigger }: TopbarProps) {
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
      {SearchTrigger ? <SearchTrigger className={styles.searchTrigger} /> : null}
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
