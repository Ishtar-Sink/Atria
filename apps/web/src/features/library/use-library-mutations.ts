import type { Schemas } from '@atria/contracts';
import {
  useMutation,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
  type QueryKey,
} from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useSyncExternalStore } from 'react';
import { api } from '../../shared/api/client';
import { ApiProblem } from '../../shared/api/problem';
import { registerMessages } from '../../shared/i18n/i18n';
import { pushToast } from '../../shared/toast/toast-store';
import messages from './i18n/pt-br.json';
import {
  KIND_PATH,
  KIND_TAB,
  itemPath,
  libraryKeys,
  refusalMessageKey,
  type Article,
  type Book,
  type LibraryItem,
  type LibraryKind,
  type LibraryPage,
  type Video,
} from './use-library-items';

registerMessages('library', messages);

export type CreateBookBody = Schemas['CreateBookRequest'];
export type CreateArticleBody = Schemas['CreateArticleRequest'];
export type CreateVideoBody = Schemas['CreateVideoRequest'];
export type UpdateBookBody = Schemas['UpdateBookRequest'];
export type UpdateArticleBody = Schemas['UpdateArticleRequest'];
export type UpdateVideoBody = Schemas['UpdateVideoRequest'];
export type ItemBody = Record<string, unknown>;

/** Arquivos escolhidos no formulário, enviados depois de gravar o item (PD-36). */
export interface PendingFiles {
  cover?: File | null | undefined;
  pdf?: File | null | undefined;
}

export const COVER_MAX_BYTES = 5 * 1024 * 1024;
export const PDF_MAX_BYTES = 50 * 1024 * 1024;
export const COVER_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;

const CSRF_COOKIE = 'atria_csrf';

function readCookie(name: string): string | undefined {
  const prefix = `${name}=`;
  const found = document.cookie.split('; ').find((part) => part.startsWith(prefix));
  return found === undefined ? undefined : decodeURIComponent(found.slice(prefix.length));
}

/**
 * Envia o arquivo no corpo cru, como a API do Acervo pede (capa, miniatura e PDF). O cliente
 * comum só fala JSON, então o envio mantém aqui o mesmo cuidado com o token CSRF. Usa
 * `XMLHttpRequest` porque só ele informa o progresso do envio (RF-26).
 */
export function uploadRaw<T>(
  path: string,
  file: File,
  content_type: string,
  on_progress?: (percent: number) => void,
  method: 'PUT' = 'PUT',
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open(method, `/api/v1${path}`);
    request.setRequestHeader('Accept', 'application/json');
    request.setRequestHeader('Content-Type', content_type);
    const token = readCookie(CSRF_COOKIE);
    if (token !== undefined) request.setRequestHeader('X-CSRF-Token', token);
    request.withCredentials = true;
    request.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        on_progress?.(Math.round((event.loaded / event.total) * 100));
      }
    };
    const network = () => {
      reject(new ApiProblem({ status: 0, code: 'network_error', title: 'Network error' }));
    };
    request.onerror = network;
    request.onabort = network;
    request.onload = () => {
      let body: Record<string, unknown> | undefined;
      try {
        body = JSON.parse(request.responseText) as Record<string, unknown>;
      } catch {
        body = undefined;
      }
      if (request.status >= 200 && request.status < 300) {
        resolve(body as T);
        return;
      }
      reject(
        new ApiProblem({
          status: request.status,
          code: typeof body?.code === 'string' ? body.code : 'unknown_error',
          title: typeof body?.title === 'string' ? body.title : request.statusText,
        }),
      );
    };
    request.send(file);
  });
}

export type UploadTarget = 'cover' | 'pdf';

type UploadProgress = Record<UploadTarget, number | null>;

let upload_progress: UploadProgress = { cover: null, pdf: null };
const progress_listeners = new Set<() => void>();

function setUploadProgress(target: UploadTarget, value: number | null) {
  upload_progress = { ...upload_progress, [target]: value };
  progress_listeners.forEach((listener) => {
    listener();
  });
}

function subscribeProgress(listener: () => void) {
  progress_listeners.add(listener);
  return () => {
    progress_listeners.delete(listener);
  };
}

/** Progresso (0 a 100) do envio em andamento da capa ou do PDF; `null` sem envio. */
export function useUploadProgress(target: UploadTarget): number | null {
  return useSyncExternalStore(
    subscribeProgress,
    () => upload_progress[target],
    () => upload_progress[target],
  );
}

