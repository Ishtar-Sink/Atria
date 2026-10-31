import type { Schemas } from '@atria/contracts';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../shared/api/client';
import { useOptimisticMutation } from '../../shared/optimistic/use-optimistic-mutation';
import { itemBase, type ReaderItemType } from './use-pdf-document';

export type Highlight = Schemas['HighlightResponse'];
export type HighlightColor = Schemas['HighlightColor'];
export type HighlightRect = Schemas['HighlightRect'];
type HighlightList = Schemas['HighlightList'];

export const HIGHLIGHT_COLORS: readonly HighlightColor[] = [
  'accent',
  'primary',
  'success',
  'warning',
  'info',
];

export interface NewHighlight {
  color: HighlightColor;
  file_id: string;
  page: number;
  text: string;
  /** Retângulos em frações da página, de 0 a 1. */
  rects: HighlightRect[];
}

function key(item_type: ReaderItemType, item_id: string) {
  return ['reader', 'highlights', item_type, item_id] as const;
}

export function useHighlights(item_type: ReaderItemType, item_id: string) {
  return useQuery({
    queryKey: key(item_type, item_id),
    queryFn: ({ signal }) =>
      api.get<HighlightList>(`${itemBase(item_type, item_id)}/highlights`, { signal }),
  });
}

let temp_counter = 0;

/** Destaque otimista: aparece na hora e some com aviso se o servidor recusar (CB-19). */
export function useCreateHighlight(item_type: ReaderItemType, item_id: string) {
  return useOptimisticMutation<Highlight, NewHighlight, HighlightList>({
    query_key: key(item_type, item_id),
    error_message_key: 'reader.highlight_error',
    mutation_fn: (input) =>
      api.post<Highlight>(`${itemBase(item_type, item_id)}/highlights`, input),
    apply: (current, input) => {
      temp_counter += 1;
      const temp: Highlight = {
        ...input,
        id: `temp-${String(temp_counter)}`,
        owner_id: '',
        created_at: new Date().toISOString(),
        is_current_file: true,
      };
      return { items: [...(current?.items ?? []), temp] };
    },
  });
}
