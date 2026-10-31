import { Badge, Card, ConfirmDialog, MenuButton, type MenuItem } from '@atria/ui';
import { Link } from '@tanstack/react-router';
import { useId, useState, type ReactNode } from 'react';
import { formatDate } from '../../shared/format/intl';
import { registerMessages, useT } from '../../shared/i18n/i18n';
import { usePreferences } from '../../shared/preferences/preferences-context';
import messages from './i18n/pt-br.json';
import { LibraryItemCover, fileUrl } from './library-item-cover';
import type { LibraryKind, Visibility } from './use-library-items';
import styles from './library.module.css';

registerMessages('library', messages);

export interface OverviewFact {
  label: string;
  value: ReactNode;
}

export interface LibraryOverviewProps {
  kind: LibraryKind;
  id: string;
  title: string;
  cover_file_id?: string | null | undefined;
  /** Campos principais, à direita da capa (PD-37, PD-59). */
  facts: readonly OverviewFact[];
  /** Barra de progresso do livro, abaixo dos campos. */
  progress?: ReactNode;
  tags: readonly string[];
  visibility: Visibility;
  created_at: string;
  updated_at: string;
}

/** Endereço externo só vira link se for http ou https (nunca `javascript:`). */
export function SafeLink({ href }: { href: string }) {
  let safe = false;
  try {
    const protocol = new URL(href).protocol;
    safe = protocol === 'http:' || protocol === 'https:';
  } catch {
    safe = false;
  }
  return safe ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className={styles.breakable}>
      {href}
    </a>
  ) : (
    <span className={styles.breakable}>{href}</span>
  );
}

/**
 * Visão geral em cartões, igual nas três telas (PD-59): na zona principal o cartão de dados, com a
 * capa à esquerda dos campos como no formulário (PD-37); na lateral, o cartão "Registro".
 */
export function LibraryOverview({
  kind,
  id,
  title,
  cover_file_id,
  facts,
  progress,
  tags,
  visibility,
  created_at,
  updated_at,
}: LibraryOverviewProps) {
  const t = useT();
  const { locale, time_zone } = usePreferences();
  const base = useId();
  const record: [string, string][] = [
    [t('library.overview.visibility'), t(`library.visibility.${visibility}`)],
    [t('library.overview.created_at'), formatDate(created_at, locale, time_zone)],
    [t('library.overview.updated_at'), formatDate(updated_at, locale, time_zone)],
  ];
  return (
    <div className={styles.dash}>
      <div className={styles.zone}>
        <Card as="section" aria-labelledby={`${base}-data`}>
          <h2 id={`${base}-data`} className={styles.cardTitle}>
            {t('library.overview.data_title')}
          </h2>
          <div className={kind === 'book' ? styles.mediaCard : styles.mediaCardWide}>
            <LibraryItemCover kind={kind} id={id} title={title} file_id={cover_file_id} />
            <div className={styles.dataSide}>
              <dl className={styles.facts}>
                {facts.map((fact) => (
                  <div key={fact.label}>
                    <dt>{fact.label}</dt>
                    <dd>{fact.value}</dd>
                  </div>
                ))}
              </dl>
              {progress}
            </div>
          </div>
        </Card>
      </div>
      <div className={styles.zone}>
        <Card as="section" aria-labelledby={`${base}-record`}>
          <h2 id={`${base}-record`} className={styles.cardTitle}>
            {t('library.overview.record_title')}
          </h2>
          {tags.length > 0 ? (
            <ul aria-label={t('library.overview.tags')} className={styles.pills}>
              {tags.map((tag) => (
                <li key={tag}>
                  <Badge tone="info">{`#${tag}`}</Badge>
                </li>
              ))}
            </ul>
          ) : null}
          <dl className={styles.about}>
            {record.map(([name, value]) => (
              <div key={name}>
                <dt>{name}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </Card>
      </div>
    </div>
  );
}

/** Aba que outra feature acrescenta ao livro e ao artigo (por exemplo, Conexões e Destaques, na TASK-35). */
export interface LibraryExtraTab<T = unknown> {
  id: string;
  label: string;
  render: (item: T) => ReactNode;
}

function Svg({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export interface ItemHeaderActionsProps {
  kind: LibraryKind;
  id: string;
  /** Com PDF, "Ler" abre o leitor ao lado de "Editar" (PD-14). */
  read_to?: string | undefined;
  pdf_file_id?: string | null | undefined;
  /** Itens do "Mais ações" além de baixar e excluir. */
  extra_menu?: readonly MenuItem[];
  on_delete: () => void;
  delete_title: string;
  delete_text: string;
  delete_confirm: string;
  delete_cancel: string;
}

/** Cabeçalho das telas de detalhe: Ler e Editar à vista, o resto em "Mais ações" (PD-14). */
export function ItemHeaderActions({
  kind,
  id,
  read_to,
  pdf_file_id,
  extra_menu = [],
  on_delete,
  delete_title,
  delete_text,
  delete_confirm,
  delete_cancel,
}: ItemHeaderActionsProps) {
  const t = useT();
  const [confirming, setConfirming] = useState(false);
  const items: MenuItem[] = [
    ...(pdf_file_id
      ? [{ id: 'download', label: t(`library.${kind}.download_pdf`), href: fileUrl(pdf_file_id) }]
      : []),
    ...extra_menu,
    {
      id: 'delete',
      label: t('common.delete'),
      tone: 'danger' as const,
      onSelect: () => {
        setConfirming(true);
      },
    },
  ];
  return (
    <>
      {read_to && pdf_file_id ? (
        <Link to={read_to} className={[styles.linkButton, styles.linkPrimary].join(' ')}>
          {t(`library.${kind}.read`)}
        </Link>
      ) : null}
      <Link to={`/library/${kind}s/${id}/edit`} className={styles.linkButton}>
        <Svg>
          <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </Svg>
        {t('common.edit')}
      </Link>
      <MenuButton
        label={t('common.more_actions')}
        trigger={
          <Svg>
            <circle cx="5" cy="12" r="1" />
            <circle cx="12" cy="12" r="1" />
            <circle cx="19" cy="12" r="1" />
          </Svg>
        }
        items={items}
      />
      <ConfirmDialog
        open={confirming}
        title={delete_title}
        description={delete_text}
        confirmLabel={delete_confirm}
        cancelLabel={delete_cancel}
        onCancel={() => {
          setConfirming(false);
        }}
        onConfirm={() => {
          setConfirming(false);
          on_delete();
        }}
      />
    </>
  );
}
