import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  LoadingState,
  MenuButton,
  Tabs,
  TextField,
  Toolbar,
  ViewSwitcher,
  type BadgeTone,
} from '@atria/ui';
import { Link, useNavigate, useRouterState } from '@tanstack/react-router';
import { useEffect, useState, type ReactNode } from 'react';
import { registerMessages, useT, type Translate } from '../../shared/i18n/i18n';
import { useScreenInfo } from '../../shared/layout/screen-info';
import { StickyPageHeader } from '../../shared/layout/sticky-page-header';
import { CreateTypeDialog, type CreateType } from '../../shared/forms/create-type-dialog';
import { rememberListLocation } from '../../shared/navigation/back-target';
import messages from './i18n/pt-br.json';
import { BookProgressBar } from './book-progress';
import { LibraryItemCover } from './library-item-cover';
import { bookProgressPercent } from './use-book-progress';
import {
  KIND_TAB,
  LIBRARY_TABS,
  TAB_KIND,
  TAB_STATUSES,
  searchToFilters,
  useLibraryItems,
  useLibrarySearch,
  type Article,
  type Book,
  type LibraryItem,
  type LibraryKind,
  type LibraryTab,
  type Video,
} from './use-library-items';
import styles from './library.module.css';

registerMessages('library', messages);

function Icon({ children }: { children: ReactNode }) {
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
      {children}
    </svg>
  );
}

const BookIcon = () => (
  <Icon>
    <path d="M4 19.5V5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2.5Z" />
    <path d="M8 7h7" />
  </Icon>
);
const ArticleIcon = () => (
  <Icon>
    <path d="M6 3h9l4 4v14H6Z" />
    <path d="M14 3v5h5M9 13h7M9 17h7" />
  </Icon>
);
const VideoIcon = () => (
  <Icon>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="m10 9 5 3-5 3Z" />
  </Icon>
);
const GridIcon = () => (
  <Icon>
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
  </Icon>
);
const ListIcon = () => (
  <Icon>
    <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
  </Icon>
);

/** Tipos do diálogo "Novo": o `CreateTypeDialog` da base mostra um cartão por tipo (PD-09, DEC-008). */
export const LIBRARY_CREATE_TYPES: readonly {
  id: LibraryKind;
  label_key: string;
  description_key: string;
  href: string;
  icon: ReactNode;
}[] = [
  {
    id: 'book',
    label_key: 'library.create.book',
    description_key: 'library.create.book_hint',
    href: '/library/books/new',
    icon: <BookIcon />,
  },
  {
    id: 'article',
    label_key: 'library.create.article',
    description_key: 'library.create.article_hint',
    href: '/library/articles/new',
    icon: <ArticleIcon />,
  },
  {
    id: 'video',
    label_key: 'library.create.video',
    description_key: 'library.create.video_hint',
    href: '/library/videos/new',
    icon: <VideoIcon />,
  },
];

const STATUS_TONE: Record<string, BadgeTone> = {
  want_to_read: 'info',
  to_read: 'info',
  to_watch: 'info',
  reading: 'warning',
  watching: 'warning',
  read: 'success',
  watched: 'success',
};

interface ShelfEntry {
  kind: LibraryKind;
  id: string;
  title: string;
  subtitle: string | undefined;
  cover_file_id: string | null | undefined;
  status_label: string;
  status_tone: BadgeTone;
  /** Só o livro tem progresso (RN-22). */
  book?: { percent: number | null; pages_read: number; page_count: number | null | undefined };
}

function toEntry(kind: LibraryKind, item: LibraryItem, t: Translate): ShelfEntry {
  if (kind === 'book') {
    const book = item as Book;
    return {
      kind,
      id: book.id,
      title: book.title,
      subtitle: book.author ?? undefined,
      cover_file_id: book.cover_file_id,
      status_label: t(`library.book.status.${book.reading_status}`),
      status_tone: STATUS_TONE[book.reading_status] ?? 'info',
      book: {
        percent:
          book.progress_percent ?? bookProgressPercent(book.page_count, book.pages_read_total),
        pages_read: book.pages_read_total,
        page_count: book.page_count,
      },
    };
  }
  if (kind === 'article') {
    const article = item as Article;
    return {
      kind,
      id: article.id,
      title: article.title,
      subtitle: article.author ?? article.source ?? undefined,
      cover_file_id: article.cover_file_id,
      status_label: t(`library.article.status.${article.reading_status}`),
      status_tone: STATUS_TONE[article.reading_status] ?? 'info',
    };
  }
  const video = item as Video;
  return {
    kind,
    id: video.id,
    title: video.title || video.url,
    subtitle: video.channel ?? undefined,
    cover_file_id: video.thumbnail_file_id,
    status_label: t(`library.video.status.${video.watch_status}`),
    status_tone: STATUS_TONE[video.watch_status] ?? 'info',
  };
}

