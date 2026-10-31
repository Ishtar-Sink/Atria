import { BrandLogo, MenuButton, type MenuItem } from '@atria/ui';
import { paletteFor } from '@atria/theme';
import { Link, useRouter } from '@tanstack/react-router';
import { useEffect, useRef, type KeyboardEvent } from 'react';
import { api } from '../../shared/api/client';
import { useT } from '../../shared/i18n/i18n';
import { displayName, initialsOf, useCurrentUser } from '../../shared/session/current-user';
import type { NavItem } from '../../shared/navigation/nav-item';
import { useTheme } from '../theme/theme-provider';
import styles from './app-layout.module.css';

function ThemeIcon({ dark }: { dark: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {dark ? (
        <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />
      ) : (
        <>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </>
      )}
    </svg>
  );
}

function SignOutIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
    </svg>
  );
}

function PersonIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

const FOCUSABLE = 'a[href], button:not([disabled])';

export interface SidebarProps {
  items: NavItem[];
  drawer: boolean;
  open: boolean;
  onClose: () => void;
}

async function signOut() {
  await api.post('/auth/sign-out');
  window.location.assign('/sign-in');
}

export function Sidebar({ items, drawer, open, onClose }: SidebarProps) {
  const t = useT();
  const { theme, toggleTheme } = useTheme();
  const ref = useRef<HTMLElement>(null);
  const inert = drawer && !open;

  useEffect(() => {
    if (drawer && open) ref.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
  }, [drawer, open]);

  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (!drawer || !open) return;
    if (event.key === 'Escape') {
      onClose();
      return;
    }
    if (event.key !== 'Tab') return;
    const nodes = ref.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
    const first = nodes?.[0];
    const last = nodes?.[nodes.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }

  const next_theme_label = theme === 'dark' ? t('common.theme_light') : t('common.theme_dark');
  const router = useRouter();
  const { data: user } = useCurrentUser();
  const gradient = paletteFor(user?.id ?? 'atria');
  const menu_items: MenuItem[] = [
    {
      id: 'settings',
      label: t('common.settings'),
      icon: <SettingsIcon />,
      href: '/settings',
      onSelect: () => {
        void router.navigate({ to: '/settings' });
      },
    },
    {
      id: 'theme',
      label: next_theme_label,
      icon: <ThemeIcon dark={theme === 'light'} />,
      onSelect: toggleTheme,
    },
    {
      id: 'sign-out',
      label: t('common.sign_out'),
      icon: <SignOutIcon />,
      tone: 'danger',
      onSelect: () => {
        void signOut();
      },
    },
  ];
  const sorted = [...items].sort((a, b) => a.order - b.order);

  return (
    // O onKeyDown só prende o foco e fecha a gaveta; o aside não vira controle.
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <aside
      id="sidebar"
      ref={ref}
      className={[styles.sidebar, drawer ? styles.drawer : '', open ? styles.drawerOpen : '']
        .filter(Boolean)
        .join(' ')}
      inert={inert}
      onKeyDown={onKeyDown}
    >
      <BrandLogo name={t('common.brand')} />
      <nav aria-label={t('common.principal')} className={styles.nav}>
        <ul className={styles.navList}>
          {sorted.map((item) => (
            <li key={item.id}>
              <Link
                to={item.to}
                className={styles.navLink}
                activeProps={{ 'aria-current': 'page' }}
              >
                <item.icon aria-hidden />
                <span>{t(item.label_key)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <div className={styles.sidebarFooter}>
        <MenuButton
          label={t('common.account_menu')}
          placement="right-end"
          triggerClassName={styles.profileButton}
          items={menu_items}
          trigger={
            <>
              <span
                aria-hidden="true"
                className={styles.avatar}
                style={{ background: `linear-gradient(135deg, ${gradient[0]}, ${gradient[1]})` }}
              >
                {user?.avatar_url ? (
                  <img src={user.avatar_url} alt="" className={styles.avatarImage} />
                ) : user ? (
                  initialsOf(user)
                ) : (
                  <PersonIcon />
                )}
              </span>
              {user ? <span className={styles.profileName}>{displayName(user)}</span> : null}
              <span aria-hidden="true" className={styles.profileChevron}>
                <ChevronIcon />
              </span>
            </>
          }
        />
      </div>
    </aside>
  );
}
