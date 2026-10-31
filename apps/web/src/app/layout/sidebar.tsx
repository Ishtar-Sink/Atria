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

function ThemeIcon() {
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
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
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
      <path d="M19 12a7 7 0 0 0-.1-1.3l2-1.5-2-3.4-2.3.9a7 7 0 0 0-2.2-1.3L14 3h-4l-.4 2.4a7 7 0 0 0-2.2 1.3l-2.3-.9-2 3.4 2 1.5A7 7 0 0 0 5 12c0 .4 0 .9.1 1.3l-2 1.5 2 3.4 2.3-.9a7 7 0 0 0 2.2 1.3L10 21h4l.4-2.4a7 7 0 0 0 2.2-1.3l2.3.9 2-3.4-2-1.5c.1-.4.1-.9.1-1.3z" />
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
      width="18"
      height="18"
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
  const { toggleTheme } = useTheme();
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
      label: t('common.toggle_theme'),
      icon: <ThemeIcon />,
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
          {...(user ? {} : { label: t('common.account_menu') })}
          menuLabel={t('common.account')}
          placement="right-end"
          className={styles.profileRoot}
          menuClassName={styles.accountMenu}
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