/** Capa do livro e do artigo, ou miniatura do vídeo. */
export function coverPath(kind: LibraryKind, id: string): string {
  return kind === 'video' ? `${itemPath(kind, id)}/thumbnail` : `${itemPath(kind, id)}/cover`;
}

export async function uploadCover(kind: LibraryKind, id: string, file: File) {
  try {
    return await uploadRaw<LibraryItem>(coverPath(kind, id), file, file.type, (percent) => {
      setUploadProgress('cover', percent);
    });
  } finally {
    setUploadProgress('cover', null);
  }
}

export async function uploadPdf(kind: 'book' | 'article', id: string, file: File) {
  try {
    return await uploadRaw<LibraryItem>(
      `${itemPath(kind, id)}/pdf`,
      file,
      'application/octet-stream',
      (percent) => {
        setUploadProgress('pdf', percent);
      },
    );
  } finally {
    setUploadProgress('pdf', null);
  }
}

function notifyUploaded() {
  pushToast({ tone: 'success', message_key: 'library.upload.success' });
}

/** Envia os arquivos escolhidos; devolve se algum foi enviado. */
async function sendFiles(kind: LibraryKind, id: string, files: PendingFiles): Promise<boolean> {
  let sent = false;
  if (files.cover) {
    await uploadCover(kind, id, files.cover);
    sent = true;
  }
  if (files.pdf && kind !== 'video') {
    await uploadPdf(kind, id, files.pdf);
    sent = true;
  }
  return sent;
}

type ListData = InfiniteData<LibraryPage, string | undefined>;

interface Snapshot {
  lists: [QueryKey, ListData | undefined][];
  detail: LibraryItem | undefined;
}

function mapLists(client: QueryClient, change: (items: LibraryItem[]) => LibraryItem[]) {
  client.setQueriesData<ListData>({ queryKey: libraryKeys.lists }, (current) =>
    current === undefined
      ? current
      : {
          ...current,
          pages: current.pages.map((page) => ({
            ...page,
            items: change(page.items as LibraryItem[]),
          })) as LibraryPage[],
        },
  );
}

function snapshotOf(client: QueryClient, kind: LibraryKind, id: string): Snapshot {
  return {
    lists: client.getQueriesData<ListData>({ queryKey: libraryKeys.lists }),
    detail: client.getQueryData<LibraryItem>(libraryKeys.detail(kind, id)),
  };
}

function restore(client: QueryClient, kind: LibraryKind, id: string, snapshot?: Snapshot) {
  snapshot?.lists.forEach(([key, data]) => {
    client.setQueryData(key, data);
  });
  client.setQueryData(libraryKeys.detail(kind, id), snapshot?.detail);
}

function definedOnly(body: ItemBody): ItemBody {
  return Object.fromEntries(Object.entries(body).filter(([, value]) => value !== undefined));
}

/** Cria o item, depois a capa e o PDF (PD-36); a tela abre no item criado. */
export function useCreateItem(kind: LibraryKind) {
  const client = useQueryClient();
  const navigate = useNavigate();
  return useMutation<
    { item: LibraryItem; sent: boolean },
    Error,
    { body: ItemBody; files?: PendingFiles }
  >({
    mutationFn: async ({ body, files = {} }) => {
      const created = await api.post<LibraryItem>(KIND_PATH[kind], body);
      let sent: boolean;
      try {
        sent = await sendFiles(kind, created.id, files);
      } catch (error) {
        // O item já existe: segue para a edição dele em vez de criar outro ao tentar de novo.
        await client.invalidateQueries({ queryKey: libraryKeys.all });
        pushToast({
          tone: 'danger',
          message_key:
            error instanceof ApiProblem && error.code === 'file_too_large'
              ? 'library.cover.too_large'
              : 'library.cover.upload_error',
        });
        await navigate({ to: `/library/${kind}s/${created.id}/edit` });
        throw error;
      }
      return { item: created, sent };
    },
    onSuccess: async ({ item, sent }) => {
      await client.invalidateQueries({ queryKey: libraryKeys.all });
      if (sent) notifyUploaded();
      await navigate({ to: `/library/${kind}s/${item.id}` });
    },
  });
}

