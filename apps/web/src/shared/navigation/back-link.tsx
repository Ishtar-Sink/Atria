import { useRouter, useRouterState } from '@tanstack/react-router';
import { useT } from '../i18n/i18n';
import { pathnameOf, useBackTarget, type BackTargetOptions } from './back-target';
import styles from './back-link.module.css';

function ArrowLeft() {
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
      aria-hidden="true"
      focusable="false"
    >
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

/** O "Voltar" do cabeçalho: leva à última listagem ou dashboard de origem. */
export function BackLink(options: BackTargetOptions) {
  const t = useT();
  const router = useRouter();
  const target = useBackTarget(options);
  const current = useRouterState({ select: (state) => state.location.pathname });
  return (
    <a
      href={target}
      className={styles.link}
      onClick={(event) => {
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return;
        event.preventDefault();
        const next = pathnameOf(target) === current ? options.fallback_to : target;
        if (pathnameOf(next) === current) return;
        router.history.push(next);
      }}
    >
      <ArrowLeft />
      <span>{t('common.back')}</span>
    </a>
  );
}
