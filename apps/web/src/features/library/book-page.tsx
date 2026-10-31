import { ErrorState, LoadingState, Tabs } from '@atria/ui';
import { useParams } from '@tanstack/react-router';
import { useMemo, type ReactNode } from 'react';
import { z } from 'zod';
import { formatNumber } from '../../shared/format/intl';
import { registerMessages, useT } from '../../shared/i18n/i18n';
import { StickyPageHeader } from '../../shared/layout/sticky-page-header';
import { BackLink } from '../../shared/navigation/back-link';
import { usePreferences } from '../../shared/preferences/preferences-context';
import { useListSearch } from '../../shared/url-state/use-list-search';
import messages from './i18n/pt-br.json';
import { BookProgressBar } from './book-progress';
import { ItemNotesTab } from './item-notes-tab';
import {
  ItemHeaderActions,
  LibraryOverview,
  type LibraryExtraTab,
  type OverviewFact,
} from './library-overview';
import { ReadingHistoryTab } from './reading-history-tab';
import { useBook, useReadingSessionList } from './use-book';
import { useBookProgress } from './use-book-progress';
import type { Book } from './use-library-items';
import { useDeleteItem } from './use-library-mutations';

registerMessages('library', messages);

export type BookExtraTab = LibraryExtraTab<Book>;

const tabSearchSchema = z.object({ tab: z.string().default('overview') });

export interface BookPageProps {
  /** Abas que outra feature acrescenta (Conexões e Destaques, montadas na TASK-35). */
  extra_tabs?: readonly BookExtraTab[];
}

/** Tela do livro: visão geral em cartões, histórico de leitura e notas em abas (RF-49, RF-50, PD-59). */
export function BookPage({ extra_tabs = [] }: BookPageProps) {
  const t = useT();
  const { locale } = usePreferences();
  const book_id =
    useParams({
      strict: false,
      select: (params: Record<string, unknown>) =>
        typeof params.bookId === 'string' ? params.bookId : undefined,
    }) ?? '';
  const book = useBook(book_id);
  const sessions = useReadingSessionList(book_id);
  const remove = useDeleteItem('book');
  const { search, setSearch } = useListSearch(tabSearchSchema);
  // O progresso vem das sessões que a tela mostra; assim muda na hora, sem esperar o servidor.
  const counted = useMemo(
    () => sessions.data ?? [{ pages_read: book.data?.pages_read_total ?? 0 }],
    [sessions.data, book.data?.pages_read_total],
  );
  const progress = useBookProgress(book.data?.page_count, counted);

  if (book.isPending) return <LoadingState label={t('library.book.loading')} />;
  if (book.isError) {
    return (
      <ErrorState
        title={t('library.book.error_title')}
        retryLabel={t('library.form.retry')}
        onRetry={() => {
          void book.refetch();
        }}
      />
    );
  }
  const data = book.data;
  const dash = t('library.overview.none');
  const facts: OverviewFact[] = [
    { label: t('library.overview.status'), value: t(`library.book.status.${data.reading_status}`) },
    { label: t('library.overview.author'), value: data.author ?? dash },
    { label: t('library.overview.publisher'), value: data.publisher ?? dash },
    {
      label: t('library.overview.pages'),
      value: data.page_count ? formatNumber(data.page_count, locale) : dash,
    },
  ];

  const tabs: { id: string; label: string; panel: ReactNode }[] = [
    {
      id: 'overview',
      label: t('library.book.tab_overview'),
      panel: (
        <LibraryOverview
          kind="book"
          id={data.id}
          title={data.title}
          cover_file_id={data.cover_file_id}
          facts={facts}
          progress={
            <BookProgressBar
              label={t('library.book.progress_label')}
              percent={progress.percent}
              pages_read={progress.pages_read}
              page_count={data.page_count}
              detailed
            />
          }
          tags={data.tags}
          visibility={data.visibility}
          created_at={data.created_at}
          updated_at={data.updated_at}
        />
      ),
    },
    {
      id: 'reading_history',
      label: t('library.book.tab_reading_history'),
      panel: <ReadingHistoryTab book={data} />,
    },
    {
      id: 'notes',
      label: t('library.book.tab_notes'),
      panel: <ItemNotesTab kind="book" item_id={data.id} />,
    },
    ...extra_tabs.map((tab) => ({ id: tab.id, label: tab.label, panel: tab.render(data) })),
  ];
  const current = tabs.some((tab) => tab.id === search.tab) ? search.tab : 'overview';

  return (
    <div>
      <StickyPageHeader
        back={<BackLink module="library" fallback_to="/library" />}
        eyebrow={t('library.book.eyebrow')}
        title={data.title}
        {...(data.author ? { subtitle: data.author } : {})}
        actions={
          <ItemHeaderActions
            kind="book"
            id={data.id}
            read_to={`/library/books/${data.id}/read`}
            pdf_file_id={data.pdf_file_id}
            extra_menu={[
              {
                id: 'report',
                label: t('library.book.report_read_pages'),
                href: `/reports/read-pages?book_id=${encodeURIComponent(data.id)}&run=1&from_module=library`,
              },
            ]}
            on_delete={() => {
              remove.mutate({ id: data.id });
            }}
            delete_title={t('library.book.delete_title')}
            delete_text={t('library.book.delete_text')}
            delete_confirm={t('library.book.delete_confirm')}
            delete_cancel={t('library.book.delete_cancel')}
          />
        }
      />
      <Tabs
        label={t('library.book.tabs')}
        tabs={tabs}
        value={current}
        onChange={(tab) => {
          setSearch({ tab });
        }}
      />
    </div>
  );
}
