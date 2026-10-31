import { Button, Card, IconButton, LoadingState } from '@atria/ui';
import { useId, type ReactNode } from 'react';
import { useT } from '../../../shared/i18n/i18n';
import type { DashboardBlockId } from '../blocks';
import styles from './dashboard.module.css';
import { CalmMessage } from './calm-message';

function EyeIcon({ off }: { off: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {off ? (
        <>
          <path d="M3 3l18 18" />
          <path d="M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6C3.9 8.4 2 12 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6" />
          <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
        </>
      ) : (
        <>
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
          <circle cx="12" cy="12" r="3" />
        </>
      )}
    </svg>
  );
}

export type BlockStatus = 'loading' | 'error' | 'empty' | 'ready';

export interface DashboardBlockProps {
  id: DashboardBlockId;
  title: string;
  status: BlockStatus;
  /** Mensagem calma do estado vazio. */
  empty?: ReactNode;
  onRetry?: () => void;
  sensitive?: boolean;
  masked?: boolean;
  onToggleMask?: () => void;
  children?: ReactNode;
}

/** Cartão comum dos blocos: título, olho nos sensíveis e os estados carregando, vazio e erro. */
export function DashboardBlock({
  id,
  title,
  status,
  empty,
  onRetry,
  sensitive = false,
  masked = false,
  onToggleMask,
  children,
}: DashboardBlockProps) {
  const t = useT();
  const heading_id = `${useId()}-${id}`;
  const label = t(masked ? 'dashboard.mask.show' : 'dashboard.mask.hide', { block: title });

  return (
    <Card as="section" aria-labelledby={heading_id} data-block={id}>
      <div className={styles.head}>
        <h2 id={heading_id} className={styles.blockTitle}>
          {title}
        </h2>
        {sensitive ? (
          <IconButton
            aria-label={label}
            title={label}
            aria-pressed={masked}
            icon={<EyeIcon off={masked} />}
            onClick={onToggleMask}
          />
        ) : null}
      </div>
      {status === 'loading' ? (
        <LoadingState label={t('dashboard.loading', { block: title })} rows={2} />
      ) : status === 'error' ? (
        <div role="alert">
          <CalmMessage>{t('dashboard.error_block')}</CalmMessage>
          <p className={styles.more}>
            <Button onClick={onRetry}>{t('dashboard.error_retry')}</Button>
          </p>
        </div>
      ) : status === 'empty' ? (
        empty
      ) : (
        children
      )}
    </Card>
  );
}
