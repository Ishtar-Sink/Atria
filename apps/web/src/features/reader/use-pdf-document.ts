import type { Schemas } from '@atria/contracts';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { api } from '../../shared/api/client';
import { loadPdf, PdfLoadError, type PdfDocument } from './load-pdf';

export type ReaderItemType = 'book' | 'article';

/** Prefixo da API do item: `/books/{id}` ou `/articles/{id}`. */
export function itemBase(item_type: ReaderItemType, item_id: string): string {
  return `${item_type === 'book' ? '/books' : '/articles'}/${encodeURIComponent(item_id)}`;
}

export function fileUrl(file_id: string): string {
  return `/api/v1/files/${encodeURIComponent(file_id)}`;
}

export type PdfStatus = 'loading' | 'ready' | 'corrupted' | 'protected' | 'no_file' | 'error';

export interface PdfDocumentState {
  status: PdfStatus;
  doc: PdfDocument | undefined;
  title: string;
  file_id: string | undefined;
}

type ItemSummary = Pick<Schemas['BookResponse'], 'id' | 'title' | 'pdf_file_id'>;

/** Lê o item para achar o PDF e o carrega por `/files/{id}`; arquivo ruim vira estado, não exceção. */
export function usePdfDocument(item_type: ReaderItemType, item_id: string): PdfDocumentState {
  const item = useQuery({
    queryKey: ['reader', 'item', item_type, item_id],
    queryFn: ({ signal }) => api.get<ItemSummary>(itemBase(item_type, item_id), { signal }),
  });
  const file_id = item.data?.pdf_file_id ?? undefined;
  const [loaded, setLoaded] = useState<{
    file_id: string;
    doc?: PdfDocument;
    error?: 'corrupted' | 'protected' | 'error';
  }>();

  useEffect(() => {
    if (file_id === undefined) return;
    let cancelled = false;
    let opened: PdfDocument | undefined;
    loadPdf(fileUrl(file_id)).then(
      (doc) => {
        if (cancelled) {
          doc.destroy();
          return;
        }
        opened = doc;
        setLoaded({ file_id, doc });
      },
      (error: unknown) => {
        if (cancelled) return;
        setLoaded({ file_id, error: error instanceof PdfLoadError ? error.kind : 'error' });
      },
    );
    return () => {
      cancelled = true;
      opened?.destroy();
    };
  }, [file_id]);

  const title = item.data?.title ?? '';
  if (item.isError) return { status: 'error', doc: undefined, title, file_id };
  if (item.isPending) return { status: 'loading', doc: undefined, title, file_id };
  if (file_id === undefined) return { status: 'no_file', doc: undefined, title, file_id };
  if (loaded?.file_id !== file_id) return { status: 'loading', doc: undefined, title, file_id };
  if (loaded.error) return { status: loaded.error, doc: undefined, title, file_id };
  return { status: 'ready', doc: loaded.doc, title, file_id };
}
