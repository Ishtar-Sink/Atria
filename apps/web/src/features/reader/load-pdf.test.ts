import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getDocument, first_page } = vi.hoisted(() => ({
  getDocument: vi.fn(),
  first_page: { getViewport: vi.fn(() => ({ width: 600, height: 800 })) },
}));

vi.mock('pdfjs-dist', () => {
  class InvalidPDFException extends Error {
    readonly kind = 'invalid';
  }
  class PasswordException extends Error {
    readonly kind = 'password';
  }
  class TextLayer {
    readonly kind = 'text-layer';
  }
  return {
    getDocument,
    GlobalWorkerOptions: {},
    InvalidPDFException,
    PasswordException,
    TextLayer,
  };
});
vi.mock('pdfjs-dist/build/pdf.worker.min.mjs?url', () => ({ default: 'worker.js' }));

import { InvalidPDFException, PasswordException } from 'pdfjs-dist';
import { loadPdf, PdfLoadError } from './load-pdf';

async function failWith(error: unknown): Promise<never> {
  await Promise.resolve();
  throw error as Error;
}

function openWith(promise: Promise<unknown>) {
  getDocument.mockReturnValue({ promise });
}

beforeEach(() => {
  getDocument.mockReset();
  first_page.getViewport.mockClear();
});

describe('loadPdf', () => {
  it('opens the pdf in ranges without downloading the whole file', async () => {
    openWith(Promise.resolve({ numPages: 64, getPage: vi.fn(() => Promise.resolve(first_page)) }));
    await loadPdf('/api/v1/files/f-1');
    expect(getDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/api/v1/files/f-1',
        withCredentials: true,
        disableAutoFetch: true,
        disableStream: true,
        rangeChunkSize: 65536,
      }),
    );
  });

  it('reads the size of the first page at scale 1', async () => {
    openWith(Promise.resolve({ numPages: 64, getPage: vi.fn(() => Promise.resolve(first_page)) }));
    const doc = await loadPdf('/api/v1/files/f-1');
    expect(first_page.getViewport).toHaveBeenCalledWith({ scale: 1 });
    expect(doc.page_count).toBe(64);
    expect(doc.first_page_size).toEqual({ width: 600, height: 800 });
  });

  it('maps a password error to protected', async () => {
    openWith(failWith(new PasswordException('senha', 1)));
    await expect(loadPdf('/api/v1/files/f-1')).rejects.toMatchObject({
      name: 'PdfLoadError',
      kind: 'protected',
    });
  });

  it('maps an invalid pdf to corrupted', async () => {
    openWith(failWith(new InvalidPDFException('invalido')));
    const error: unknown = await loadPdf('/api/v1/files/f-1').catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(PdfLoadError);
    expect(error).toMatchObject({ kind: 'corrupted' });
  });
});