function detailHref(entry: ShelfEntry): string {
  return `/library/${KIND_TAB[entry.kind]}/${entry.id}`;
}

function ShelfFoot({ entry, t }: { entry: ShelfEntry; t: Translate }) {
  return (
    <div className={styles.tileFoot}>
      {entry.book ? (
        <BookProgressBar
          label={t('library.shelf.progress_label', { title: entry.title })}
          percent={entry.book.percent}
          pages_read={entry.book.pages_read}
          page_count={entry.book.page_count}
        />
      ) : null}
      <div className={styles.pills}>
        <Badge tone={entry.status_tone}>{entry.status_label}</Badge>
      </div>
    </div>
  );
}

function ShelfTile({ entry }: { entry: ShelfEntry }) {
  const t = useT();
  return (
    <li className={styles.tile} data-kind={entry.kind}>
      <LibraryItemCover
        kind={entry.kind}
        id={entry.id}
        title={entry.title}
        file_id={entry.cover_file_id}
        decorative
      />
      <div className={styles.tileBody}>
        <Link to={detailHref(entry)} className={styles.stretched}>
          {entry.title}
        </Link>
        {entry.subtitle ? <span className={styles.sub}>{entry.subtitle}</span> : null}
      </div>
      <ShelfFoot entry={entry} t={t} />
    </li>
  );
}

function ShelfRow({ entry }: { entry: ShelfEntry }) {
  const t = useT();
  return (
    <li className={styles.row} data-kind={entry.kind}>
      <LibraryItemCover
        kind={entry.kind}
        id={entry.id}
        title={entry.title}
        file_id={entry.cover_file_id}
        decorative
        className={styles.rowCover}
      />
      <div className={styles.rowMain}>
        <Link to={detailHref(entry)} className={styles.stretched}>
          {entry.title}
        </Link>
        {entry.subtitle ? <span className={styles.sub}>{entry.subtitle}</span> : null}
      </div>
      <div className={styles.rowFoot}>
        <ShelfFoot entry={entry} t={t} />
      </div>
    </li>
  );
}

