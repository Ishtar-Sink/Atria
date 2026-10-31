import { useCallback, useEffect, useState } from 'react';
import { isDashboardBlockId, type DashboardBlockId } from '../blocks';
import { parseIds, readStored } from './storage';

/** Mesma chave que Configurações › Dashboard grava (TASK-33). */
export const HIDDEN_BLOCKS_KEY = 'atria.dashboard.hidden_blocks';

function read(user_id: string | undefined): DashboardBlockId[] {
  if (user_id === undefined) return [];
  return parseIds(readStored(`${HIDDEN_BLOCKS_KEY}.${user_id}`)).filter(isDashboardBlockId);
}

/** Só lê os blocos ocultos: a escolha é feita em Configurações (PD-30). */
export function useHiddenBlocks(user_id: string | undefined) {
  const [state, setState] = useState(() => ({ user_id, hidden: read(user_id) }));
  const hidden = state.user_id === user_id ? state.hidden : read(user_id);

  useEffect(() => {
    function onStorage(event: StorageEvent) {
      if (event.key !== null && event.key !== `${HIDDEN_BLOCKS_KEY}.${String(user_id)}`) return;
      setState({ user_id, hidden: read(user_id) });
    }
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('storage', onStorage);
    };
  }, [user_id]);

  const isHidden = useCallback((id: DashboardBlockId) => hidden.includes(id), [hidden]);
  return { hidden, isHidden };
}
