import { arrayMove } from '@dnd-kit/sortable';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../shared/api/client';
import type { Translate } from '../../shared/i18n/i18n';
import { pushToast } from '../../shared/toast/toast-store';
import {
  projectKeys,
  refusalMessageKey,
  type Card,
  type CardPage,
  type ChecklistItem,
  type Lane,
  type LanePage,
} from './use-projects';

/** Cor de uma raia nova: o `--primary` do tema claro, o mesmo que o servidor usa (PD-12). */
export const DEFAULT_LANE_COLOR = '#6d28d9';

/**
 * Nome da raia: o que a pessoa escreveu (raia criada ou padrão renomeada) ou, sem nome, a tradução
 * da raia padrão pela chave do sistema.
 */
export function laneLabel(
  lane: { name?: string | null; system_key?: string | null },
  t: Translate,
): string {
  if (lane.name) return lane.name;
  return lane.system_key ? t(`projects.lane.system.${lane.system_key}`) : '';
}

const base = (project_id: string) => `/projects/${encodeURIComponent(project_id)}`;

export function useLanes(project_id: string) {
  return useQuery({
    queryKey: projectKeys.lanes(project_id),
    queryFn: ({ signal }) => api.get<LanePage>(`${base(project_id)}/lanes`, { signal }),
    select: (page) => [...page.items].sort((a, b) => a.position - b.position),
  });
}

export function useCards(project_id: string) {
  return useQuery({
    queryKey: projectKeys.cards(project_id),
    queryFn: ({ signal }) => api.get<CardPage>(`${base(project_id)}/cards`, { signal }),
    select: (page) => [...page.items].sort((a, b) => a.position - b.position),
  });
}

export function useCard(project_id: string, card_id: string | undefined) {
  return useQuery({
    queryKey: projectKeys.card(project_id, card_id ?? ''),
    enabled: card_id !== undefined,
    queryFn: ({ signal }) =>
      api.get<Card>(`${base(project_id)}/cards/${encodeURIComponent(card_id ?? '')}`, { signal }),
  });
}

/** Cartões de uma raia, na ordem. */
export function cardsOfLane(cards: readonly Card[], lane_id: string): Card[] {
  return cards.filter((card) => card.lane_id === lane_id).sort((a, b) => a.position - b.position);
}

export type CardDropOver = { type: 'card'; card_id: string } | { type: 'lane'; lane_id: string };

export interface CardDropTarget {
  lane_id: string;
  position: number;
}

/**
 * Raia e posição de destino de uma soltura (RF-34, CB-13): sobre uma raia vai para o fim; sobre um
 * cartão ocupa o lugar dele (a semântica do `arrayMove` do sortable). `null` quando não há
 * destino ou o cartão ficaria onde já está.
 */
export function resolveCardDrop(
  cards: readonly Card[],
  card_id: string,
  over: CardDropOver | null,
): CardDropTarget | null {
  const moving = cards.find((card) => card.id === card_id);
  if (!moving || !over) return null;
  let target: CardDropTarget;
  if (over.type === 'lane') {
    const rest = cardsOfLane(cards, over.lane_id).filter((card) => card.id !== card_id);
    target = { lane_id: over.lane_id, position: rest.length };
  } else {
    const hovered = cards.find((card) => card.id === over.card_id);
    if (!hovered) return null;
    const index = cardsOfLane(cards, hovered.lane_id).findIndex((card) => card.id === hovered.id);
    target = { lane_id: hovered.lane_id, position: index };
  }
  const current = cardsOfLane(cards, moving.lane_id).findIndex((card) => card.id === card_id);
  return target.lane_id === moving.lane_id && target.position === current ? null : target;
}

/** Destino de uma seta na alça do cartão: esquerda e direita trocam de raia, cima e baixo a posição. */
export function keyboardCardTarget(
  lanes: readonly Lane[],
  cards: readonly Card[],
  card_id: string,
  key: string,
): CardDropTarget | null {
  const moving = cards.find((card) => card.id === card_id);
  if (!moving) return null;
  const ordered = [...lanes].sort((a, b) => a.position - b.position);
  if (key === 'ArrowLeft' || key === 'ArrowRight') {
    const index = ordered.findIndex((lane) => lane.id === moving.lane_id);
    const next = ordered[index + (key === 'ArrowLeft' ? -1 : 1)];
    if (index < 0 || !next) return null;
    return { lane_id: next.id, position: cardsOfLane(cards, next.id).length };
  }
  if (key === 'ArrowUp' || key === 'ArrowDown') {
    const siblings = cardsOfLane(cards, moving.lane_id);
    const position =
      siblings.findIndex((card) => card.id === card_id) + (key === 'ArrowUp' ? -1 : 1);
    return position < 0 || position > siblings.length - 1
      ? null
      : { lane_id: moving.lane_id, position };
  }
  return null;
}

