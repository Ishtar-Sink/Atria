import { Link, useMatches } from '@tanstack/react-router';
import { useT } from '../../shared/i18n/i18n';
import styles from './app-layout.module.css';

export function Breadcrumbs() {
  const t = useT();
  const crumbs = useMatches().filter((match) => 'breadcrumb_key' in match.staticData);
  if (crumbs.length === 0) return null;
  return (
    <nav aria-label={t('common.breadcrumbs')} className={styles.breadcrumbs}>
      <ol className={styles.crumbList}>
        {crumbs.map((match, index) => {
          const last = index === crumbs.length - 1;
          return (
            <li key={match.id} className={styles.crumb}>
              {last ? (
                <span aria-current="page">{t(match.staticData.breadcrumb_key)}</span>
              ) : (
                <Link to={match.pathname}>{t(match.staticData.breadcrumb_key)}</Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
