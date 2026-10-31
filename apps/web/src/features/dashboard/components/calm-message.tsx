import type { ReactNode } from 'react';
import styles from './dashboard.module.css';

/** Mensagem de estado calma: itálico, texto secundário, sem fundo (PD-16). */
export function CalmMessage({ children }: { children: ReactNode }) {
  return <p className={styles.calm}>{children}</p>;
}
