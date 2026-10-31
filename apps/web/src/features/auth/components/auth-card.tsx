import { BrandLogo, Card } from '@atria/ui';
import type { ReactNode } from 'react';
import { useT } from '../../../shared/i18n/i18n';
import styles from './auth-card.module.css';

export interface AuthCardProps {
  heading: string;
  subtitle: string;
  back?: ReactNode;
  /** Dentro do layout do app (tela do admin): sem a altura da janela nem a marca. */
  inline?: boolean;
  children: ReactNode;
}

/** Cartão estreito (cerca de 400 px) e centralizado das telas de entrada (DEC-006). */
export function AuthCard({ heading, subtitle, back, inline = false, children }: AuthCardProps) {
  const t = useT();
  const Stage = inline ? 'div' : 'main';
  return (
    <Stage className={[styles.stage, inline ? styles.stageInline : ''].filter(Boolean).join(' ')}>
      <Card as="section" data-auth-card="" className={styles.card}>
        {inline ? null : <BrandLogo name={t('common.brand')} className={styles.brand} />}
        {back ? <div className={styles.back}>{back}</div> : null}
        <h1 tabIndex={-1} data-page-heading="" className={styles.heading}>
          {heading}
        </h1>
        <p className={styles.subtitle}>{subtitle}</p>
        <div className={styles.body}>{children}</div>
      </Card>
    </Stage>
  );
}
