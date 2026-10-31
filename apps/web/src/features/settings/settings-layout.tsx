import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { useT } from '../../shared/i18n/i18n';
import { FormScreen } from '../../shared/layout/form-screen';
import { StickyPageHeader } from '../../shared/layout/sticky-page-header';
import styles from './settings.module.css';
import { useViewerRole } from './use-instance-settings';

const SECTIONS = [
  { to: '/settings', label_key: 'settings.section_preferences', admin_only: false },
  { to: '/settings/search', label_key: 'settings.section_search', admin_only: false },
  { to: '/settings/dashboard', label_key: 'settings.section_dashboard', admin_only: false },
  { to: '/settings/instance', label_key: 'settings.section_instance', admin_only: true },
] as const;

/**
 * Cabeçalho e navegação entre as seções de Configurações. Configurações não está na navegação
 * principal: abre pelo menu do perfil (PD-23). A seção da instância só aparece para o admin.
 */
export function SettingsLayout({ children }: { children: ReactNode }) {
  const t = useT();
  const viewer = useViewerRole();
  return (
    <FormScreen>
      <StickyPageHeader
        eyebrow={t('settings.eyebrow')}
        title={t('settings.title')}
        subtitle={t('settings.subtitle')}
      />
      <nav aria-label={t('settings.nav')} className={styles.nav}>
        {SECTIONS.filter((section) => !section.admin_only || viewer.is_admin).map((section) => (
          <Link
            key={section.to}
            to={section.to}
            className={styles.link}
            activeProps={{
              className: [styles.link, styles.active].join(' '),
              'aria-current': 'page',
            }}
            activeOptions={{ exact: true, includeSearch: false }}
          >
            {t(section.label_key)}
          </Link>
        ))}
      </nav>
      {children}
    </FormScreen>
  );
}
