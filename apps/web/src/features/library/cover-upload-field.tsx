import { Button, ProgressBar } from '@atria/ui';
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
} from 'react';
import { ApiProblem } from '../../shared/api/problem';
import { registerMessages, useT } from '../../shared/i18n/i18n';
import messages from './i18n/pt-br.json';
import { fileUrl } from './library-item-cover';
import type { LibraryKind } from './use-library-items';
import {
  COVER_MAX_BYTES,
  COVER_TYPES,
  useCoverMutations,
  useUploadProgress,
} from './use-library-mutations';
import styles from './library.module.css';

registerMessages('library', messages);

export interface CoverUploadFieldProps {
  kind: LibraryKind;
  /** Título do item, para o texto alternativo da imagem. */
  title?: string;
  /** Com o item já gravado, o arquivo vai direto para o servidor. */
  item_id?: string | undefined;
  /** Capa (ou miniatura) atual do item. */
  file_id?: string | null | undefined;
  /** Sem item gravado, o arquivo escolhido espera aqui até o formulário salvar. */
  pending?: File | null | undefined;
  on_pending?: (file: File | null) => void;
  /** Dica abaixo da área, como a do envio manual da miniatura. */
  hint?: string | undefined;
}

function useObjectUrl(file: File | null | undefined): string | undefined {
  const url = useMemo(
    () =>
      file && typeof URL.createObjectURL === 'function' ? URL.createObjectURL(file) : undefined,
    [file],
  );
  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );
  return url;
}

/**
 * Área de capa para clicar ou arrastar uma imagem (PD-36): só PNG, JPEG ou WebP até 5 MB, com
 * "Trocar" e "Remover". A prévia usa a proporção do tipo: 2:3 no livro e 16:9 no artigo e no vídeo.
 */
export function CoverUploadField({
  kind,
  title = '',
  item_id,
  file_id,
  pending,
  on_pending,
  hint,
}: CoverUploadFieldProps) {
  const t = useT();
  const input_id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string>();
  const [over, setOver] = useState(false);
  const { upload, remove } = useCoverMutations(kind, item_id ?? '');
  const preview = useObjectUrl(pending);
  const label = t(`library.cover.label_${kind}`);
  const shown = preview ?? (file_id ? fileUrl(file_id) : undefined);
  const wide = kind !== 'book';
  const progress = useUploadProgress('cover');
  const busy = upload.isPending;

  function openChooser() {
    if (!busy) input.current?.click();
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openChooser();
    }
  }

  function validate(file: File): string | undefined {
    if (!COVER_TYPES.some((type) => type === file.type)) return t('library.cover.invalid_type');
    if (file.size > COVER_MAX_BYTES) return t('library.cover.too_large');
    return undefined;
  }

  function serverError(problem: unknown): string {
    if (problem instanceof ApiProblem) {
      if (problem.code === 'unsupported_file_type') return t('library.cover.invalid_type');
      if (problem.code === 'file_too_large') return t('library.cover.too_large');
    }
    return t('library.cover.upload_error');
  }

  function choose(file: File | undefined) {
    if (!file) return;
    const invalid = validate(file);
    if (invalid) {
      setError(invalid);
      return;
    }
    setError(undefined);
    if (item_id) {
      upload.mutate(file, {
        onError: (problem) => {
          setError(serverError(problem));
        },
      });
    } else {
      on_pending?.(file);
    }
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setOver(false);
    choose(event.dataTransfer.files[0]);
  }

  function dropFile() {
    setError(undefined);
    if (item_id) {
      remove.mutate(undefined, {
        onError: (problem) => {
          setError(serverError(problem));
        },
      });
    } else {
      on_pending?.(null);
    }
  }

  const can_remove = shown !== undefined && kind !== 'video';
  return (
    <div className={styles.coverField}>
      <div
        role="button"
        tabIndex={0}
        aria-label={t(`library.cover.area_label_${kind}`)}
        aria-disabled={busy ? 'true' : undefined}
        className={[
          styles.coverDrop,
          wide ? styles.landscape : styles.portrait,
          over ? styles.over : '',
        ]
          .filter(Boolean)
          .join(' ')}
        data-has-image={shown ? 'true' : 'false'}
        onDragOver={(event) => {
          event.preventDefault();
          setOver(true);
        }}
        onClick={openChooser}
        onKeyDown={onKeyDown}
        onDragLeave={() => {
          setOver(false);
        }}
        onDrop={onDrop}
      >
        {shown ? (
          <img
            src={shown}
            alt={t(kind === 'video' ? 'library.cover.alt_thumbnail' : 'library.cover.alt', {
              title,
            })}
            className={styles.coverImage}
          />
        ) : (
          <span>{t('library.cover.drop_hint')}</span>
        )}
      </div>
      <input
        ref={input}
        id={input_id}
        type="file"
        accept={COVER_TYPES.join(',')}
        aria-label={label}
        className={styles.srOnly}
        tabIndex={-1}
        onChange={(event) => {
          choose(event.target.files?.[0]);
          event.target.value = '';
        }}
      />
      {progress !== null ? (
        <div className={styles.uploadProgress}>
          <ProgressBar label={t('library.cover.uploading')} value={progress} />
          <span>{t('library.upload.percent', { percent: progress })}</span>
        </div>
      ) : null}
      {shown ? (
        <div className={styles.coverTools}>
          <Button
            type="button"
            loading={upload.isPending}
            onClick={() => {
              input.current?.click();
            }}
          >
            {t('library.cover.replace')}
          </Button>
          {can_remove ? (
            <Button type="button" variant="muted" loading={remove.isPending} onClick={dropFile}>
              {t('library.cover.remove')}
            </Button>
          ) : null}
        </div>
      ) : null}
      {hint ? <p className={styles.muted}>{hint}</p> : null}
      {error ? (
        <p role="alert" className={styles.fieldError}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
