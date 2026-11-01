import {
  Button,
  EmptyState,
  ErrorState,
  GridIcon,
  ItemSwatch,
  ListIcon,
  LoadingState,
  SelectField,
  Toolbar,
  ViewSwitcher,
} from '@atria/ui';
import { Link, useRouterState } from '@tanstack/react-router';
import { useEffect } from 'react';
import { formatDate } from '../../../shared/format/intl';
import { useT } from '../../../shared/i18n/i18n';
import { useScreenInfo } from '../../../shared/layout/screen-info';
import { StickyPageHeader } from '../../../shared/layout/sticky-page-header';
import { rememberListLocation } from '../../../shared/navigation/back-target';
import { usePreferences } from '../../../shared/preferences/preferences-context';
import { useListSearch } from '../../../shared/url-state/use-list-search';
import {
  NOTE_SORTS,
  NOTE_VISIBILITIES,
  notesSearchSchema,
  searchToFilters,
  useNotes,
  type NoteListItem,
} from '../hooks/use-notes';
import styles from './notes.module.css';

function useUpdatedText(note: NoteListItem): string | undefined {
  const t = useT();
  const { locale, time_zone } = usePreferences();
  return note.updated_at === null
    ? undefined
    : t('notes.list.updated', { date: formatDate(note.updated_at, locale, time_zone) });
}

function NoteRow({ note }: { note: NoteListItem }) {
  const t = useT();
  const updated = useUpdatedText(note);
  return (
    <li className={styles.row}>
      <ItemSwatch id={note.id} className={styles.swatch} />
      <div className={styles.rowMain}>
        <Link to={`/notes/${note.id}`} className={styles.rowTitle}>
          {note.title}
        </Link>
        <span className={styles.rowSub}>
          {note.preview === '' ? t('notes.list.no_text') : note.preview}
        </span>
      </div>
      {updated ? <span className={styles.rowDate}>{updated}</span> : null}
    </li>
  );
}

function NoteTile({ note }: { note: NoteListItem }) {
  const t = useT();
  const updated = useUpdatedText(note);
  return (
    <li className={styles.tile}>
      <ItemSwatch id={note.id} className={styles.art} />
      <Link to={`/notes/${note.id}`} className={styles.rowTitle}>
        {note.title}
      </Link>
      <span className={styles.rowSub}>
        {note.preview === '' ? t('notes.list.no_text') : note.preview}
      </span>
      {updated ? <span className={styles.rowDate}>{updated}</span> : null}
    </li>
  );
}

export function NotesScreen() {
  const t = useT();
  const { search, setSearch } = useListSearch(notesSearchSchema, { view_key: 'notes' });
  const query = useNotes(searchToFilters(search));
  const { set_items } = useScreenInfo();
  const href = useRouterState({ select: (state) => state.location.href });

  useEffect(() => {
    rememberListLocation('notes', href);
  }, [href]);

  const notes = query.data?.pages.flatMap((page) => page.items) ?? [];
  const total = notes.length;
  useEffect(() => {
    set_items(
      query.isSuccess
        ? [{ label: t('notes.list.items_label'), value: t('notes.list.items', { count: total }) }]
        : [],
    );
    return () => {
      set_items([]);
    };
  }, [query.isSuccess, total, set_items, t]);

  const create = (
    <Link to="/notes/new" className={[styles.linkButton, styles.linkPrimary].join(' ')}>
      {t('notes.list.create')}
    </Link>
  );

  let body;
  if (query.isPending) {
    body = <LoadingState label={t('notes.list.loading')} />;
  } else if (query.isError) {
    body = (
      <ErrorState
        title={t('notes.list.error_title')}
        description={t('notes.list.error_description')}
        retryLabel={t('notes.list.retry')}
        onRetry={() => {
          void query.refetch();
        }}
      />
    );
  } else if (notes.length === 0) {
    if (search.q !== undefined) {
      body = (
        <EmptyState
          title={t('notes.list.empty_search_title')}
          description={t('notes.list.empty_search_description')}
        />
      );
    } else if (search.visibility !== undefined) {
      body = (
        <EmptyState
          title={t('notes.list.empty_filtered_title')}
          description={t('notes.list.empty_filtered_description')}
        />
      );
    } else {
      body = (
        <EmptyState
          title={t('notes.list.empty_title')}
          description={t('notes.list.empty_description')}
          action={create}
        />
      );
    }
  } else {
    body = (
      <>
        {search.view === 'grid' ? (
          <ul className={styles.grid}>
            {notes.map((note) => (
              <NoteTile key={note.id} note={note} />
            ))}
          </ul>
        ) : (
          <ul className={styles.list}>
            {notes.map((note) => (
              <NoteRow key={note.id} note={note} />
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
              {t('notes.list.more')}
            </Button>
          </div>
        ) : null}
      </>
    );
  }

  return (
    <div>
      <StickyPageHeader
        eyebrow={t('notes.list.eyebrow')}
        title={t('notes.list.title')}
        subtitle={t('notes.list.subtitle')}
        actions={create}
      />
      <Toolbar
        searchLabel={t('common.search')}
        searchPlaceholder={t('notes.list.search_placeholder')}
        searchValue={search.q ?? ''}
        onSearchChange={(value) => {
          setSearch({ q: value === '' ? undefined : value });
        }}
        filters={
          <div role="group" aria-label={t('common.filters')} className={styles.actions}>
            <SelectField
              label={t('notes.list.filter_visibility')}
              value={search.visibility ?? ''}
              options={[
                { value: '', label: t('notes.list.filter_visibility_all') },
                ...NOTE_VISIBILITIES.map((visibility) => ({
                  value: visibility,
                  label: t(`notes.form.visibility_${visibility}`),
                })),
              ]}
              onChange={(value) => {
                setSearch({ visibility: NOTE_VISIBILITIES.find((item) => item === value) });
              }}
            />
            <SelectField
              label={t('notes.list.sort')}
              value={search.sort}
              options={NOTE_SORTS.map((sort) => ({
                value: sort,
                label: t(`notes.list.sort_${sort}`),
              }))}
              onChange={(value) => {
                setSearch({ sort: NOTE_SORTS.find((item) => item === value) ?? 'updated_at' });
              }}
            />
          </div>
        }
      >
        <ViewSwitcher
          label={t('common.view')}
          value={search.view}
          options={[
            { value: 'list', label: t('notes.list.view_list'), icon: <ListIcon /> },
            { value: 'grid', label: t('notes.list.view_grid'), icon: <GridIcon /> },
          ]}
          onChange={(value) => {
            setSearch({ view: value === 'grid' ? 'grid' : 'list' });
          }}
        />
      </Toolbar>
      <div aria-live="polite">{body}</div>
    </div>
  );
}
