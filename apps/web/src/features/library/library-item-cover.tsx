import { ItemSwatch } from '@atria/ui';
import { registerMessages, useT } from '../../shared/i18n/i18n';
import messages from './i18n/pt-br.json';
import type { LibraryKind } from './use-library-items';
import styles from './library.module.css';

registerMessages('library', messages);

export interface LibraryItemCoverProps {
  kind: LibraryKind;
  id: string;
  title: string;
  /** Capa do livro e do artigo, ou miniatura do vídeo. */
  file_id?: string | null | undefined;
  /** Ao lado do título a imagem é só enfeite: o texto alternativo fica vazio. */
  decorative?: boolean;
  className?: string;
}

/** Endereço do arquivo: o servidor entrega só pelo id ([project/security-10]). */
export function fileUrl(file_id: string): string {
  return `/api/v1/files/${encodeURIComponent(file_id)}`;
}

/**
 * Capa, miniatura ou gradiente determinístico do id, em 2:3 no livro e 16:9 no artigo e no
 * vídeo (PD-36, PD-38). O servidor não recorta: a imagem cobre a caixa.
 */
export function LibraryItemCover({
  kind,
  id,
  title,
  file_id,
  decorative = false,
  className,
}: LibraryItemCoverProps) {
  const t = useT();
  const shape = kind === 'book' ? styles.portrait : styles.landscape;
  const classes = [styles.cover, shape, className].filter(Boolean).join(' ');
  if (file_id) {
    return (
      <div className={classes} data-cover={kind === 'book' ? '2:3' : '16:9'}>
        <img
          src={fileUrl(file_id)}
          alt={
            decorative
              ? ''
              : t(kind === 'video' ? 'library.cover.alt_thumbnail' : 'library.cover.alt', { title })
          }
          loading="lazy"
          className={styles.coverImage}
        />
      </div>
    );
  }
  return (
    <div
      className={classes}
      data-cover={kind === 'book' ? '2:3' : '16:9'}
      {...(decorative
        ? { 'aria-hidden': true }
        : { role: 'img', 'aria-label': t('library.cover.alt_empty', { title }) })}
    >
      <ItemSwatch id={id} className={styles.coverFill} />
    </div>
  );
}
