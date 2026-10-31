import type { Schemas } from '@atria/contracts';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../shared/api/client';
import { registerMessages, type Translate } from '../../shared/i18n/i18n';
import { useOptimisticMutation } from '../../shared/optimistic/use-optimistic-mutation';
import messages from './i18n/pt-br.json';

registerMessages('journal', messages);

export type Emotion = Schemas['EmotionResponse'];
export type EmotionList = Schemas['EmotionList'];
export type SystemEmotionKey = Schemas['SystemEmotionKey'];

export const EMOTIONS_KEY = ['emotions'] as const;
const UNDO_KEY = 'journal.undo_notice';

/** Qualquer emoção com nome opcional e chave do sistema (a da lista ou a de uma entrada). */
export interface NamedEmotion {
  name?: string | null | undefined;
  system_key?: SystemEmotionKey | null | undefined;
}

/**
 * O nome que a pessoa deu, ou a tradução da chave do sistema. Toda tela que mostra
 * uma emoção usa só esta função.
 */
export function emotionLabel(emotion: NamedEmotion, t: Translate): string {
  if (emotion.name != null && emotion.name !== '') return emotion.name;
  if (emotion.system_key != null) return t(`journal.emotions.system.${emotion.system_key}`);
  return '';
}

export function useEmotions() {
  return useQuery({
    queryKey: EMOTIONS_KEY,
    queryFn: ({ signal }) => api.get<EmotionList>('/emotions', { signal }),
  });
}

export function useCreateEmotion() {
  return useOptimisticMutation<Emotion, string, EmotionList>({
    mutation_fn: (name) => api.post<Emotion>('/emotions', { name }),
    query_key: EMOTIONS_KEY,
    apply: (current, name) => {
      const now = new Date().toISOString();
      const temporary: Emotion = {
        id: `pending-${name}`,
        owner_id: '',
        name,
        system_key: null,
        visibility: 'personal',
        created_at: now,
        updated_at: now,
      };
      return { items: [...(current?.items ?? []), temporary] };
    },
    error_message_key: UNDO_KEY,
  });
}

export interface RenameEmotionVariables {
  id: string;
  name: string;
}

/** Renomear uma emoção padrão grava `name` e mantém a `system_key`. */
export function useRenameEmotion() {
  return useOptimisticMutation<Emotion, RenameEmotionVariables, EmotionList>({
    mutation_fn: ({ id, name }) => api.patch<Emotion>(`/emotions/${id}`, { name }),
    query_key: EMOTIONS_KEY,
    apply: (current, { id, name }) => ({
      items: (current?.items ?? []).map((item) => (item.id === id ? { ...item, name } : item)),
    }),
    error_message_key: UNDO_KEY,
  });
}

export function useRemoveEmotion() {
  return useOptimisticMutation<unknown, string, EmotionList>({
    mutation_fn: (id) => api.delete<unknown>(`/emotions/${id}`),
    query_key: EMOTIONS_KEY,
    apply: (current, id) => ({ items: (current?.items ?? []).filter((item) => item.id !== id) }),
    error_message_key: UNDO_KEY,
  });
}
