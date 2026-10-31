import type { ReactNode } from 'react';
import styles from './form-screen.module.css';

/** Envolve o cabeçalho e o formulário de uma tela de criar ou editar (880 px, centralizado). */
export function FormScreen({ children }: { children: ReactNode }) {
  return <div className={styles.screen}>{children}</div>;
}
