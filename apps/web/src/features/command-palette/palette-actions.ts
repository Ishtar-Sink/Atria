export type QuickKind = 'note' | 'task' | 'goal' | 'project' | 'journal_entry';

export const SEARCH_CONTEXTS = [
  'finance',
  'goals',
  'tasks',
  'reminders',
  'notes',
  'journal',
  'library',
  'projects',
] as const;

export type SearchContext = (typeof SEARCH_CONTEXTS)[number];

export const CONTEXT_PATHS: Record<SearchContext, string> = {
  finance: '/finance',
  goals: '/goals',
  tasks: '/tasks',
  reminders: '/reminders',
  notes: '/notes',
  journal: '/journal',
  library: '/library',
  projects: '/projects',
};

export const QUICK_KINDS: readonly QuickKind[] = [
  'note',
  'task',
  'goal',
  'project',
  'journal_entry',
];

export type PaletteAction =
  | { id: string; type: 'create'; kind: QuickKind; label_key: string }
  | { id: string; type: 'go'; context: SearchContext; label_key: string };

export const CREATE_ACTIONS: readonly PaletteAction[] = QUICK_KINDS.map((kind) => ({
  id: `create_${kind}`,
  type: 'create',
  kind,
  label_key: `command_palette.create_${kind}`,
}));

export const GO_ACTIONS: readonly PaletteAction[] = SEARCH_CONTEXTS.map((context) => ({
  id: `go_${context}`,
  type: 'go',
  context,
  label_key: 'command_palette.go_to',
}));

/** Rota de "abrir para completar" da entidade criada (RF-17). */
export function editPath(kind: QuickKind, id: string): string {
  switch (kind) {
    case 'note':
      return `/notes/${id}/edit`;
    case 'task':
      return `/tasks/${id}/edit`;
    case 'goal':
      return `/goals/${id}/edit`;
    case 'project':
      return `/projects/${id}/edit`;
    case 'journal_entry':
      return `/journal/${id}/edit`;
  }
}

/** Tela de um resultado da busca; o que não tem tela própria leva ao módulo. */
export function entityPath(entity_type: string, id: string): string {
  switch (entity_type) {
    case 'note':
      return `/notes/${id}`;
    case 'task':
      return `/tasks/${id}`;
    case 'goal':
      return `/goals/${id}`;
    case 'reminder':
      return `/reminders/${id}`;
    case 'journal_entry':
      return `/journal/${id}`;
    case 'book':
      return `/library/books/${id}`;
    case 'article':
      return `/library/articles/${id}`;
    case 'video':
      return `/library/videos/${id}`;
    case 'project':
      return `/projects/${id}`;
    default:
      return contextPath(contextOfType(entity_type));
  }
}

export function contextPath(context: string): string {
  return SEARCH_CONTEXTS.some((known) => known === context)
    ? CONTEXT_PATHS[context as SearchContext]
    : '/';
}

/** Contexto de busca de cada tipo de resultado, para quando o tipo não tem tela própria. */
function contextOfType(entity_type: string): string {
  switch (entity_type) {
    case 'project_card':
      return 'projects';
    case 'transaction':
    case 'transfer':
    case 'recurring_transaction':
    case 'account':
    case 'category':
      return 'finance';
    default:
      return '';
  }
}
