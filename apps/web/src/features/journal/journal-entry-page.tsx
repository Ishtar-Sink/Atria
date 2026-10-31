import {
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  LoadingState,
  MenuButton,
  Tabs,
} from '@atria/ui';
import { useNavigate } from '@tanstack/react-router';
import { useState, type ReactNode } from 'react';
import { ApiProblem } from '../../shared/api/problem';
import { formatDateTime } from '../../shared/format/intl';
import { useT } from '../../shared/i18n/i18n';
import { StickyPageHeader } from '../../shared/layout/sticky-page-header';
import { BackLink } from '../../shared/navigation/back-link';
import { usePreferences } from '../../shared/preferences/preferences-context';
import { JournalEntryOverview } from './journal-entry-overview';
import styles from './journal-entry-page.module.css';
import { useDeleteJournalEntry } from './use-journal-entry-mutations';
import { useJournalEntry } from './use-journal-entry';

export interface ExtraTab {
  id: string;
  label: string;
  render: () => ReactNode;
}

export interface JournalEntryPageProps {
  entry_id: string;
  tab: string;
  on_tab_change: (tab: string) => void;
  /** Abas de outras features (Conexões), montadas pela TASK-35. */
  extra_tabs?: readonly ExtraTab[];
}

const TITLE_LENGTH = 80;

/** A primeira linha do texto, cortada para caber no título. */
function titleOf(text: string, empty: string): string {
  const first =
    text
      .split('\n')
      .find((line) => line.trim() !== '')
      ?.trim() ?? '';
  if (first === '') return empty;
  return first.length > TITLE_LENGTH ? `${first.slice(0, TITLE_LENGTH - 1).trimEnd()}…` : first;
}

function PencilIcon() {
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
      <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

export function JournalEntryPage({
  entry_id,
  tab,
  on_tab_change,
  extra_tabs = [],
}: JournalEntryPageProps) {
  const t = useT();
  const { locale, time_zone } = usePreferences();
  const navigate = useNavigate();
  const remove = useDeleteJournalEntry();
  const [confirming, setConfirming] = useState(false);
  const query = useJournalEntry(entry_id);
  const entry = query.data;

  if (query.isPending) return <LoadingState label={t('common.loading')} />;
  if (entry === undefined) {
    const missing = query.error instanceof ApiProblem && query.error.status === 404;
    return missing ? (
      <EmptyState
        title={t('journal.entry.not_found_title')}
        description={t('journal.entry.not_found_text')}
      />
    ) : (
      <ErrorState
        title={t('journal.entry.error_title')}
        retryLabel={t('common.retry')}
        onRetry={() => {
          void query.refetch();
        }}
      />
    );
  }

  const tabs = [
    {
      id: 'overview',
      label: t('journal.entry.tab_overview'),
      panel: <JournalEntryOverview entry={entry} />,
    },
    ...extra_tabs.map((extra) => ({ id: extra.id, label: extra.label, panel: extra.render() })),
  ];
  const selected = tabs.some((item) => item.id === tab) ? tab : 'overview';

  return (
    <div className={styles.screen}>
      <StickyPageHeader
        back={<BackLink module="journal" fallback_to="/journal" />}
        eyebrow={t('journal.entry.eyebrow')}
        title={titleOf(entry.text, t('journal.list.no_text'))}
        subtitle={formatDateTime(entry.occurred_at, locale, time_zone)}
        actions={
          <div className={styles.actions}>
            <Button
              onClick={() => {
                void navigate({ to: '/journal/$entryId/edit', params: { entryId: entry.id } });
              }}
            >
              <span className={styles.icon}>
                <PencilIcon />
              </span>
              {t('journal.entry.edit')}
            </Button>
            <MenuButton
              label={t('common.more_actions')}
              trigger={
                <>
                  <span aria-hidden="true">⋯</span> {t('common.more_actions')}
                </>
              }
              items={[
                {
                  id: 'delete',
                  label: t('journal.entry.delete'),
                  tone: 'danger',
                  onSelect: () => {
                    setConfirming(true);
                  },
                },
              ]}
            />
          </div>
        }
      />
      <Tabs label={t('journal.entry.tabs')} tabs={tabs} value={selected} onChange={on_tab_change} />
      <ConfirmDialog
        open={confirming}
        title={t('journal.entry.delete_title')}
        description={t('journal.entry.delete_confirm')}
        confirmLabel={t('journal.entry.delete')}
        cancelLabel={t('common.cancel')}
        onCancel={() => {
          setConfirming(false);
        }}
        onConfirm={() => {
          setConfirming(false);
          remove.mutate(entry.id, {
            onSuccess: () => {
              void navigate({ to: '/journal' });
            },
          });
        }}
      />
    </div>
  );
}