/**
 * Move o cartão na lista como o servidor faz: sai da raia de origem, entra na de destino na
 * posição pedida (ou no fim) e as duas raias são reindexadas.
 */
export function moveCardInList(
  cards: readonly Card[],
  card_id: string,
  lane_id: string,
  position?: number,
): Card[] {
  const moving = cards.find((card) => card.id === card_id);
  if (!moving) return [...cards];
  const target = cardsOfLane(cards, lane_id).filter((card) => card.id !== card_id);
  const at =
    position === undefined ? target.length : Math.max(0, Math.min(position, target.length));
  target.splice(at, 0, { ...moving, lane_id });
  const source =
    moving.lane_id === lane_id
      ? []
      : cardsOfLane(cards, moving.lane_id).filter((card) => card.id !== card_id);
  const renumbered = new Map<string, Card>();
  [target, source].forEach((lane_cards) => {
    lane_cards.forEach((card, index) => {
      renumbered.set(card.id, { ...card, position: index });
    });
  });
  return cards.map((card) => renumbered.get(card.id) ?? card);
}

/** Reordena as raias pela lista de ids e renumera as posições. */
export function reorderLanesInList(lanes: readonly Lane[], lane_ids: readonly string[]): Lane[] {
  return lane_ids.flatMap((id, index) => {
    const lane = lanes.find((item) => item.id === id);
    return lane ? [{ ...lane, position: index }] : [];
  });
}

interface BoardSnapshot {
  lanes: LanePage | undefined;
  cards: CardPage | undefined;
}

interface BoardChange {
  lanes?: (lanes: Lane[]) => Lane[];
  cards?: (cards: Card[]) => Card[];
}

/** Mutação otimista do quadro: aplica na hora e desfaz com aviso se o servidor recusar (RNF-09). */
function useBoardMutation<TVariables, TData>(
  project_id: string,
  mutation_fn: (variables: TVariables) => Promise<TData>,
  change: (variables: TVariables) => BoardChange,
) {
  const client = useQueryClient();
  return useMutation<TData, Error, TVariables, BoardSnapshot>({
    mutationFn: mutation_fn,
    onMutate: async (variables) => {
      await client.cancelQueries({ queryKey: projectKeys.all });
      const snapshot: BoardSnapshot = {
        lanes: client.getQueryData<LanePage>(projectKeys.lanes(project_id)),
        cards: client.getQueryData<CardPage>(projectKeys.cards(project_id)),
      };
      const next = change(variables);
      if (next.lanes) {
        const apply = next.lanes;
        client.setQueryData<LanePage>(projectKeys.lanes(project_id), (page) =>
          page ? { ...page, items: apply(page.items) } : page,
        );
      }
      if (next.cards) {
        const apply = next.cards;
        client.setQueryData<CardPage>(projectKeys.cards(project_id), (page) =>
          page ? { ...page, items: apply(page.items) } : page,
        );
      }
      return snapshot;
    },
    onError: (error, _variables, snapshot) => {
      client.setQueryData(projectKeys.lanes(project_id), snapshot?.lanes);
      client.setQueryData(projectKeys.cards(project_id), snapshot?.cards);
      pushToast({ tone: 'danger', message_key: refusalMessageKey(error) });
    },
    onSettled: () => client.invalidateQueries({ queryKey: projectKeys.all }),
  });
}

export interface MoveCardVariables {
  card_id: string;
  lane_id: string;
  position?: number;
}

/** Mover chama a rota `move`, nunca o `PATCH` (PD-46). */
export function useMoveCard(project_id: string) {
  return useBoardMutation<MoveCardVariables, Card>(
    project_id,
    ({ card_id, lane_id, position }) =>
      api.post<Card>(`${base(project_id)}/cards/${encodeURIComponent(card_id)}/move`, {
        lane_id,
        ...(position === undefined ? {} : { position }),
      }),
    ({ card_id, lane_id, position }) => ({
      cards: (cards) => moveCardInList(cards, card_id, lane_id, position),
    }),
  );
}

export function useReorderLanes(project_id: string) {
  return useBoardMutation<{ lane_ids: string[] }, LanePage>(
    project_id,
    ({ lane_ids }) => api.put<LanePage>(`${base(project_id)}/lanes/order`, { lane_ids }),
    ({ lane_ids }) => ({ lanes: (lanes) => reorderLanesInList(lanes, lane_ids) }),
  );
}

export interface LanePatch {
  name?: string | null;
  color?: string;
  counts_as_done?: boolean;
}

