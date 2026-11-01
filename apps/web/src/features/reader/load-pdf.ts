import {
  getDocument,
  GlobalWorkerOptions,
  InvalidPDFException,
  PasswordException,
  TextLayer,
  type PDFDocumentProxy,
} from 'pdfjs-dist';
import worker_url from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Único arquivo da feature que importa a biblioteca: ela vem empacotada pelo Vite (sem CDN,
// [project/architecture-12]) e só entra no chunk das rotas do leitor.
GlobalWorkerOptions.workerSrc = worker_url;

// A primeira página chega em poucos pedidos `Range` de 64 KB, sem baixar o arquivo inteiro (RF-28).
const RANGE_CHUNK_SIZE = 65536;

export type PdfErrorKind = 'corrupted' | 'protected';

/** Erro tipado do carregamento: arquivo corrompido ou protegido por senha (CB-16). */
export class PdfLoadError extends Error {
  readonly kind: PdfErrorKind;

  constructor(kind: PdfErrorKind) {
    super(kind);
    this.name = 'PdfLoadError';
    this.kind = kind;
  }
}

export interface PdfPageSize {
  width: number;
  height: number;
}

export interface RenderPageOptions {
  canvas: HTMLCanvasElement;
  text_layer: HTMLElement;
  scale: number;
  signal: AbortSignal;
}

export interface RenderedPage {
  size: PdfPageSize;
  has_text: boolean;
}

/** Visão mínima do documento: o resto do app não conhece os tipos da biblioteca. */
export interface PdfDocument {
  page_count: number;
  /** Tamanho da primeira página na escala 1, base para reservar a altura das demais. */
  first_page_size: PdfPageSize;
  render_page: (page_number: number, options: RenderPageOptions) => Promise<RenderedPage>;
  destroy: () => void;
}

function wrap(pdf: PDFDocumentProxy, first_page_size: PdfPageSize): PdfDocument {
  return {
    page_count: pdf.numPages,
    first_page_size,
    async render_page(page_number, { canvas, text_layer, scale, signal }) {
      const page = await pdf.getPage(page_number);
      const viewport = page.getViewport({ scale });
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.floor(viewport.width * ratio);
      canvas.height = Math.floor(viewport.height * ratio);
      canvas.style.width = `${String(viewport.width)}px`;
      canvas.style.height = `${String(viewport.height)}px`;
      const painting = page.render({
        canvas,
        viewport,
        ...(ratio === 1 ? {} : { transform: [ratio, 0, 0, ratio, 0, 0] }),
      });
      const layer = new TextLayer({
        textContentSource: page.streamTextContent(),
        container: text_layer,
        viewport,
      });
      const cancel = () => {
        painting.cancel();
        layer.cancel();
      };
      signal.addEventListener('abort', cancel);
      try {
        text_layer.replaceChildren();
        text_layer.style.setProperty('--total-scale-factor', String(scale));
        await Promise.all([painting.promise, layer.render()]);
      } finally {
        signal.removeEventListener('abort', cancel);
        page.cleanup();
      }
      return {
        size: { width: viewport.width, height: viewport.height },
        has_text: text_layer.textContent.trim() !== '',
      };
    },
    destroy() {
      void pdf.loadingTask.destroy();
    },
  };
}

/** Abre o PDF (com o cookie de sessão) ou lança `PdfLoadError` tipado. */
export async function loadPdf(url: string): Promise<PdfDocument> {
  try {
    const pdf = await getDocument({
      url,
      withCredentials: true,
      rangeChunkSize: RANGE_CHUNK_SIZE,
      disableAutoFetch: true,
      disableStream: true,
    }).promise;
    const first = await pdf.getPage(1);
    const view = first.getViewport({ scale: 1 });
    return wrap(pdf, { width: view.width, height: view.height });
  } catch (error) {
    if (error instanceof PasswordException) throw new PdfLoadError('protected');
    if (error instanceof InvalidPDFException) throw new PdfLoadError('corrupted');
    throw new PdfLoadError('corrupted');
  }
}
