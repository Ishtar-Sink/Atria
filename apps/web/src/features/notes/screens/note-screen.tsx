import { ConfirmDialog, ErrorState, LoadingState, EmptyState, MenuButton, Tabs } from '@atria/ui';
import { Link, useParams } from '@tanstack/react-router';
import { useState, type ReactNode } from 'react';
import { z } from 'zod';
import { formatDate } from '../../../shared/format/intl';
import { useT } from '../../../shared/i18n/i18n';
import { StickyPageHeader } from '../../../shared/layout/sticky-page-header';
import { BackLink } from '../../../shared/navigation/back-link';
import { usePreferences } from '../../../shared/preferences/preferences-context';
import { useListSearch } from '../../../shared/url-state/use-list-search';
import { isNoteNotFound, useDeleteNote, useNote, type Note } from '../hooks/use-notes';
import { NoteOverview } from './note-overview';
import styles from './notes.module.css';

/** Aba que outra feature acrescenta à nota (por exemplo, Conexões, montada na TASK-35). */
export interface NoteExtraTab {
  id: string;
  label: string;
  render: (note: Note) => ReactNode;
}

export const noteTabSearchSchema = z.object({
  tab: z.string().default('overview'),
});

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

export interface NoteScreenProps {
  extra_tabs?: readonly NoteExtraTab[];
}

/** Tela da nota: cabeçalho, Visão geral e as abas extras (RF-43, PD-14, PD-59). */
export function NoteScreen({ extra_tabs = [] }: NoteScreenProps) {
  const t = useT();
  const { locale, time_zone } = usePreferences();
  const noteId = useParams({
    strict: false,
    select: (params: Record<string, unknown>) =>
      typeof params.noteId === 'string' ? params.noteId : undefined,
  });
  const id = noteId ?? '';
  const note = useNote(id);
  const remove = useDeleteNote();
  const { search, setSearch } = useListSearch(noteTabSearchSchema);
  const [confirming, setConfirming] = useState(false);

  if (note.isPending) return <LoadingState label={t('notes.detail.loading')} />;
  if (note.isError) {
    if (isNoteNotFound(note.error)) {
      return (
        <EmptyState
          title={t('notes.detail.not_found_title')}
          description={t('notes.detail.not_found_description')}
          action={
            <Link to="/notes" className={styles.linkButton}>
              {t('notes.detail.not_found_link')}
            </Link>
          }
        />
      );
    }
    return (
      <ErrorState
        title={t('notes.detail.error_title')}
        description={t('notes.detail.error_description')}
        retryLabel={t('notes.detail.retry')}
        onRetry={() => {
          void note.refetch();
        }}
      />
    );
  }

  const data = note.data;
  const tabs = [
    { id: 'overview', label: t('notes.detail.tab_overview'), panel: <NoteOverview note={data} /> },
    ...extra_tabs.map((tab) => ({ id: tab.id, label: tab.label, panel: tab.render(data) })),
  ];
  const current = tabs.some((tab) => tab.id === search.tab) ? search.tab : 'overview';

  return (
    <div>
      <StickyPageHeader
        back={<BackLink module="notes" fallback_to="/notes" />}
        eyebrow={t('notes.detail.eyebrow')}
        title={data.title}
        subtitle={t('notes.detail.subtitle', {
          date: formatDate(data.updated_at, locale, time_zone),
        })}
        actions={
          <>
            <Link to={`/notes/${data.id}/edit`} className={styles.linkButton}>
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
              items={[
                {
                  id: 'delete',
                  label: t('common.delete'),
                  tone: 'danger',
                  onSelect: () => {
                    setConfirming(true);
                  },
                },
              ]}
            />
          </>
        }
      />
      <Tabs
        label={t('notes.detail.tabs')}
        tabs={tabs}
        value={current}
        onChange={(tab) => {
          setSearch({ tab });
        }}
      />
      <ConfirmDialog
        open={confirming}
        title={t('notes.detail.delete_title')}
        description={t('notes.detail.delete_description')}
        confirmLabel={t('notes.detail.delete_confirm')}
        cancelLabel={t('notes.detail.delete_cancel')}
        onCancel={() => {
          setConfirming(false);
        }}
        onConfirm={() => {
          setConfirming(false);
          remove.mutate({ id: data.id });
        }}
      />
    </div>
  );
}
