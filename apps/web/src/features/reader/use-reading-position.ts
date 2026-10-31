import type { Schemas } from '@atria/contracts';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useRef } from 'react';
import { api } from '../../shared/api/client';
import { itemBase, type ReaderItemType } from './use-pdf-document';

const SAVE_DELAY_MS = 800;

type Position = Schemas['ReadingPositionResponse'];

function positionPath(item_type: ReaderItemType, item_id: string): string {
  return `${itemBase(item_type, item_id)}/reading-position`;
}

/**
 * Retomada da leitura: lê a última página na abertura e é o único ponto que grava
 * `last_read_page` (DEC-004). A sessão de leitura nunca passa por aqui.
 */
export function useReadingPosition(item_type: ReaderItemType, item_id: string) {
  const path = positionPath(item_type, item_id);
  const query = useQuery({
    queryKey: ['reader', 'position', item_type, item_id],
    queryFn: ({ signal }) => api.get<Position>(path, { signal }),
    staleTime: Infinity,
    gcTime: 0,
  });
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pending = useRef<number | undefined>(undefined);

  const clear = useCallback(() => {
    if (timer.current !== undefined) clearTimeout(timer.current);
    timer.current = undefined;
    pending.current = undefined;
  }, []);

  const flush = useCallback(() => {
    const page = pending.current;
    clear();
    if (page === undefined) return;
    void api.put<Position>(path, { page }).catch(() => undefined);
  }, [clear, path]);

  /** Troca de página: grava depois de uma espera curta, para a rolagem não gerar uma chamada por página. */
  const save_page = useCallback(
    (page: number) => {
      pending.current = page;
      if (timer.current !== undefined) clearTimeout(timer.current);
      timer.current = setTimeout(flush, SAVE_DELAY_MS);
    },
    [flush],
  );

  /** Fechamento: grava sempre a página de saída, mesmo menor que a de abertura (CB-18). */
  const save_closing = useCallback(
    async (page: number) => {
      clear();
      try {
        await api.put<Position>(path, { page });
      } catch {
        // Falha ao guardar a página não impede de fechar o leitor.
      }
    },
    [clear, path],
  );

  useEffect(() => clear, [clear]);

  return {
    is_loading: query.isPending,
    /** Página de abertura: a última lida ou, sem posição, a primeira. */
    initial_page: query.data === undefined ? undefined : Math.max(1, query.data.page ?? 1),
    save_page,
    save_closing,
  };
}
