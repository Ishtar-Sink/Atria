import styles from './brand-logo.module.css';

export interface BrandLogoProps {
  /** Nome ao lado da marca (a tela passa o texto traduzido). */
  name: string;
  className?: string;
}

/** Marca do protótipo: quadrado em gradiente com o "A" em traço e o nome com texto em gradiente. */
export function BrandLogo({ name, className }: BrandLogoProps) {
  return (
    <div className={[styles.root, className].filter(Boolean).join(' ')}>
      <span aria-hidden="true" className={styles.mark}>
        <svg viewBox="0 0 24 24" width="20" height="20" focusable="false">
          <path d="M3 20L12 4l9 16" />
          <path d="M8 20l4-7 4 7" />
        </svg>
      </span>
      <span className={styles.name}>{name}</span>
    </div>
  );
}
