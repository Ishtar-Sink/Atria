import { PageHeader, type PageHeaderProps } from '@atria/ui';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import styles from './sticky-page-header.module.css';

const COMPACT_AFTER = 48;

type Props = Omit<PageHeaderProps, 'stuck' | 'compact'> & {
  /** Conteúdo que fica preso junto do título, como as abas do Financeiro. */
  below?: ReactNode;
};

/** `PageHeader` preso sob a topbar, que compacta depois de 48 px de rolagem (PD-20). */
export function StickyPageHeader({ below, ...props }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const update = () => {
      const top = window.scrollY;
      setStuck(top > 0);
      setCompact((current) => {
        if (top <= COMPACT_AFTER) return false;
        if (current) return true;
        // Página curta: compactar encolheria a própria rolagem e faria o cabeçalho piscar.
        return document.documentElement.scrollHeight - window.innerHeight > COMPACT_AFTER;
      });
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => {
      window.removeEventListener('scroll', update);
    };
  }, []);

  // Como a `syncTopbar` do protótipo: o fundo vai da sidebar à borda, mesmo dentro do
  // formulário de 880 px ou da página de 1360 px (PD-20).
  useEffect(() => {
    const node = wrap.current;
    const area = node?.closest<HTMLElement>('[data-page-area]');
    if (!node || !area) return;
    const measure = () => {
      const left = area.getBoundingClientRect().left - node.getBoundingClientRect().left;
      node.style.setProperty('--bd-l', `${String(left)}px`);
      node.style.setProperty('--bd-w', `${String(area.clientWidth)}px`);
    };
    measure();
    window.addEventListener('resize', measure);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(area);
    observer?.observe(node);
    return () => {
      window.removeEventListener('resize', measure);
      observer?.disconnect();
    };
  }, []);

  return (
    <div ref={wrap} data-sticky-header="" className={styles.sticky}>
      <PageHeader {...props} stuck={stuck} compact={compact} />
      {below}
    </div>
  );
}
