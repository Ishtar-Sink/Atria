import type { Schemas } from '@atria/contracts';
import { useMutation } from '@tanstack/react-query';
import { api } from '../../shared/api/client';
import { itemBase, type ReaderItemType } from './use-pdf-document';

export interface PassageNoteInput {
  page: number;
  /** Trecho selecionado; ausente quando a página não tem texto (CB-20). */
  quote?: string | undefined;
  comment?: string | undefined;
}

type Note = Schemas['ItemNoteResponse'];

/** Cria a nota do trecho no histórico do item (RF-68, RN-24). */
export function usePassageNote(item_type: ReaderItemType, item_id: string) {
  return useMutation<Note, Error, PassageNoteInput>({
    mutationFn: ({ page, quote, comment }) => {
      const body: Schemas['CreateItemNoteRequest'] = { page };
      if (quote !== undefined && quote.trim() !== '') body.quote = quote;
      if (comment !== undefined && comment.trim() !== '') body.comment = comment.trim();
      const notes = item_type === 'book' ? 'book-notes' : 'article-notes';
      return api.post<Note>(`${itemBase(item_type, item_id)}/${notes}`, body);
    },
  });
}
