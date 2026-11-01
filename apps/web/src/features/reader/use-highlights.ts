import type { Schemas } from '@atria/contracts';
import type { ColorFieldLabels } from '@atria/ui';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../shared/api/client';
import { useT } from '../../shared/i18n/i18n';
import { useOptimisticMutation } from '../../shared/optimistic/use-optimistic-mutation';
import { itemBase, type ReaderItemType } from './use-pdf-document';

export type Highlight = Schemas['HighlightResponse'];
export type HighlightRect = Schemas['HighlightRect'];
type HighlightList = Schemas['HighlightList'];

/** Os cinco tons de antes, agora em HEX (os da migração, tokens do tema claro). */
export const HIGHLIGHT_PRESETS = [
  { name: 'accent', hex: '#0e7490' },
  { name: 'primary', hex: '#6d28d9' },
  { name: 'success', hex: '#047857' },
  { name: 'warning', hex: '#92400e' },
  { name: 'info', hex: '#0369a1' },
] as const;

/** O servidor guarda `#rrggbb` em minúsculas (RN-09). */
export function normalizeHex(hex: string): string {
  return hex.trim().toLowerCase();
}

/** Nome do atalho para um HEX conhecido; para os demais, o próprio HEX em minúsculas. */
export function highlightColorName(hex: string, t: (key: string) => string): string {
  const normalized = normalizeHex(hex);
  const preset = HIGHLIGHT_PRESETS.find((item) => item.hex === normalized);
  return preset ? t(`reader.highlight_color_${preset.name}`) : normalized;
}

export function useHighlightColorLabels(): ColorFieldLabels {
  const t = useT();
  return {
    title: t('common.color_title'),
    lightness: t('common.color_lightness'),
    hex: t('common.color_hex'),
    rgb: t('common.color_rgb'),
    red: t('common.color_red'),
    green: t('common.color_green'),
    blue: t('common.color_blue'),
    hsl: t('common.color_hsl'),
    hue: t('common.color_hue'),
    saturation: t('common.color_saturation'),
    cancel: t('common.cancel'),
    apply: t('common.color_apply'),
    wheel: t('common.color_wheel'),
  };
}

export interface NewHighlight {
  color: string;
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
      api.post<Highlight>(`${itemBase(item_type, item_id)}/highlights`, {
        ...input,
        color: normalizeHex(input.color),
      }),
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

/** Troca a cor na hora e a devolve com aviso se o servidor recusar (RF-32). */
export function useChangeHighlightColor(item_type: ReaderItemType, item_id: string) {
  return useOptimisticMutation<Highlight, { highlight_id: string; color: string }, HighlightList>({
    query_key: key(item_type, item_id),
    error_message_key: 'reader.highlight_change_error',
    mutation_fn: ({ highlight_id, color }) =>
      api.patch<Highlight>(
        `${itemBase(item_type, item_id)}/highlights/${encodeURIComponent(highlight_id)}`,
        { color: normalizeHex(color) },
      ),
    apply: (current, { highlight_id, color }) => ({
      items: (current?.items ?? []).map((item) =>
        item.id === highlight_id ? { ...item, color } : item,
      ),
    }),
  });
}

/** Exclui na hora e devolve o destaque à lista com aviso se o servidor recusar (RF-32). */
export function useDeleteHighlight(item_type: ReaderItemType, item_id: string) {
  return useOptimisticMutation<undefined, { highlight_id: string }, HighlightList>({
    query_key: key(item_type, item_id),
    error_message_key: 'reader.highlight_delete_error',
    mutation_fn: ({ highlight_id }) =>
      api.delete<undefined>(
        `${itemBase(item_type, item_id)}/highlights/${encodeURIComponent(highlight_id)}`,
      ),
    apply: (current, { highlight_id }) => ({
      items: (current?.items ?? []).filter((item) => item.id !== highlight_id),
    }),
  });
}
