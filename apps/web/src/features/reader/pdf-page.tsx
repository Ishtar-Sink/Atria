import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { registerMessages, useT } from '../../shared/i18n/i18n';
import messages from './i18n/pt-br.json';
import type { Highlight } from './use-highlights';
import type { PdfDocument, PdfPageSize } from './load-pdf';
import styles from './reader.module.css';

registerMessages('reader', messages);

export interface PdfPageProps {
  doc: PdfDocument;
  page_number: number;
  scale: number;
  /** Renderiza só quando a página está perto da área visível. */
  near: boolean;
  highlights: readonly Highlight[];
}

/** Uma página: canvas, camada de texto selecionável e camada de destaques. */
export function PdfPage({ doc, page_number, scale, near, highlights }: PdfPageProps) {
  const t = useT();
  const canvas = useRef<HTMLCanvasElement>(null);
  const text_layer = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<PdfPageSize & { scale: number }>();

  useEffect(() => {
    const canvas_el = canvas.current;
    const layer_el = text_layer.current;
    if (!canvas_el || !layer_el) return;
    if (!near) {
      // Libera a memória das páginas distantes.
      canvas_el.width = 0;
      canvas_el.height = 0;
      layer_el.replaceChildren();
      return;
    }
    const controller = new AbortController();
    doc
      .render_page(page_number, {
        canvas: canvas_el,
        text_layer: layer_el,
        scale,
        signal: controller.signal,
      })
      .then((rendered) => {
        if (!controller.signal.aborted) setSize({ ...rendered.size, scale });
      })
      .catch(() => undefined);
    return () => {
      controller.abort();
    };
  }, [doc, page_number, scale, near]);

  const placeholder = doc.first_page_size;
  // O tamanho renderizado só vale na escala em que foi medido; fora dela, o reservado.
  const measured = size?.scale === scale ? size : undefined;
  const width = measured?.width ?? placeholder.width * scale;
  const height = measured?.height ?? placeholder.height * scale;

  return (
    <div
      role="region"
      aria-label={t('reader.page_region', { page: page_number })}
      className={styles.page}
      style={{ width, height }}
      data-page={page_number}
      data-near={near}
    >
      <canvas ref={canvas} className={styles.canvas} aria-hidden="true" />
      <div className={styles.marks} aria-hidden="true">
        {highlights
          .filter((item) => item.is_current_file)
          .flatMap((item) =>
            item.rects.map((rect, index) => (
              <span
                key={`${item.id}-${String(index)}`}
                className={styles.mark}
                data-color={item.color}
                style={
                  {
                    '--mark-color': item.color,
                    left: `${String(rect.x * 100)}%`,
                    top: `${String(rect.y * 100)}%`,
                    width: `${String(rect.width * 100)}%`,
                    height: `${String(rect.height * 100)}%`,
                  } as CSSProperties
                }
              />
            )),
          )}
      </div>
      <div ref={text_layer} className={styles.textLayer} />
    </div>
  );
}
