import type { Schemas } from '@atria/contracts';
import { Button, EmptyState, ErrorState, ItemSwatch, LoadingState, TextField } from '@atria/ui';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';
import { useEffect, useRef, type KeyboardEvent } from 'react';
import { z } from 'zod';
import { api } from '../../shared/api/client';
import { useT } from '../../shared/i18n/i18n';
import { FormScreen } from '../../shared/layout/form-screen';
import { StickyPageHeader } from '../../shared/layout/sticky-page-header';
import { BackLink } from '../../shared/navigation/back-link';
import { useListSearch } from '../../shared/url-state/use-list-search';
import styles from './connections.module.css';
import { isLinkableType, type LinkableType } from './entity-categories';
import { useCreateConnection } from './use-connection-mutations';
import { useConnectionItems } from './use-connections';
import { linkedKey, useLinkedTitles } from './use-linked-titles';

const SEARCH_ID = 'connections-new-search';

type SearchResponse = Schemas['SearchResponse'];

const optionalText = z.preprocess(
  (value) => (typeof value === 'string' && value !== '' ? value : undefined),
  z.string().optional(),
);

/** Origem da ligação e texto da busca na URL ([project/frontend-13]). */
export const newConnectionSearchSchema = z.object({
  source_type: optionalText,
  source_id: optionalText,
  q: optionalText,
});

interface Candidate {
  type: LinkableType;
  id: string;
  title: string;
}

function useCandidates(text: string | undefined) {
  const term = text?.trim() ?? '';
  const query = useQuery({
    queryKey: ['connections', 'search', term],
    queryFn: ({ signal }) => api.get<SearchResponse>('/search', { query: { q: term }, signal }),
    enabled: term !== '',
  });
  const candidates: Candidate[] = (query.data?.groups ?? []).flatMap((group) =>
    group.items.flatMap((hit) =>
      isLinkableType(hit.entity_type)
        ? [{ type: hit.entity_type, id: hit.id, title: hit.title }]
        : [],
    ),
  );
  return { query, candidates, term };
}

function SourceMissing() {
  const t = useT();
  return (
    <FormScreen>
      <EmptyState
        title={t('connections.new.invalid_title')}
        description={t('connections.new.invalid')}
      />
    </FormScreen>
  );
}

/** Tela de ligar: escolhe a entidade a ligar à de origem, em rota própria (RF-18). */
export function NewConnectionPage() {
  const { search } = useListSearch(newConnectionSearchSchema);
  const { source_type, source_id } = search;
  if (source_type === undefined || source_id === undefined || !isLinkableType(source_type)) {
    return <SourceMissing />;
  }
  return <NewConnectionForm source_type={source_type} source_id={source_id} />;
}

function NewConnectionForm({
  source_type,
  source_id,
}: {
  source_type: LinkableType;
  source_id: string;
}) {
  const t = useT();
  const router = useRouter();
  const { search, setSearch } = useListSearch(newConnectionSearchSchema);
  const { candidates, query, term } = useCandidates(search.q);
  const existing = useConnectionItems(source_type, source_id);
  const create = useCreateConnection();
  const source = useLinkedTitles([{ type: source_type, id: source_id }]).get(
    linkedKey({ type: source_type, id: source_id }),
  );
  const results = useRef<HTMLUListElement>(null);

  // A busca é a primeira ação da tela: o foco já chega nela.
  useEffect(() => {
    document.getElementById(SEARCH_ID)?.focus();
  }, []);

  const linked = new Set(existing.items.map((item) => `${item.linked_type}:${item.linked_id}`));
  const offered = candidates.filter(
    (item) =>
      !(item.type === source_type && item.id === source_id) &&
      !linked.has(`${item.type}:${item.id}`),
  );
  const back_to = source?.href == null ? undefined : `${source.href}?tab=connections`;

  function focusResult(step: number, from: number) {
    const buttons = results.current?.querySelectorAll<HTMLElement>('button') ?? [];
    buttons[Math.min(Math.max(from + step, 0), buttons.length - 1)]?.focus();
  }

  function onSearchKeyDown(event: KeyboardEvent) {
    if (event.key !== 'ArrowDown') return;
    event.preventDefault();
    focusResult(1, -1);
  }

  function onResultKeyDown(event: KeyboardEvent, index: number) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      focusResult(1, index);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (index === 0) document.getElementById(SEARCH_ID)?.focus();
      else focusResult(-1, index);
    }
  }

  async function pick(item: Candidate) {
    try {
      await create.mutateAsync({
        source_type,
        source_id,
        target_type: item.type,
        target_id: item.id,
      });
    } catch {
      return; // O aviso da recusa já foi mostrado pela mutação.
    }
    if (back_to === undefined) router.history.back();
    else router.history.push(back_to);
  }

  let body;
  if (term === '') {
    body = <p className={styles.hint}>{t('connections.new.hint')}</p>;
  } else if (query.isPending) {
    body = <LoadingState label={t('connections.new.searching')} rows={2} />;
  } else if (query.isError) {
    body = (
      <ErrorState
        title={t('connections.new.error_title')}
        description={t('connections.new.error')}
        retryLabel={t('connections.retry')}
        onRetry={() => {
          void query.refetch();
        }}
      />
    );
  } else if (offered.length === 0) {
    body = (
      <EmptyState title={t('connections.new.none_title')} description={t('connections.new.none')} />
    );
  } else {
    body = (
      <ul ref={results} aria-label={t('connections.new.results')} className={styles.list}>
        {offered.map((item, index) => (
          <li key={`${item.type}:${item.id}`} className={[styles.row, styles.result].join(' ')}>
            <ItemSwatch id={item.id} className={styles.swatch} />
            <div className={styles.rowMain}>
              <span className={styles.rowTitle}>{item.title}</span>
              <span className={styles.rowSub}>{t(`connections.type.${item.type}`)}</span>
            </div>
            <Button
              variant="primary"
              loading={create.isPending}
              aria-label={t('connections.new.pick', { title: item.title })}
              onKeyDown={(event) => {
                onResultKeyDown(event, index);
              }}
              onClick={() => {
                void pick(item);
              }}
            >
              {t('connections.new.pick_action')}
            </Button>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <FormScreen>
      <StickyPageHeader
        back={
          <BackLink module="connections" fallback_to="/" {...(back_to ? { to: back_to } : {})} />
        }
        eyebrow={t('connections.new.eyebrow')}
        title={t('connections.new.title')}
        subtitle={
          source === undefined || source.loading
            ? t('connections.new.subtitle_plain')
            : t('connections.new.subtitle', { title: source.title })
        }
      />
      <div className={styles.stack}>
        <div role="search">
          <TextField
            id={SEARCH_ID}
            type="search"
            label={t('connections.new.search_label')}
            placeholder={t('connections.new.search_placeholder')}
            help={t('connections.new.already_linked')}
            value={search.q ?? ''}
            onChange={(event) => {
              setSearch({ q: event.target.value === '' ? undefined : event.target.value });
            }}
            onKeyDown={onSearchKeyDown}
          />
        </div>
        {body}
      </div>
    </FormScreen>
  );
}
