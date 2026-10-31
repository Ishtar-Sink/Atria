import type { paths } from '@atria/contracts';
import type { LinkableType } from '../features/connections/entity-categories';

type Method = 'get' | 'patch';

/** Chaves de `paths` que têm o método; um caminho sem ele quebra o typecheck. */
type PathWith<M extends Method> = {
  [K in keyof paths]: paths[K] extends Record<M, object> ? K : never;
}[keyof paths];

export type EntityLayoutKind = 'extra_tabs' | 'none';

export interface EntityRoute {
  /** Caminho da rota de detalhe no roteador. */
  path: string;
  /** Parâmetro da rota com o id da entidade. */
  param: string;
  entity_type: LinkableType;
  detail_path: PathWith<'get'>;
  update_path: PathWith<'patch'>;
  /** `none`: a rota não recebe Conexões (formulário do cartão, PD-46). */
  layout: EntityLayoutKind;
}

/** Cada tela de detalhe com o tipo das ligações e as rotas da API (RF-21, TASK-35). */
export const ENTITY_ROUTES = [
  {
    path: '/finance/accounts/$accountId',
    param: 'accountId',
    entity_type: 'account',
    detail_path: '/api/v1/accounts/{id}',
    update_path: '/api/v1/accounts/{id}',
    layout: 'extra_tabs',
  },
  {
    path: '/finance/transactions/$transactionId',
    param: 'transactionId',
    entity_type: 'transaction',
    detail_path: '/api/v1/transactions/{id}',
    update_path: '/api/v1/transactions/{id}',
    layout: 'extra_tabs',
  },
  {
    path: '/goals/$goalId',
    param: 'goalId',
    entity_type: 'goal',
    detail_path: '/api/v1/goals/{id}',
    update_path: '/api/v1/goals/{id}',
    layout: 'extra_tabs',
  },
  {
    path: '/tasks/$taskId',
    param: 'taskId',
    entity_type: 'task',
    detail_path: '/api/v1/tasks/{id}',
    update_path: '/api/v1/tasks/{id}',
    layout: 'extra_tabs',
  },
  {
    path: '/reminders/$reminderId',
    param: 'reminderId',
    entity_type: 'reminder',
    detail_path: '/api/v1/reminders/{id}',
    update_path: '/api/v1/reminders/{id}',
    layout: 'extra_tabs',
  },
  {
    path: '/notes/$noteId',
    param: 'noteId',
    entity_type: 'note',
    detail_path: '/api/v1/notes/{id}',
    update_path: '/api/v1/notes/{id}',
    layout: 'extra_tabs',
  },
  {
    path: '/journal/$entryId',
    param: 'entryId',
    entity_type: 'journal_entry',
    detail_path: '/api/v1/journal-entries/{id}',
    update_path: '/api/v1/journal-entries/{id}',
    layout: 'extra_tabs',
  },
  {
    path: '/library/books/$bookId',
    param: 'bookId',
    entity_type: 'book',
    detail_path: '/api/v1/books/{id}',
    update_path: '/api/v1/books/{id}',
    layout: 'extra_tabs',
  },
  {
    path: '/library/articles/$articleId',
    param: 'articleId',
    entity_type: 'article',
    detail_path: '/api/v1/articles/{id}',
    update_path: '/api/v1/articles/{id}',
    layout: 'extra_tabs',
  },
  {
    path: '/library/videos/$videoId',
    param: 'videoId',
    entity_type: 'video',
    detail_path: '/api/v1/videos/{id}',
    update_path: '/api/v1/videos/{id}',
    layout: 'extra_tabs',
  },
  {
    path: '/projects/$projectId',
    param: 'projectId',
    entity_type: 'project',
    detail_path: '/api/v1/projects/{id}',
    update_path: '/api/v1/projects/{id}',
    layout: 'extra_tabs',
  },
  {
    path: '/projects/$projectId/cards/$cardId',
    param: 'cardId',
    entity_type: 'project_card',
    detail_path: '/api/v1/cards/{card_id}',
    update_path: '/api/v1/projects/{id}/cards/{card_id}',
    layout: 'none',
  },
] as const satisfies readonly EntityRoute[];

export type EntityRoutePath = (typeof ENTITY_ROUTES)[number]['path'];

export function entityRouteOf(path: EntityRoutePath): EntityRoute {
  const found = ENTITY_ROUTES.find((entry) => entry.path === path);
  if (!found) throw new Error(`rota de entidade sem entrada: ${path}`);
  return found;
}
