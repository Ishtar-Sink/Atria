import { Button, ProgressBar } from '@atria/ui';
import { useId, useRef, useState } from 'react';
import { registerMessages, useT } from '../../shared/i18n/i18n';
import messages from './i18n/pt-br.json';
import { fileUrl } from './library-item-cover';
import { PDF_MAX_BYTES, useUploadProgress } from './use-library-mutations';
import styles from './library.module.css';

registerMessages('library', messages);

export interface PdfAttachmentFieldProps {
  /** PDF já gravado no servidor, baixado só por `/api/v1/files/{id}` ([project/security-10]). */
  pdf_file_id?: string | null | undefined;
  /** Arquivo escolhido que espera o formulário salvar. */
  pending: File | null;
  on_pending: (file: File | null) => void;
}

/** Anexo de PDF opcional, com tipo e tamanho checados antes de enviar. */
export function PdfAttachmentField({ pdf_file_id, pending, on_pending }: PdfAttachmentFieldProps) {
  const t = useT();
  const input_id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string>();
  const progress = useUploadProgress('pdf');

  function choose(file: File | undefined) {
    if (!file) return;
    if (file.type !== 'application/pdf') {
      setError(t('library.pdf.invalid_type'));
      return;
    }
    if (file.size > PDF_MAX_BYTES) {
      setError(t('library.pdf.too_large'));
      return;
    }
    setError(undefined);
    on_pending(file);
  }

  const attached = pending !== null || Boolean(pdf_file_id);
  return (
    <div className={styles.pdfField}>
      <label htmlFor={input_id} className={styles.fieldLabel}>
        {t('library.pdf.label')}
      </label>
      <input
        ref={input}
        id={input_id}
        type="file"
        accept="application/pdf"
        className={styles.srOnly}
        onChange={(event) => {
          choose(event.target.files?.[0]);
          event.target.value = '';
        }}
      />
      <div className={styles.pdfRow}>
        {pending ? (
          <span className={styles.fileName}>{pending.name}</span>
        ) : pdf_file_id ? (
          <a href={fileUrl(pdf_file_id)} download className={styles.fileName}>
            {t('library.pdf.current')}
          </a>
        ) : null}
        <Button
          type="button"
          onClick={() => {
            input.current?.click();
          }}
        >
          {t(attached ? 'library.pdf.replace' : 'library.pdf.attach')}
        </Button>
        {pending ? (
          <Button
            type="button"
            variant="muted"
            onClick={() => {
              setError(undefined);
              on_pending(null);
            }}
          >
            {t('library.pdf.remove')}
          </Button>
        ) : null}
      </div>
      {progress !== null ? (
        <div className={styles.uploadProgress}>
          <ProgressBar label={t('library.pdf.uploading')} value={progress} />
          <span>{t('library.upload.percent', { percent: progress })}</span>
        </div>
      ) : null}
      {error ? (
        <p role="alert" className={styles.fieldError}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
