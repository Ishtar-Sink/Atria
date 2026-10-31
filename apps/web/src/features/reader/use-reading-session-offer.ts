import type { Schemas } from '@atria/contracts';
import { useMutation } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { api } from '../../shared/api/client';
import { usePreferences } from '../../shared/preferences/preferences-context';
import { itemBase, type ReaderItemType } from './use-pdf-document';

export interface SessionOffer {
  from_page: number;
  to_page: number;
  /** Páginas avançadas, preenchidas no campo (PD-60). */
  suggested_pages: number;
}

type Session = Schemas['ReadingSessionResponse'];
type SessionRequest = Schemas['CreateReadingSessionRequest'];

/** Data de hoje (AAAA-MM-DD) no fuso da pessoa. */
export function todayIn(time_zone: string, now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: time_zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const pick = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return `${pick('year')}-${pick('month')}-${pick('day')}`;
}

/** Páginas lidas é inteiro maior que zero; devolve `undefined` quando o texto não vale. */
export function parsePagesRead(text: string): number | undefined {
  if (!/^\s*\d+\s*$/.test(text)) return undefined;
  const value = Number(text);
  return Number.isSafeInteger(value) && value > 0 ? value : undefined;
}

/**
 * Regra da oferta de sessão ao fechar (RN-23, PD-60): só livro, só com avanço. Nada é gravado
 * sem confirmação, e a oferta nunca toca a posição de leitura (DEC-004).
 */
export function useReadingSessionOffer(
  item_type: ReaderItemType,
  item_id: string,
  open_page: number | undefined,
) {
  const { time_zone } = usePreferences();
  const mutation = useMutation<Session, Error, { offer: SessionOffer; pages_read: number }>({
    mutationFn: ({ offer, pages_read }) => {
      const body: SessionRequest = { pages_read, read_on: todayIn(time_zone) };
      // O intervalo só vai quando as páginas não foram corrigidas: assim ele bate com o total.
      if (pages_read === offer.suggested_pages) {
        body.from_page = offer.from_page;
        body.to_page = offer.to_page;
      }
      return api.post<Session>(`${itemBase('book', item_id)}/reading-sessions`, body);
    },
  });

  /** Oferta para a página de fechamento, ou `null` sem avanço, voltando páginas ou em artigo. */
  const offer_for = useCallback(
    (closing_page: number): SessionOffer | null => {
      if (item_type !== 'book' || open_page === undefined || closing_page <= open_page) return null;
      return {
        from_page: open_page,
        to_page: closing_page,
        suggested_pages: closing_page - open_page,
      };
    },
    [item_type, open_page],
  );

  return useMemo(
    () => ({
      offer_for,
      register: mutation.mutateAsync,
      is_pending: mutation.isPending,
      has_error: mutation.isError,
      reset: mutation.reset,
    }),
    [offer_for, mutation.mutateAsync, mutation.isPending, mutation.isError, mutation.reset],
  );
}
