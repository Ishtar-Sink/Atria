import { Outlet, useRouter } from '@tanstack/react-router';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { breakpoints } from '@atria/theme';
import { useT } from '../../shared/i18n/i18n';
import { useRouteFocus } from './route-focus';
import { Sidebar } from './sidebar';
import { Topbar } from './topbar';
import styles from './app-layout.module.css';

const DRAWER_QUERY = `(max-width: ${String(breakpoints.md)}px)`;

function useDrawerMode(): boolean {
  const [drawer, setDrawer] = useState(() => window.matchMedia(DRAWER_QUERY).matches);
  useEffect(() => {
    const query = window.matchMedia(DRAWER_QUERY);
    const onChange = () => {
      setDrawer(query.matches);
    };
    query.addEventListener('change', onChange);
    return () => {
      query.removeEventListener('change', onChange);
    };
  }, []);
  return drawer;
}

/** Como a `syncTopbar` do protótipo: o cabeçalho fixo cola logo abaixo da topbar, que muda de
 *  altura quando quebra de linha abaixo de 720 px (PD-20). */
function useTopbarHeight(
  shell: RefObject<HTMLDivElement | null>,
  column: RefObject<HTMLDivElement | null>,
) {
  useLayoutEffect(() => {
    const topbar = column.current?.querySelector<HTMLElement>(':scope > header');
    if (!topbar) return;
    const measure = () => {
      shell.current?.style.setProperty('--topbar-h', `${String(topbar.offsetHeight)}px`);
    };
    measure();
    window.addEventListener('resize', measure);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(topbar);
    return () => {
      window.removeEventListener('resize', measure);
      observer?.disconnect();
    };
  });
}

function Passthrough({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function AppLayout() {
  const t = useT();
  const router = useRouter();
  const drawer = useDrawerMode();
  useRouteFocus();
  const [open, setOpen] = useState(false);
  const opener = useRef<Element | null>(null);
  const shell_ref = useRef<HTMLDivElement>(null);
  const column = useRef<HTMLDivElement>(null);
  useTopbarHeight(shell_ref, column);

  const close = useCallback(() => {
    setOpen(false);
    (opener.current as HTMLElement | null)?.focus();
  }, []);
  const toggle = useCallback(() => {
    if (open) {
      close();
      return;
    }
    opener.current = document.activeElement;
    setOpen(true);
  }, [open, close]);

  useEffect(() => {
    // A navegação fecha a gaveta.
    return router.subscribe('onResolved', () => {
      setOpen(false);
    });
  }, [router]);

  const drawer_open = drawer && open;

  const shell = router.options.context.shell;
  const Services = shell?.Services ?? Passthrough;

  return (
    <Services>
      <div ref={shell_ref} className={styles.shell}>
        <a href="#conteudo" className={styles.skipLink}>
          {t('common.skip_to_content')}
        </a>
        <Sidebar
          items={router.options.context.nav_items}
          drawer={drawer}
          open={drawer_open}
          onClose={close}
        />
        {drawer_open ? (
          <button
            type="button"
            tabIndex={-1}
            aria-label={t('common.close_menu')}
            className={styles.scrim}
            onClick={close}
          />
        ) : null}
        <div ref={column} className={styles.main}>
          <Topbar
            drawer={drawer}
            drawer_open={drawer_open}
            onToggleDrawer={toggle}
            {...(shell ? { SearchTrigger: shell.SearchTrigger } : {})}
          />
          <main id="conteudo" tabIndex={-1} className={styles.page} data-page-area="">
            <div className={styles.pageInner}>
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </Services>
  );
}
