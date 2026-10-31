export type QueryMode = 'actions' | 'tags' | 'all';

export interface ParsedQuery {
  mode: QueryMode;
  term: string;
}

/** Lê os prefixos da paleta: `>` só ações, `#` só etiquetas, o resto busca em tudo (decisão 38). */
export function parseQuery(text: string): ParsedQuery {
  const trimmed = text.trim();
  if (trimmed.startsWith('>')) return { mode: 'actions', term: trimmed.slice(1).trim() };
  if (trimmed.startsWith('#')) return { mode: 'tags', term: trimmed.slice(1).trim() };
  return { mode: 'all', term: trimmed };
}
