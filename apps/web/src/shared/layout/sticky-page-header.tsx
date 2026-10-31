import { PageHeader, type PageHeaderProps } from '@atria/ui';
import { useEffect, useRef, useState } from 'react';
import styles from './sticky-page-header.module.css';

const COMPACT_AFTER = 48;

type Props = Omit<PageHeaderProps, 'stuck' | 'compact'>;

/** `PageHeader` preso sob a topbar, que compacta depois de 48 px de rolagem (PD-20). */
export function StickyPageHeader(props: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const area = wrap.current?.closest<HTMLElement>('[data-scroll-area]');
    if (!area) return;
    const update = () => {
      const top = area.scrollTop;
      setStuck(top > 0);
      setCompact((current) => {
        if (top <= COMPACT_AFTER) return false;
        if (current) return true;
        // Página curta: compactar encolheria a própria rolagem e faria o cabeçalho piscar.
        return area.scrollHeight - area.clientHeight > COMPACT_AFTER;
      });
    };
    update();
    area.addEventListener('scroll', update, { passive: true });
    return () => {
      area.removeEventListener('scroll', update);
    };
  }, []);

  return (
    <div ref={wrap} className={styles.sticky}>
      <PageHeader {...props} stuck={stuck} compact={compact} />
    </div>
  );
}
