import { useCallback, useEffect, useState } from 'react';

/** Mesma chave que o dashboard lê para os blocos ocultos (PD-30). */
export const HIDDEN_BLOCKS_KEY = 'atria.dashboard.hidden_blocks';

export type DashboardBlockOptionId =
  'today' | 'reminders' | 'upcoming' | 'journal' | 'balance' | 'reading';

export interface DashboardBlockOption {
  readonly id: DashboardBlockOptionId;
  readonly label_key: string;
}

/** Blocos do dashboard na ordem do protótipo, sem "Metas" (PD-31 em aberto). */
export const DASHBOARD_BLOCK_OPTIONS: readonly DashboardBlockOption[] = Object.freeze([
  { id: 'today', label_key: 'settings.block_today' },
  { id: 'reminders', label_key: 'settings.block_reminders' },
  { id: 'upcoming', label_key: 'settings.block_upcoming' },
  { id: 'journal', label_key: 'settings.block_journal' },
  { id: 'balance', label_key: 'settings.block_balance' },
  { id: 'reading', label_key: 'settings.block_reading' },
]);

const IDS = new Set<string>(DASHBOARD_BLOCK_OPTIONS.map((option) => option.id));

function storageKey(user_id: string): string {
  return `${HIDDEN_BLOCKS_KEY}.${user_id}`;
}

function read(user_id: string | undefined): string[] {
  if (user_id === undefined) return [];
  try {
    const raw = localStorage.getItem(storageKey(user_id));
    if (raw === null) return [];
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === 'string' && IDS.has(item))
      : [];
  } catch {
    // Sem armazenamento ou com valor ilegível, todos os blocos ficam visíveis.
    return [];
  }
}

function write(user_id: string, hidden: string[]) {
  try {
    localStorage.setItem(storageKey(user_id), JSON.stringify(hidden));
  } catch {
    // Sem armazenamento a mudança vale só nesta sessão.
  }
}

/** Lê e grava os blocos ocultos do dashboard no navegador, por pessoa (PD-30). */
export function useDashboardBlocks(user_id: string | undefined) {
  const [state, setState] = useState(() => ({ user_id, hidden: read(user_id) }));
  const hidden = state.user_id === user_id ? state.hidden : read(user_id);

  useEffect(() => {
    function onStorage(event: StorageEvent) {
      if (event.key !== null && event.key !== storageKey(String(user_id))) return;
      setState({ user_id, hidden: read(user_id) });
    }
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('storage', onStorage);
    };
  }, [user_id]);

  const isVisible = useCallback((id: string) => !hidden.includes(id), [hidden]);

  const setVisible = useCallback(
    (id: DashboardBlockOptionId, visible: boolean) => {
      const next = hidden.filter((item) => item !== id);
      if (!visible) next.push(id);
      setState({ user_id, hidden: next });
      if (user_id !== undefined) write(user_id, next);
    },
    [hidden, user_id],
  );

  return { hidden, isVisible, setVisible };
}
