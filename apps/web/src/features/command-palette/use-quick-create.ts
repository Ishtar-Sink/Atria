import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../../shared/api/client';
import { useOptimisticMutation } from '../../shared/optimistic/use-optimistic-mutation';
import type { QuickKind } from './palette-actions';

const KEY = ['command-palette', 'quick-created'] as const;

/** Raiz da consulta de lista de cada módulo, para a lista mostrar a entidade nova. */
const LIST_ROOT: Record<QuickKind, string> = {
  note: 'notes',
  task: 'tasks',
  goal: 'goals',
  project: 'projects',
  journal_entry: 'journal',
};

let counter = 0;

interface Pending {
  local_id: string;
  title: string;
}

export interface Created {
  id: string;
  kind: QuickKind;
  title: string;
}

interface Variables {
  kind: QuickKind;
  title: string;
  local_id: string;
}

/** Corpo mínimo de cada entidade: só o campo de texto obrigatório (RF-17). */
function request(kind: QuickKind, title: string): { path: string; body: unknown } {
  switch (kind) {
    case 'note':
      return { path: '/notes', body: { title, body: '' } };
    case 'task':
      return { path: '/tasks', body: { title } };
    case 'goal':
      return { path: '/goals', body: { title } };
    case 'project':
      return { path: '/projects', body: { name: title } };
    case 'journal_entry':
      return {
        path: '/journal-entries',
        body: { text: title, occurred_at: new Date().toISOString(), emotions: [] },
      };
  }
}

/** Criação otimista da entidade mínima; recusa do servidor desfaz com aviso (RNF-09). */
export function useQuickCreate(kind: QuickKind) {
  const client = useQueryClient();
  const [created, setCreated] = useState<Created | null>(null);
  const mutation = useOptimisticMutation<{ id: string }, Variables, Pending[]>({
    mutation_fn: ({ kind: k, title }) => {
      const { path, body } = request(k, title);
      return api.post<{ id: string }>(path, body);
    },
    query_key: KEY,
    apply: (current, { local_id, title }) => [...(current ?? []), { local_id, title }],
    error_message_key: 'command_palette.undo_notice',
  });

  function create(title: string) {
    const clean = title.trim();
    if (clean === '') return;
    const local_id = `quick-${String(++counter)}`;
    // A entidade aparece na hora, ainda sem tela própria até o servidor responder.
    setCreated({ id: '', kind, title: clean });
    mutation.mutate(
      { kind, title: clean, local_id },
      {
        onSuccess: (data) => {
          setCreated({ id: data.id, kind, title: clean });
          client.setQueryData<Pending[]>(KEY, []);
          void client.invalidateQueries({ queryKey: [LIST_ROOT[kind]] });
        },
        onError: () => {
          setCreated(null);
        },
      },
    );
  }

  return {
    create,
    created,
    /** Criada na tela, mas o servidor ainda não respondeu com o id. */
    saving: created !== null && created.id === '',
  };
}
