import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiProblem } from '../../shared/api/problem';
import { clearToasts, getToasts } from '../../shared/toast/toast-store';
import { bookOf, stubLibraryServer } from './library-test-server';
import {
  uploadCover,
  useCoverMutations,
  usePdfUpload,
  useUploadProgress,
  uploadPdf,
} from './use-library-mutations';

afterEach(() => {
  vi.unstubAllGlobals();
  clearToasts();
  document.cookie = 'atria_csrf=; expires=Thu, 01 Jan 1970 00:00:00 GMT';
});

function wrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

const png = () => new File([new Uint8Array(100)], 'capa.png', { type: 'image/png' });
const pdf = () => new File([new Uint8Array(100)], 'livro.pdf', { type: 'application/pdf' });

describe('library uploads', () => {
  it('sends the file with the csrf header and the content type', async () => {
    document.cookie = 'atria_csrf=token-1';
    const server = stubLibraryServer({ books: [bookOf()] });
    const sent: string[] = [];
    const Base = XMLHttpRequest;
    class Spy extends Base {
      override setRequestHeader(name: string, value: string) {
        if (name === 'X-CSRF-Token') sent.push(value);
        super.setRequestHeader(name, value);
      }
    }
    vi.stubGlobal('XMLHttpRequest', Spy);
    await uploadCover('book', 'b-1', png());
    expect(sent).toEqual(['token-1']);
    const call = server.calls.find((entry) => entry.method === 'PUT');
    expect(call?.url.pathname).toBe('/api/v1/books/b-1/cover');
    expect(call?.content_type).toBe('image/png');
    expect(call?.file).toBeInstanceOf(File);
  });

  it('reports the upload progress of the cover and of the pdf', async () => {
    const server = stubLibraryServer({ books: [bookOf()], hold_uploads: true });
    const { result } = renderHook(
      () => ({ cover: useUploadProgress('cover'), pdf: useUploadProgress('pdf') }),
      { wrapper: wrapper() },
    );
    expect(result.current).toEqual({ cover: null, pdf: null });

    let sending!: Promise<unknown>;
    act(() => {
      sending = uploadPdf('book', 'b-1', pdf());
    });
    await waitFor(() => {
      expect(result.current.pdf).toBe(50);
    });
    await act(async () => {
      server.release_uploads();
      await sending;
    });
    expect(result.current.pdf).toBeNull();

    act(() => {
      sending = uploadCover('book', 'b-1', png());
    });
    await waitFor(() => {
      expect(result.current.cover).toBe(50);
    });
    await act(async () => {
      server.release_uploads();
      await sending;
    });
    expect(result.current.cover).toBeNull();
  });

  it('shows a success notice when the files are sent', async () => {
    stubLibraryServer({ books: [bookOf()] });
    const { result } = renderHook(
      () => ({ cover: useCoverMutations('book', 'b-1'), pdf: usePdfUpload('book', 'b-1') }),
      { wrapper: wrapper() },
    );
    await act(async () => {
      await result.current.cover.upload.mutateAsync(png());
    });
    expect(getToasts().map((toast) => toast.message_key)).toEqual(['library.upload.success']);
    clearToasts();
    await act(async () => {
      await result.current.pdf.mutateAsync(pdf());
    });
    expect(getToasts()).toHaveLength(1);
    expect(getToasts()[0]).toMatchObject({
      tone: 'success',
      message_key: 'library.upload.success',
    });
  });

  it('maps a refused upload to the api problem code', async () => {
    stubLibraryServer({
      books: [bookOf()],
      reject: [{ method: 'PUT', match: /cover$/, status: 413, code: 'file_too_large' }],
    });
    await expect(uploadCover('book', 'b-1', png())).rejects.toMatchObject({
      constructor: ApiProblem,
      code: 'file_too_large',
      status: 413,
    });
  });

  it('maps a network failure to network_error and clears the progress', async () => {
    stubLibraryServer({ books: [bookOf()], fail_uploads_network: true });
    const { result } = renderHook(() => useUploadProgress('cover'), { wrapper: wrapper() });
    await expect(uploadCover('book', 'b-1', png())).rejects.toMatchObject({
      code: 'network_error',
      status: 0,
    });
    expect(result.current).toBeNull();
  });
});