/** Filtro de status em chips alternáveis, um grupo por aba (PD-13, PD-35). */
function StatusChips({
  tab,
  value,
  onChange,
}: {
  tab: LibraryTab;
  value: string | undefined;
  onChange: (status: string | undefined) => void;
}) {
  const t = useT();
  const kind = TAB_KIND[tab];
  const options = [
    { value: undefined, label: t('library.shelf.status_all') },
    ...TAB_STATUSES[tab].map((status) => ({
      value: status,
      label: t(`library.${kind}.status.${status}`),
    })),
  ];
  return (
    <div role="group" aria-label={t('library.shelf.filters_label')} className={styles.chipRow}>
      {options.map((option) => (
        <button
          key={option.label}
          type="button"
          aria-pressed={option.value === value}
          className={styles.chipToggle}
          onClick={() => {
            onChange(option.value);
          }}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/** Etiqueta do filtro: grava na URL com Enter e limpa com o campo vazio. */
function TagFilter({ value, onCommit }: { value: string; onCommit: (value: string) => void }) {
  const t = useT();
  const [draft, setDraft] = useState(value);
  const [seen, setSeen] = useState(value);
  if (seen !== value) {
    setSeen(value);
    setDraft(value);
  }
  return (
    <TextField
      className={styles.tagFilter}
      label={t('library.shelf.filter_tag')}
      value={draft}
      autoComplete="off"
      onChange={(event) => {
        setDraft(event.target.value);
        if (event.target.value === '') onCommit('');
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        onCommit(draft.trim());
      }}
    />
  );
}

/** Estante do Acervo: uma aba por tipo, status em chips, busca e grade ou lista (PD-24, PD-35, PD-38). */
export function ShelfPage() {
  const t = useT();
  const navigate = useNavigate();
  const { search, setSearch } = useLibrarySearch();
  const filters = searchToFilters(search);
  const query = useLibraryItems(filters);
  const { set_items } = useScreenInfo();
  const href = useRouterState({ select: (state) => state.location.href });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    rememberListLocation('library', href);
  }, [href]);

  const kind = TAB_KIND[search.tab];
  const entries = (query.data?.pages.flatMap((page) => page.items as LibraryItem[]) ?? []).map(
    (item) => toEntry(kind, item, t),
  );
  const total = entries.length;
  useEffect(() => {
    set_items(
      query.isSuccess
        ? [
            {
              label: t('library.shelf.items_label'),
              value: t('library.shelf.items', { count: total }),
            },
          ]
        : [],
    );
    return () => {
      set_items([]);
    };
  }, [query.isSuccess, total, set_items, t]);

  const filtered =
    filters.status !== undefined || filters.q !== undefined || filters.tag !== undefined;

  const create = (
    <Button
      variant="primary"
      onClick={() => {
        setCreating(true);
      }}
    >
      {t('library.shelf.new')}
    </Button>
  );

  let body: ReactNode;
  if (query.isPending) {
    body = <LoadingState label={t('library.shelf.loading')} />;
  } else if (query.isError) {
    body = (
      <ErrorState
        title={t('library.shelf.error_title')}
        description={t('library.shelf.error_text')}
        retryLabel={t('library.shelf.retry')}
        onRetry={() => {
          void query.refetch();
        }}
      />
    );
  } else if (entries.length === 0) {
    body = filtered ? (
      <EmptyState
        title={t('library.shelf.empty_filtered_title')}
        description={t('library.shelf.empty_filtered_text')}
      />
    ) : (
      <EmptyState
        title={t('library.shelf.empty_title')}
        description={t('library.shelf.empty_text')}
      />
    );
  } else {
    const grid_class = kind === 'book' ? styles.shelfGrid : styles.shelfGridWide;
    body = (
      <>
        {search.view === 'grid' ? (
          <ul className={grid_class}>
            {entries.map((entry) => (
              <ShelfTile key={entry.id} entry={entry} />
            ))}
          </ul>
        ) : (
          <ul className={styles.list}>
            {entries.map((entry) => (
              <ShelfRow key={entry.id} entry={entry} />
            ))}
          </ul>
        )}
        {query.hasNextPage ? (
          <div className={styles.more}>
            <Button
              loading={query.isFetchingNextPage}
              onClick={() => {
                void query.fetchNextPage();
              }}
            >
              {t('library.shelf.more')}
            </Button>
          </div>
        ) : null}
      </>
    );
  }

  const panel = (
    <>
      <Toolbar
        searchLabel={t('library.shelf.search_label')}
        searchPlaceholder={t('library.shelf.search_placeholder')}
        searchValue={search.q ?? ''}
        onSearchChange={(value) => {
          setSearch({ q: value === '' ? undefined : value });
        }}
        filters={
          <div className={styles.filters}>
            <StatusChips
              tab={search.tab}
              value={filters.status}
              onChange={(status) => {
                setSearch({ status });
              }}
            />
            <TagFilter
              value={search.tag ?? ''}
              onCommit={(value) => {
                setSearch({ tag: value === '' ? undefined : value });
              }}
            />
          </div>
        }
      >
        <ViewSwitcher
          label={t('library.shelf.view_label')}
          value={search.view}
          options={[
            { value: 'grid', label: t('library.shelf.view_grid'), icon: <GridIcon /> },
            { value: 'list', label: t('library.shelf.view_list'), icon: <ListIcon /> },
          ]}
          onChange={(value) => {
            setSearch({ view: value === 'list' ? 'list' : 'grid' });
          }}
        />
      </Toolbar>
      <div aria-live="polite">{body}</div>
    </>
  );

  const types: CreateType[] = LIBRARY_CREATE_TYPES.map((type) => ({
    id: type.id,
    label: t(type.label_key),
    description: t(type.description_key),
    icon: type.icon,
    href: type.href,
  }));

  return (
    <div>
      <StickyPageHeader
        eyebrow={t('library.shelf.eyebrow')}
        title={t('library.shelf.title')}
        subtitle={t('library.shelf.subtitle')}
        actions={
          <div className={styles.actions}>
            <MenuButton
              label={t('library.shelf.reports')}
              trigger={t('library.shelf.reports')}
              items={[
                {
                  id: 'read-pages',
                  label: t('library.shelf.report_read_pages'),
                  href: '/reports/read-pages?from_module=library',
                },
                {
                  id: 'lib-status',
                  label: t('library.shelf.report_lib_status'),
                  href: '/reports/lib-status?from_module=library',
                },
              ]}
            />
            {create}
          </div>
        }
      />
      <Tabs
        label={t('library.shelf.tabs_label')}
        value={search.tab}
        tabs={LIBRARY_TABS.map((tab) => ({
          id: tab,
          label: t(`library.shelf.tab_${tab}`),
          panel: tab === search.tab ? panel : null,
        }))}
        onChange={(tab) => {
          // O status e a visualização são de cada aba: a nova aba começa com os dela (PD-24, PD-35).
          setSearch({
            tab: LIBRARY_TABS.find((value) => value === tab) ?? 'books',
            status: undefined,
            view: undefined,
          });
        }}
      />
      <CreateTypeDialog
        open={creating}
        title={t('library.create.title')}
        types={types}
        focused_type={TAB_KIND[search.tab]}
        on_close={() => {
          setCreating(false);
        }}
        on_select={(type) => {
          void navigate({ to: type.href });
        }}
      />
    </div>
  );
}
