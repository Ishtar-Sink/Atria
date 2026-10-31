import type { Schemas } from '@atria/contracts';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { z } from 'zod';
import { api } from '../../shared/api/client';
import { useT } from '../../shared/i18n/i18n';
import { usePreferences } from '../../shared/preferences/preferences-context';
import { useListSearch } from '../../shared/url-state/use-list-search';
import {
  CATEGORIES,
  ENTITY_CATEGORIES,
  isLinkableType,
  typesOfCategory,
  type EntityCategory,
  type LinkableType,
} from './entity-categories';
import { linkedKey, useLinkedTitles, type LinkedRef } from './use-linked-titles';

export type Link = Schemas['LinkResponse'];
type LinkPage = Schemas['LinkPage'];

const PAGE_SIZE = 100;
const MAX_PAGES = 10;

export const linkKeys = {
  all: ['connections', 'links'] as const,
  list: (entity_type: string, entity_id: string, linked_type: string | undefined) =>
    ['connections', 'links', entity_type, entity_id, linked_type ?? ''] as const,
};

/** Uma ligação vista da entidade consultada: o outro lado, com título, categoria e data. */
export interface ConnectionItem {
  id: string;
  linked_type: LinkableType;
  linked_id: string;
  category: EntityCategory;
  title: string;
  href: string | null;
  loading: boolean;
  created_at: string;
}

/**
 * O lado oposto à entidade consultada. O servidor já devolve `linked_type` e `linked_id` na
 * listagem; sem eles (ligação recém-criada na tela), o lado é deduzido dos extremos.
 */
export function otherSide(link: Link, entity_type: string, entity_id: string): LinkedRef {
  if (link.linked_type != null && link.linked_id != null) {
    return { type: link.linked_type, id: link.linked_id };
  }
  const from_source = link.source_type === entity_type && link.source_id === entity_id;
  return from_source
    ? { type: link.target_type, id: link.target_id }
    : { type: link.source_type, id: link.source_id };
}

async function fetchLinks(
  entity_type: string,
  entity_id: string,
  linked_type: string | undefined,
  signal: AbortSignal,
): Promise<Link[]> {
  const links: Link[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const result = await api.get<LinkPage>('/links', {
      query: { entity_type, entity_id, linked_type, cursor, limit: PAGE_SIZE },
      signal,
    });
    links.push(...result.items);
    cursor = result.next_cursor ?? undefined;
    if (cursor === undefined) break;
  }
  return links;
}

export interface ConnectionItemsOptions {
  /** Filtro de tipo feito pelo servidor. */
  linked_type?: string | undefined;
}

/** Ligações da entidade, das mais recentes para as mais antigas, com o título de cada uma. */
export function useConnectionItems(
  entity_type: string,
  entity_id: string,
  options: ConnectionItemsOptions = {},
) {
  const query = useQuery({
    queryKey: linkKeys.list(entity_type, entity_id, options.linked_type),
    queryFn: ({ signal }) => fetchLinks(entity_type, entity_id, options.linked_type, signal),
  });
  const sides = useMemo(
    () =>
      (query.data ?? []).flatMap((link) => {
        const side = otherSide(link, entity_type, entity_id);
        return isLinkableType(side.type) ? [{ link, side }] : [];
      }),
    [query.data, entity_type, entity_id],
  );
  const titles = useLinkedTitles(sides.map((entry) => entry.side));

  const items: ConnectionItem[] = sides
    .map(({ link, side }) => {
      const title = titles.get(linkedKey(side));
      const type = side.type as LinkableType;
      return {
        id: link.id,
        linked_type: type,
        linked_id: side.id,
        category: ENTITY_CATEGORIES[type].category,
        title: title?.title ?? side.type,
        href: title?.href ?? null,
        loading: title?.loading ?? false,
        created_at: link.created_at,
      };
    })
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  return { query, items };
}

const optionalText = z.preprocess(
  (value) => (typeof value === 'string' && value !== '' ? value : undefined),
  z.string().optional(),
);

export const GROUPINGS = ['category', 'date', 'none'] as const;
export type Grouping = (typeof GROUPINGS)[number];

/** Filtro, busca e agrupamento na URL, com prefixo para não colidir com os da tela hospedeira. */
export const connectionsSearchSchema = z.object({
  connections_category: z.enum(CATEGORIES).optional(),
  connections_q: optionalText,
  connections_group: z.enum(GROUPINGS).default('category'),
});

export interface ConnectionGroup {
  key: string;
  /** `null` quando não há agrupamento. */
  label: string | null;
  items: ConnectionItem[];
}

function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export function useConnections(entity_type: string, entity_id: string) {
  const t = useT();
  const { locale, time_zone } = usePreferences();
  const { search, setSearch } = useListSearch(connectionsSearchSchema);
  const category = search.connections_category;
  const text = search.connections_q;
  const grouping = search.connections_group;

  // Com um só tipo na categoria, o servidor filtra; nos demais casos o filtro é no cliente.
  const types = category === undefined ? [] : typesOfCategory(category);
  const { query, items } = useConnectionItems(entity_type, entity_id, {
    linked_type: types.length === 1 ? types[0] : undefined,
  });

  const groups = useMemo<ConnectionGroup[]>(() => {
    const needle = text === undefined ? '' : normalize(text);
    const visible = items.filter(
      (item) =>
        (category === undefined || item.category === category) &&
        (needle === '' ||
          normalize(`${item.title} ${t(`connections.type.${item.linked_type}`)}`).includes(needle)),
    );
    if (grouping === 'none') {
      return visible.length === 0 ? [] : [{ key: 'all', label: null, items: visible }];
    }
    const month = new Intl.DateTimeFormat(locale, {
      month: 'long',
      year: 'numeric',
      timeZone: time_zone,
    });
    const table = new Map<string, ConnectionGroup>();
    for (const item of visible) {
      const label =
        grouping === 'category'
          ? t(`connections.category.${item.category}`)
          : month.format(new Date(item.created_at));
      const group = table.get(label) ?? { key: label, label, items: [] };
      group.items.push(item);
      table.set(label, group);
    }
    const found = [...table.values()];
    // Por data, a ordem é a das ligações (mais recentes primeiro); por categoria, a alfabética.
    return grouping === 'category'
      ? found.sort((a, b) => a.key.localeCompare(b.key, locale))
      : found;
  }, [items, category, text, grouping, t, locale, time_zone]);

  return {
    query,
    total: items.length,
    groups,
    category,
    text,
    grouping,
    set_category: (value: EntityCategory | undefined) => {
      setSearch({ connections_category: value });
    },
    set_text: (value: string) => {
      setSearch({ connections_q: value === '' ? undefined : value });
    },
    set_grouping: (value: Grouping) => {
      setSearch({ connections_group: value });
    },
  };
}
