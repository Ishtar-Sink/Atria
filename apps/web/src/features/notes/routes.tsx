import { createRoute, type AnyRoute } from '@tanstack/react-router';
import { NoteFormScreen } from './screens/note-form-screen';
import { NoteScreen, type NoteExtraTab } from './screens/note-screen';
import { NotesScreen } from './screens/notes-screen';

export interface NotesRoutesOptions {
  /** Abas da nota que outra feature acrescenta (Conexões, montadas na TASK-35). */
  extra_tabs?: readonly NoteExtraTab[];
}

/**
 * Rotas de Notas, para a TASK-35 registrar. A lista e a nota leem a busca da URL pelo
 * `useListSearch` (visibilidade, ordem, texto, `view` e `tab`), que descarta valor inválido
 * em vez de errar.
 */
export function createNotesRoutes(parent: AnyRoute, options: NotesRoutesOptions = {}): AnyRoute[] {
  const list = createRoute({
    getParentRoute: () => parent,
    path: '/notes',
    component: NotesScreen,
    staticData: { title_key: 'notes.nav.title', breadcrumb_key: 'notes.nav.title' },
  });
  const create = createRoute({
    getParentRoute: () => parent,
    path: '/notes/new',
    component: NoteFormScreen,
    staticData: { title_key: 'notes.form.title_new', breadcrumb_key: 'notes.form.title_new' },
  });
  const detail = createRoute({
    getParentRoute: () => parent,
    path: '/notes/$noteId',
    component: () => (
      <NoteScreen {...(options.extra_tabs ? { extra_tabs: options.extra_tabs } : {})} />
    ),
    staticData: { title_key: 'notes.detail.crumb', breadcrumb_key: 'notes.detail.crumb' },
  });
  const edit = createRoute({
    getParentRoute: () => parent,
    path: '/notes/$noteId/edit',
    component: NoteFormScreen,
    staticData: { title_key: 'notes.form.title_edit', breadcrumb_key: 'notes.form.title_edit' },
  });
  return [list, create, detail, edit];
}