/** Aplica a edição na hora e desfaz com aviso na recusa (RNF-09). */
export function useUpdateItem(kind: LibraryKind) {
  const client = useQueryClient();
  const navigate = useNavigate();
  return useMutation<
    { item: LibraryItem; sent: boolean },
    Error,
    { id: string; body: ItemBody; files?: PendingFiles },
    Snapshot
  >({
    mutationFn: async ({ id, body, files = {} }) => {
      const updated = await api.patch<LibraryItem>(itemPath(kind, id), body);
      const sent = await sendFiles(kind, id, files);
      return { item: updated, sent };
    },
    onMutate: async ({ id, body }) => {
      await client.cancelQueries({ queryKey: libraryKeys.all });
      const snapshot = snapshotOf(client, kind, id);
      const patch = definedOnly(body);
      mapLists(client, (items) =>
        items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
      );
      client.setQueryData<LibraryItem>(libraryKeys.detail(kind, id), (item) =>
        item === undefined ? item : { ...item, ...patch },
      );
      return snapshot;
    },
    onError: (error, { id }, snapshot) => {
      restore(client, kind, id, snapshot);
      pushToast({ tone: 'danger', message_key: refusalMessageKey(error) });
    },
    onSuccess: async ({ sent }, { id }) => {
      await client.invalidateQueries({ queryKey: libraryKeys.all });
      if (sent) notifyUploaded();
      await navigate({ to: `/library/${kind}s/${id}` });
    },
    onSettled: () => client.invalidateQueries({ queryKey: libraryKeys.all }),
  });
}

export function useDeleteItem(kind: LibraryKind) {
  const client = useQueryClient();
  const navigate = useNavigate();
  return useMutation<undefined, Error, { id: string }, Snapshot>({
    mutationFn: ({ id }) => api.delete<undefined>(itemPath(kind, id)),
    onMutate: async ({ id }) => {
      await client.cancelQueries({ queryKey: libraryKeys.lists });
      const snapshot = snapshotOf(client, kind, id);
      mapLists(client, (items) => items.filter((item) => item.id !== id));
      return snapshot;
    },
    onError: (error, { id }, snapshot) => {
      restore(client, kind, id, snapshot);
      pushToast({ tone: 'danger', message_key: refusalMessageKey(error) });
    },
    onSuccess: async (_data, { id }) => {
      client.removeQueries({ queryKey: libraryKeys.detail(kind, id) });
      await navigate({ to: '/library', search: { tab: KIND_TAB[kind] } });
    },
    onSettled: () => client.invalidateQueries({ queryKey: libraryKeys.lists }),
  });
}

type CoverCarrier = Book | Article | Video;

function withCover(item: CoverCarrier, file_id: string | null): CoverCarrier {
  return 'thumbnail_file_id' in item || 'channel' in item
    ? { ...item, thumbnail_file_id: file_id }
    : { ...item, cover_file_id: file_id };
}

/** Envia, troca e remove a capa (ou a miniatura) de um item já gravado (PD-36). */
export function useCoverMutations(kind: LibraryKind, id: string) {
  const client = useQueryClient();
  const detail_key = libraryKeys.detail(kind, id);
  const settle = () => client.invalidateQueries({ queryKey: libraryKeys.all });
  const upload = useMutation<LibraryItem, Error, File>({
    mutationFn: (file) => uploadCover(kind, id, file),
    onSuccess: notifyUploaded,
    onSettled: settle,
  });
  const remove = useMutation<undefined, Error, undefined, Snapshot>({
    mutationFn: () => api.delete<undefined>(coverPath(kind, id)),
    onMutate: async () => {
      await client.cancelQueries({ queryKey: libraryKeys.all });
      const snapshot = snapshotOf(client, kind, id);
      mapLists(client, (items) =>
        items.map((item) => (item.id === id ? withCover(item, null) : item)),
      );
      client.setQueryData<LibraryItem>(detail_key, (item) =>
        item === undefined ? item : withCover(item, null),
      );
      return snapshot;
    },
    onError: (error, _variables, snapshot) => {
      restore(client, kind, id, snapshot);
      pushToast({ tone: 'danger', message_key: refusalMessageKey(error) });
    },
    onSettled: settle,
  });
  return { upload, remove };
}

/** Anexa ou troca o PDF de um livro ou artigo já gravado. */
export function usePdfUpload(kind: 'book' | 'article', id: string) {
  const client = useQueryClient();
  return useMutation<LibraryItem, Error, File>({
    mutationFn: (file) => uploadPdf(kind, id, file),
    onSuccess: notifyUploaded,
    onSettled: () => client.invalidateQueries({ queryKey: libraryKeys.all }),
  });
}
