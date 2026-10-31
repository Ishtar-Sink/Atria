import { Link } from '@tanstack/react-router';
import { useT } from '../../../shared/i18n/i18n';
import styles from './admin-sections.module.css';

const SECTIONS = [
  { to: '/admin/users', label_key: 'admin.nav.users' },
  { to: '/admin/invites', label_key: 'admin.nav.invites' },
  { to: '/admin/instance', label_key: 'admin.nav.instance' },
] as const;

/** Liga as telas da administração entre si; a sidebar tem um único item. */
export function AdminSections() {
  const t = useT();
  return (
    <nav aria-label={t('admin.nav.sections')} className={styles.root}>
      {SECTIONS.map((section) => (
        <Link
          key={section.to}
          to={section.to}
          className={styles.link}
          activeProps={{
            className: [styles.link, styles.active].join(' '),
            'aria-current': 'page',
          }}
          activeOptions={{ includeSearch: false }}
        >
          {t(section.label_key)}
        </Link>
      ))}
    </nav>
  );
}
