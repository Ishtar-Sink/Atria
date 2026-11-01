import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { registerMessages, useT } from '../../shared/i18n/i18n';
import messages from './i18n/pt-br.json';
import type { PdfDocument } from './load-pdf';
import { PdfPage } from './pdf-page';
import type { Highlight, HighlightRect } from './use-highlights';
import styles from './reader.module.css';

registerMessages('reader', messages);

export interface TextSelection {
  page: number;
  text: string;
  rects: HighlightRect[];
}

export interface PdfViewerProps {
  doc: PdfDocument;
  zoom: number;
  /** Largura, em px, que a página ocupa a 100% (limitada pela largura do palco). */
  reading_width: number;
  /** Página pedida de fora (botões, teclado, retomada); `nonce` repete o pedido da mesma página. */
  goto: { page: number; nonce: number } | undefined;
  highlights: readonly Highlight[];
  onPageChange: (page: number) => void;
  onSelection: (selection: TextSelection | undefined) => void;
}

const NEAR_MARGIN = '150% 0px';
const SIDE_PADDING = 32;
const MAX_RECTS = 50;

/**
 * Escala da página: a 100% ela tem a largura de leitura, limitada pelo palco (RF-29, CB-11);
 * os demais zooms são relativos a ela. Sem o palco medido, vale o próprio zoom.
 */
export function readingScale(
  stage_width: number,
  page_width: number,
  zoom: number,
  reading_width: number,
): number {
  if (stage_width <= SIDE_PADDING || page_width <= 0) return Math.max(0.1, zoom);
  const target = Math.min(reading_width, stage_width - SIDE_PADDING);
  return Math.max(0.1, (target / page_width) * zoom);
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** Retângulos do trecho selecionado, em frações da página. */
function selectionRects(range: Range, page_el: Element): HighlightRect[] {
  if (typeof range.getClientRects !== 'function') return [];
  const box = page_el.getBoundingClientRect();
  if (box.width === 0 || box.height === 0) return [];
  return Array.from(range.getClientRects())
    .filter((rect) => rect.width > 0 && rect.height > 0)
    .slice(0, MAX_RECTS)
    .map((rect) => ({
      x: clamp01((rect.left - box.left) / box.width),
      y: clamp01((rect.top - box.top) / box.height),
      width: clamp01(rect.width / box.width),
      height: clamp01(rect.height / box.height),
    }));
}

function readSelection(stage: HTMLElement): TextSelection | undefined {
  const selection = document.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return undefined;
  const range = selection.getRangeAt(0);
  const start = range.startContainer;
  const origin = start instanceof Element ? start : start.parentElement;
  const page_el = origin?.closest('[data-page]');
  if (!page_el || !stage.contains(page_el)) return undefined;
  const text = selection.toString().trim();
  if (text === '') return undefined;
  return {
    page: Number(page_el.getAttribute('data-page')),
    text,
    rects: selectionRects(range, page_el),
  };
}

/** Rolagem das páginas, com renderização só das visíveis e das vizinhas. */
export function PdfViewer({
  doc,
  zoom,
  reading_width,
  goto,
  highlights,
  onPageChange,
  onSelection,
}: PdfViewerProps) {
  const t = useT();
  const stage = useRef<HTMLDivElement>(null);
  const pages = useRef(new Map<number, HTMLElement>());
  const current = useRef(1);
  const [near, setNear] = useState<ReadonlySet<number>>(() => new Set([1]));
  const [width, setWidth] = useState(0);

  // O foco começa na rolagem, para as setas e o Page Up/Down valerem de imediato.
  useEffect(() => {
    stage.current?.focus({ preventScroll: true });
  }, []);

  // Largura útil do palco: a escala de ajuste parte dela, para caber a partir de 360 px.
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const measure = () => {
      setWidth(el.clientWidth);
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => {
      observer.disconnect();
    };
  }, []);

  const scale = readingScale(width, doc.first_page_size.width, zoom, reading_width);

  // Páginas perto da área visível.
  useEffect(() => {
    const root = stage.current;
    if (!root || typeof IntersectionObserver === 'undefined') {
      setNear(new Set(Array.from({ length: Math.min(doc.page_count, 3) }, (_, i) => i + 1)));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        setNear((previous) => {
          const next = new Set(previous);
          for (const entry of entries) {
            const page = Number(entry.target.getAttribute('data-page'));
            if (entry.isIntersecting) next.add(page);
            else next.delete(page);
          }
          return next;
        });
      },
      { root, rootMargin: NEAR_MARGIN },
    );
    pages.current.forEach((el) => {
      observer.observe(el);
    });
    return () => {
      observer.disconnect();
    };
  }, [doc]);

  // Página atual: a que cruza o terço superior da área visível.
  const onScroll = useCallback(() => {
    const root = stage.current;
    if (!root) return;
    const line = root.getBoundingClientRect().top + root.clientHeight / 3;
    let found = current.current;
    pages.current.forEach((el, page) => {
      const box = el.getBoundingClientRect();
      if (box.top <= line && box.bottom > line) found = page;
    });
    if (found !== current.current) {
      current.current = found;
      onPageChange(found);
    }
  }, [onPageChange]);

  // Ao mudar a escala (largura medida, zoom) as alturas mudam: mantém a página atual no topo,
  // senão a retomada cai em outra página (por exemplo em 360 px).
  useLayoutEffect(() => {
    pages.current.get(current.current)?.scrollIntoView({ block: 'start' });
  }, [scale]);

  useEffect(() => {
    if (goto === undefined) return;
    current.current = goto.page;
    pages.current.get(goto.page)?.scrollIntoView({ block: 'start' });
  }, [goto]);

  // Seleção de texto, para criar nota ou destacar.
  useEffect(() => {
    const root = stage.current;
    if (!root) return;
    const onChange = () => {
      onSelection(readSelection(root));
    };
    document.addEventListener('selectionchange', onChange);
    return () => {
      document.removeEventListener('selectionchange', onChange);
    };
  }, [onSelection]);

  const by_page = new Map<number, Highlight[]>();
  for (const item of highlights) {
    by_page.set(item.page, [...(by_page.get(item.page) ?? []), item]);
  }

  return (
    <div
      ref={stage}
      className={styles.stage}
      role="region"
      aria-label={t('reader.viewer_label')}
      // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- área rolável precisa de foco para o teclado
      tabIndex={0}
      onScroll={onScroll}
    >
      <div className={styles.pages}>
        {Array.from({ length: doc.page_count }, (_, index) => index + 1).map((page) => (
          <div
            key={page}
            ref={(el) => {
              if (el) pages.current.set(page, el);
              else pages.current.delete(page);
            }}
            data-page={page}
          >
            <PdfPage
              doc={doc}
              page_number={page}
              scale={scale}
              near={near.has(page)}
              highlights={by_page.get(page) ?? []}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
