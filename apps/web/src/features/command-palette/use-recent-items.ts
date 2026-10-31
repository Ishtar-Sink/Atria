import { useCallback, useState } from 'react';

const STORAGE_KEY = 'atria.command_palette.recent';
const MAX_ITEMS = 8;

export interface RecentItem {
  id: string;
  type: string;
  title: string;
}

function isRecent(value: unknown): value is RecentItem {
  if (typeof value !== 'object' || value === null) return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === 'string' && typeof item.type === 'string' && typeof item.title === 'string'
  );
}

function read(): RecentItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw === null ? [] : JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isRecent).slice(0, MAX_ITEMS) : [];
  } catch {
    // Armazenamento bloqueado ou texto inválido: sem recentes.
    return [];
  }
}

function write(items: RecentItem[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Sem armazenamento os recentes valem só nesta sessão.
  }
}

/** Itens abertos há pouco, mostrados com a paleta vazia (decisão 37). */
export function useRecentItems() {
  const [items, setItems] = useState<RecentItem[]>(read);
  const add = useCallback((item: RecentItem) => {
    const next = [item, ...read().filter((old) => old.id !== item.id)].slice(0, MAX_ITEMS);
    write(next);
    setItems(next);
  }, []);
  return { items, add };
}
