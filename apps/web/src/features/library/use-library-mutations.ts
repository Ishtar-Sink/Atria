import type { Schemas } from '@atria/contracts';
import {
  useMutation,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
  type QueryKey,
} from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
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
 * comum só fala JSON, então o envio mantém aqui o mesmo cuidado com o token CSRF.
 */
export async function uploadRaw<T>(
  path: string,
  file: File,
  content_type: string,
  method: 'PUT' = 'PUT',
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': content_type,
  };
  const token = readCookie(CSRF_COOKIE);
  if (token !== undefined) headers['X-CSRF-Token'] = token;
  let response: Response;
  try {
    response = await fetch(`/api/v1${path}`, {
      method,
      headers,
      credentials: 'same-origin',
      body: file,
    });
  } catch {
    throw new ApiProblem({ status: 0, code: 'network_error', title: 'Network error' });
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    throw new ApiProblem({
      status: response.status,
      code: typeof body.code === 'string' ? body.code : 'unknown_error',
      title: typeof body.title === 'string' ? body.title : response.statusText,
    });
  }
  return (await response.json().catch(() => undefined)) as T;
}

/** Capa do livro e do artigo, ou miniatura do vídeo. */
export function coverPath(kind: LibraryKind, id: string): string {
  return kind === 'video' ? `${itemPath(kind, id)}/thumbnail` : `${itemPath(kind, id)}/cover`;
}

export function uploadCover(kind: LibraryKind, id: string, file: File) {
  return uploadRaw<LibraryItem>(coverPath(kind, id), file, file.type);
}

export function uploadPdf(kind: 'book' | 'article', id: string, file: File) {
  return uploadRaw<LibraryItem>(`${itemPath(kind, id)}/pdf`, file, 'application/octet-stream');
}

async function sendFiles(kind: LibraryKind, id: string, files: PendingFiles) {
  if (files.cover) await uploadCover(kind, id, files.cover);
  if (files.pdf && kind !== 'video') await uploadPdf(kind, id, files.pdf);
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
  return useMutation<LibraryItem, Error, { body: ItemBody; files?: PendingFiles }>({
    mutationFn: async ({ body, files = {} }) => {
      const created = await api.post<LibraryItem>(KIND_PATH[kind], body);
      try {
        await sendFiles(kind, created.id, files);
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
      return created;
    },
    onSuccess: async (item) => {
      await client.invalidateQueries({ queryKey: libraryKeys.all });
      await navigate({ to: `/library/${kind}s/${item.id}` });
    },
  });
}

/** Aplica a edição na hora e desfaz com aviso na recusa (RNF-09). */
export function useUpdateItem(kind: LibraryKind) {
  const client = useQueryClient();
  const navigate = useNavigate();
  return useMutation<
    LibraryItem,
    Error,
    { id: string; body: ItemBody; files?: PendingFiles },
    Snapshot
  >({
    mutationFn: async ({ id, body, files = {} }) => {
      const updated = await api.patch<LibraryItem>(itemPath(kind, id), body);
      await sendFiles(kind, id, files);
      return updated;
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
    onSuccess: async (_item, { id }) => {
      await client.invalidateQueries({ queryKey: libraryKeys.all });
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
    onSettled: () => client.invalidateQueries({ queryKey: libraryKeys.all }),
  });
}
