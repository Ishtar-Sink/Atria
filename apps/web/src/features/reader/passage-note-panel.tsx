import { Button } from '@atria/ui';
import { useId, useState, type KeyboardEvent } from 'react';
import { registerMessages, useT } from '../../shared/i18n/i18n';
import { pushToast } from '../../shared/toast/toast-store';
import messages from './i18n/pt-br.json';
import styles from './reader.module.css';
import { usePassageNote } from './use-passage-note';
import type { ReaderItemType } from './use-pdf-document';

registerMessages('reader', messages);

export interface PassageNotePanelProps {
  item_type: ReaderItemType;
  item_id: string;
  page: number;
  /** Trecho selecionado; sem ele a nota guarda só a página (CB-20). */
  quote: string | undefined;
  onClose: () => void;
}

/** Painel lateral da nota de trecho, dentro do leitor e sem modal (RF-68). */
export function PassageNotePanel({
  item_type,
  item_id,
  page,
  quote,
  onClose,
}: PassageNotePanelProps) {
  const t = useT();
  const base = useId();
  const [comment, setComment] = useState('');
  const create = usePassageNote(item_type, item_id);

  function save() {
    create.mutate(
      { page, quote, comment },
      {
        onSuccess: () => {
          pushToast({ tone: 'success', message_key: 'reader.note_saved', params: { page } });
          onClose();
        },
      },
    );
  }

  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onClose();
    }
  }

  const has_quote = quote !== undefined && quote.trim() !== '';

  return (
    <aside aria-labelledby={`${base}-title`} className={styles.panel}>
      <div role="presentation" className={styles.contents} onKeyDown={onKeyDown}>
        <h2 id={`${base}-title`} className={styles.panelTitle}>
          {t('reader.note_title')}
        </h2>
        {has_quote ? (
          <blockquote className={styles.quote} aria-label={t('reader.note_quote')}>
            {quote}
          </blockquote>
        ) : (
          <p className={styles.muted}>{t('reader.note_page_only', { page })}</p>
        )}
        <label className={styles.label}>
          {has_quote ? t('reader.note_comment_optional') : t('reader.note_comment')}
          <textarea
            className={styles.textarea}
            value={comment}
            maxLength={5000}
            // eslint-disable-next-line jsx-a11y/no-autofocus -- o painel abre por ação da pessoa
            autoFocus
            onChange={(event) => {
              setComment(event.target.value);
            }}
          />
        </label>
        {create.isError ? (
          <p role="alert" className={styles.error}>
            {t('reader.note_error')}
          </p>
        ) : null}
        <div className={styles.actions}>
          <Button variant="ghost" onClick={onClose}>
            {t('reader.note_cancel')}
          </Button>
          <Button variant="primary" loading={create.isPending} onClick={save}>
            {t('reader.note_save')}
          </Button>
        </div>
      </div>
    </aside>
  );
}
