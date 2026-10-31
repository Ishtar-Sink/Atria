import { Card } from '@atria/ui';
import { useId, type ReactNode } from 'react';
import { formatDateTime } from '../../../shared/format/intl';
import { useT } from '../../../shared/i18n/i18n';
import { usePreferences } from '../../../shared/preferences/preferences-context';
import type { Visibility } from '../hooks/finance-cache';
import styles from './finance.module.css';

export interface Fact {
  label: string;
  value: ReactNode;
}

export function Facts({ items }: { items: readonly (Fact | null | false)[] }) {
  return (
    <dl className={styles.facts}>
      {items
        .filter((item): item is Fact => Boolean(item))
        .map((item) => (
          <div key={item.label} className={styles.factRow}>
            <dt>{item.label}</dt>
            <dd>{item.value}</dd>
          </div>
        ))}
    </dl>
  );
}

export interface DataCardProps {
  title: string;
  children: ReactNode;
}

/** Cartão da visão geral com título acessível. */
export function DataCard({ title, children }: DataCardProps) {
  const id = useId();
  return (
    <Card as="section" aria-labelledby={id}>
      <h2 id={id} className={styles.cardTitle}>
        {title}
      </h2>
      {children}
    </Card>
  );
}

export interface RecordCardProps {
  visibility: Visibility;
  created_at?: string | null;
  updated_at?: string | null;
  extra?: readonly (Fact | null | false)[];
  children?: ReactNode;
}

/** Cartão "Registro" da lateral: visibilidade, criado e atualizado em. */
export function RecordCard({
  visibility,
  created_at,
  updated_at,
  extra = [],
  children,
}: RecordCardProps) {
  const t = useT();
  const { locale, time_zone } = usePreferences();
  return (
    <DataCard title={t('finance.record.title')}>
      <Facts
        items={[
          ...extra,
          {
            label: t('finance.record.visibility'),
            value: t(`finance.visibility.${visibility}`),
          },
          created_at
            ? {
                label: t('finance.record.created_at'),
                value: formatDateTime(created_at, locale, time_zone),
              }
            : null,
          updated_at
            ? {
                label: t('finance.record.updated_at'),
                value: formatDateTime(updated_at, locale, time_zone),
              }
            : null,
        ]}
      />
      {children}
    </DataCard>
  );
}

/** Visão geral: zona principal com os dados e lateral com o "Registro" (PD-59). */
export function DetailGrid({ main, aside }: { main: ReactNode; aside: ReactNode }) {
  return (
    <div className={styles.detailGrid}>
      <div className={styles.column}>{main}</div>
      <div className={styles.column}>{aside}</div>
    </div>
  );
}