/** Marcar ou desmarcar "conta como concluída" refaz o progresso: tudo do projeto é relido. */
export function useUpdateLane(project_id: string) {
  return useBoardMutation<{ lane_id: string; patch: LanePatch }, Lane>(
    project_id,
    ({ lane_id, patch }) =>
      api.patch<Lane>(`${base(project_id)}/lanes/${encodeURIComponent(lane_id)}`, patch),
    ({ lane_id, patch }) => ({
      lanes: (lanes) =>
        lanes.map((lane) =>
          lane.id === lane_id
            ? {
                ...lane,
                ...(patch.name === undefined ? {} : { name: patch.name }),
                ...(patch.color === undefined ? {} : { color: patch.color }),
                ...(patch.counts_as_done === undefined
                  ? {}
                  : { counts_as_done: patch.counts_as_done }),
              }
            : lane,
        ),
    }),
  );
}

export interface LaneInput {
  name: string;
  color: string;
  counts_as_done: boolean;
}

export function useCreateLane(project_id: string) {
  const client = useQueryClient();
  return useMutation<Lane, Error, LaneInput>({
    mutationFn: (input) => api.post<Lane>(`${base(project_id)}/lanes`, input),
    onSuccess: () => client.invalidateQueries({ queryKey: projectKeys.all }),
  });
}

export function useDeleteLane(project_id: string) {
  const client = useQueryClient();
  return useMutation<undefined, Error, { lane_id: string; move_cards_to?: string }>({
    mutationFn: ({ lane_id, move_cards_to }) =>
      api.delete<undefined>(
        `${base(project_id)}/lanes/${encodeURIComponent(lane_id)}${
          move_cards_to ? `?move_cards_to=${encodeURIComponent(move_cards_to)}` : ''
        }`,
      ),
    onSuccess: () => client.invalidateQueries({ queryKey: projectKeys.all }),
  });
}

export interface CardInput {
  title: string;
  description: string | null;
  due_date: string | null;
  priority: string | null;
  labels: string[];
  checklist: { text: string; done: boolean }[];
}

export function useCreateCard(project_id: string) {
  const client = useQueryClient();
  return useMutation<Card, Error, CardInput & { lane_id: string }>({
    mutationFn: (input) => api.post<Card>(`${base(project_id)}/cards`, input),
    onSuccess: () => client.invalidateQueries({ queryKey: projectKeys.all }),
  });
}

export function useUpdateCard(project_id: string) {
  const client = useQueryClient();
  return useMutation<Card, Error, { card_id: string; patch: CardInput }>({
    mutationFn: ({ card_id, patch }) =>
      api.patch<Card>(`${base(project_id)}/cards/${encodeURIComponent(card_id)}`, patch),
    onSuccess: () => client.invalidateQueries({ queryKey: projectKeys.all }),
  });
}

export function useDeleteCard(project_id: string) {
  const client = useQueryClient();
  return useMutation<undefined, Error, { card_id: string }>({
    mutationFn: ({ card_id }) =>
      api.delete<undefined>(`${base(project_id)}/cards/${encodeURIComponent(card_id)}`),
    onSuccess: () => client.invalidateQueries({ queryKey: projectKeys.all }),
  });
}

/** Limites do servidor (`apps/server/src/projects/domain/card.rs`). */
export const CHECKLIST_MAX_ITEMS = 100;
export const CHECKLIST_TEXT_MAX_CHARS = 300;

/** Item do checklist no formulário; a `key` identifica a linha enquanto se edita e reordena. */
export interface ChecklistDraft {
  key: string;
  text: string;
  done: boolean;
}

let checklist_key_counter = 0;

export function newChecklistKey(): string {
  checklist_key_counter += 1;
  return `novo-${String(checklist_key_counter)}`;
}

export function toChecklistDrafts(
  items: readonly Pick<ChecklistItem, 'id' | 'text' | 'done' | 'position'>[],
): ChecklistDraft[] {
  return [...items]
    .sort((a, b) => a.position - b.position)
    .map((item) => ({ key: item.id, text: item.text, done: item.done }));
}

export function appendChecklistItem(
  items: readonly ChecklistDraft[],
  text: string,
): ChecklistDraft[] {
  const trimmed = text.trim();
  if (trimmed === '') return [...items];
  return [...items, { key: newChecklistKey(), text: trimmed, done: false }];
}

export function updateChecklistItem(
  items: readonly ChecklistDraft[],
  key: string,
  patch: Partial<Pick<ChecklistDraft, 'text' | 'done'>>,
): ChecklistDraft[] {
  return items.map((item) => (item.key === key ? { ...item, ...patch } : item));
}

export function removeChecklistItem(
  items: readonly ChecklistDraft[],
  key: string,
): ChecklistDraft[] {
  return items.filter((item) => item.key !== key);
}

export function moveChecklistItem(
  items: readonly ChecklistDraft[],
  from: number,
  to: number,
): ChecklistDraft[] {
  if (to < 0 || to > items.length - 1) return [...items];
  return arrayMove([...items], from, to);
}

export function toChecklistInput(items: readonly ChecklistDraft[]): CardInput['checklist'] {
  return items
    .map((item) => ({ text: item.text.trim(), done: item.done }))
    .filter((item) => item.text !== '');
}
