import { useCallback, useState } from 'react';
import { isSensitiveBlock, type DashboardBlockId } from '../blocks';
import { parseIds, readStored, writeStored } from './storage';

export const MASKED_BLOCKS_KEY = 'atria.dashboard.masked_blocks';

function read(user_id: string | undefined): DashboardBlockId[] {
  if (user_id === undefined) return [];
  return parseIds(readStored(`${MASKED_BLOCKS_KEY}.${user_id}`)).filter(
    (id): id is DashboardBlockId => id === 'journal' || id === 'balance',
  );
}

/** O olho dos blocos sensíveis: a escolha vale até ser trocada de novo (PD-15). */
export function useMaskedBlocks(user_id: string | undefined) {
  const [state, setState] = useState(() => ({ user_id, masked: read(user_id) }));
  const masked = state.user_id === user_id ? state.masked : read(user_id);

  const isMasked = useCallback((id: DashboardBlockId) => masked.includes(id), [masked]);

  const toggleMask = useCallback(
    (id: DashboardBlockId) => {
      if (!isSensitiveBlock(id)) return;
      const next = masked.includes(id) ? masked.filter((item) => item !== id) : [...masked, id];
      setState({ user_id, masked: next });
      if (user_id !== undefined)
        writeStored(`${MASKED_BLOCKS_KEY}.${user_id}`, JSON.stringify(next));
    },
    [masked, user_id],
  );

  return { masked, isMasked, toggleMask };
}
