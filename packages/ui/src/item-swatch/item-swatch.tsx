import { paletteFor } from '@atria/theme';
import type { HTMLAttributes } from 'react';
import styles from './item-swatch.module.css';

export interface ItemSwatchProps extends HTMLAttributes<HTMLSpanElement> {
  /** Id do item: o mesmo id sempre gera o mesmo gradiente ([project/frontend-11]). */
  id: string;
}

export function ItemSwatch({ id, className, style, children, ...rest }: ItemSwatchProps) {
  const [from, to] = paletteFor(id);
  return (
    <span
      {...rest}
      aria-hidden="true"
      className={[styles.root, className].filter(Boolean).join(' ')}
      style={{ ...style, background: `linear-gradient(135deg, ${from}, ${to})` }}
    >
      {children}
    </span>
  );
}
