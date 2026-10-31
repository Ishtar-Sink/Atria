import type { Schemas } from '@atria/contracts';
import { formatDate } from '../../shared/format/intl';

/** Os 14 tipos ligáveis do contrato de `/links` (TASK-15), com os nomes exatos dele. */
export const LINKABLE_TYPES = [
  'account',
  'transaction',
  'transfer',
  'goal',
  'milestone',
  'task',
  'reminder',
  'note',
  'journal_entry',
  'book',
  'article',
  'video',
  'project',
  'project_card',
] as const;

export type LinkableType = (typeof LINKABLE_TYPES)[number];

/** A categoria de uma ligação é o módulo da entidade do outro lado (RF-19). */
export const CATEGORIES = [
  'finance',
  'goals',
  'tasks',
  'reminders',
  'notes',
  'journal',
  'library',
  'projects',
] as const;

export type EntityCategory = (typeof CATEGORIES)[number];

export interface TitleContext {
  locale: string;
  time_zone: string;
}

export interface EntityConfig {
  category: EntityCategory;
  /** `GET` por id do tipo; `null` quando o servidor exige o id da entidade pai. */
  detail_path: (id: string) => string | null;
  /** Título lido da resposta do `GET` por id; `null` cai no rótulo do tipo. */
  title_of: (detail: unknown, context: TitleContext) => string | null;
  /** Rota da tela da entidade, a partir da resposta do `GET` por id; `null` sem tela. */
  route: (id: string, detail: unknown) => string | null;
}

interface Config<D> {
  category: EntityCategory;
  detail_path?: (id: string) => string;
  title_of?: (detail: D, context: TitleContext) => string | null | undefined;
  route?: (id: string, detail: D) => string;
}

function entity<D>(config: Config<D>): EntityConfig {
  const { detail_path, title_of, route } = config;
  return {
    category: config.category,
    detail_path: (id) => detail_path?.(id) ?? null,
    title_of: (detail, context) => title_of?.(detail as D, context) ?? null,
    route: (id, detail) => route?.(id, detail as D) ?? null,
  };
}

const enc = encodeURIComponent;

export const ENTITY_CATEGORIES: Record<LinkableType, EntityConfig> = {
  account: entity<Schemas['AccountResponse']>({
    category: 'finance',
    detail_path: (id) => `/accounts/${enc(id)}`,
    title_of: (detail) => detail.name,
    route: (id) => `/finance/accounts/${enc(id)}`,
  }),
  transaction: entity<Schemas['TransactionResponse']>({
    category: 'finance',
    detail_path: (id) => `/transactions/${enc(id)}`,
    title_of: (detail) => detail.description,
    route: (id) => `/finance/transactions/${enc(id)}`,
  }),
  // A leitura de transferência e de marco exige o id da entidade pai, que a ligação não traz.
  transfer: entity<unknown>({ category: 'finance' }),
  goal: entity<Schemas['GoalResponse']>({
    category: 'goals',
    detail_path: (id) => `/goals/${enc(id)}`,
    title_of: (detail) => detail.title,
    route: (id) => `/goals/${enc(id)}`,
  }),
  milestone: entity<unknown>({ category: 'goals' }),
  task: entity<Schemas['TaskResponse']>({
    category: 'tasks',
    detail_path: (id) => `/tasks/${enc(id)}`,
    title_of: (detail) => detail.title,
    route: (id) => `/tasks/${enc(id)}`,
  }),
  reminder: entity<Schemas['ReminderResponse']>({
    category: 'reminders',
    detail_path: (id) => `/reminders/${enc(id)}`,
    title_of: (detail) => detail.title,
    route: (id) => `/reminders/${enc(id)}`,
  }),
  note: entity<Schemas['NoteResponse']>({
    category: 'notes',
    detail_path: (id) => `/notes/${enc(id)}`,
    title_of: (detail) => detail.title,
    route: (id) => `/notes/${enc(id)}`,
  }),
  journal_entry: entity<Schemas['JournalEntryResponse']>({
    category: 'journal',
    detail_path: (id) => `/journal-entries/${enc(id)}`,
    title_of: (detail, context) =>
      formatDate(detail.occurred_at, context.locale, context.time_zone),
    route: (id) => `/journal/${enc(id)}`,
  }),
  book: entity<Schemas['BookResponse']>({
    category: 'library',
    detail_path: (id) => `/books/${enc(id)}`,
    title_of: (detail) => detail.title,
    route: (id) => `/library/books/${enc(id)}`,
  }),
  article: entity<Schemas['ArticleResponse']>({
    category: 'library',
    detail_path: (id) => `/articles/${enc(id)}`,
    title_of: (detail) => detail.title,
    route: (id) => `/library/articles/${enc(id)}`,
  }),
  video: entity<Schemas['VideoResponse']>({
    category: 'library',
    detail_path: (id) => `/videos/${enc(id)}`,
    title_of: (detail) => detail.title ?? detail.url,
    route: (id) => `/library/videos/${enc(id)}`,
  }),
  project: entity<Schemas['ProjectResponse']>({
    category: 'projects',
    detail_path: (id) => `/projects/${enc(id)}`,
    title_of: (detail) => detail.name,
    route: (id) => `/projects/${enc(id)}`,
  }),
  // O cartão vive dentro do projeto: o link usa o `project_id` da resposta de `GET /cards/{id}`.
  project_card: entity<Schemas['CardResponse']>({
    category: 'projects',
    detail_path: (id) => `/cards/${enc(id)}`,
    title_of: (detail) => detail.title,
    route: (id, detail) => `/projects/${enc(detail.project_id)}/cards/${enc(id)}`,
  }),
};

export function isLinkableType(value: string): value is LinkableType {
  return (LINKABLE_TYPES as readonly string[]).includes(value);
}

/** Tipos de cada categoria, para filtrar `/links` pelo servidor quando há um só. */
export function typesOfCategory(category: EntityCategory): LinkableType[] {
  return LINKABLE_TYPES.filter((type) => ENTITY_CATEGORIES[type].category === category);
}
