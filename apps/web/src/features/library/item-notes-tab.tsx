import { Button, EmptyState, ErrorState, LoadingState, TextField } from '@atria/ui';
import { useId, useState } from 'react';
import { registerMessages, useT } from '../../shared/i18n/i18n';
import messages from './i18n/pt-br.json';
import { useCreateItemNote, useItemNotes } from './use-item-notes';
import type { LibraryKind } from './use-library-items';
import styles from './library.module.css';

registerMessages('library', messages);

/** Histórico de notas do livro, do artigo ou do vídeo, com a caixa para escrever uma nova. */
export function ItemNotesTab({ kind, item_id }: { kind: LibraryKind; item_id: string }) {
  const t = useT();
  const quote_id = useId();
  const comment_id = useId();
  const query = useItemNotes(kind, item_id);
  const create = useCreateItemNote(kind, item_id);
  const [quote, setQuote] = useState('');
  const [comment, setComment] = useState('');
  const [page, setPage] = useState('');
  const [error, setError] = useState<string>();
  const [page_error, setPageError] = useState<string>();

  function submit() {
    const clean_quote = quote.trim();
    const clean_comment = comment.trim();
    const clean_page = page.trim();
    if (clean_quote === '' && clean_comment === '') {
      setError(t('library.notes.add_error'));
      return;
    }
    if (clean_page !== '' && !/^[1-9]\d{0,8}$/.test(clean_page)) {
      setPageError(t('library.notes.page_invalid'));
      return;
    }
    setError(undefined);
    setPageError(undefined);
    create.mutate({
      ...(clean_quote ? { quote: clean_quote } : {}),
      ...(clean_comment ? { comment: clean_comment } : {}),
      ...(clean_page ? { page: Number(clean_page) } : {}),
    });
    setQuote('');
    setComment('');
    setPage('');
  }

  let list;
  if (query.isPending) {
    list = <LoadingState label={t('library.notes.loading')} />;
  } else if (query.isError) {
    list = (
      <ErrorState
        title={t('library.notes.error_title')}
        retryLabel={t('library.form.retry')}
        onRetry={() => {
          void query.refetch();
        }}
      />
    );
  } else if (query.data.length === 0) {
    list = (
      <EmptyState
        title={t('library.notes.empty_title')}
        description={t('library.notes.empty_text')}
      />
    );
  } else {
    list = (
      <ul aria-label={t('library.notes.list_label')} className={styles.list}>
        {query.data.map((note) => (
          <li key={note.id} className={styles.noteRow}>
            {note.quote ? <blockquote className={styles.quote}>{note.quote}</blockquote> : null}
            {note.comment ? <p className={styles.longText}>{note.comment}</p> : null}
            {note.page ? (
              <span className={styles.sub}>{t('library.notes.page_ref', { page: note.page })}</span>
            ) : null}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className={styles.stack}>
      <form
        noValidate
        className={styles.noteForm}
        aria-label={t('library.notes.add_title')}
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <div className={styles.textareaRoot}>
          <label htmlFor={quote_id} className={styles.fieldLabel}>
            {t('library.notes.quote')}
          </label>
          <textarea
            id={quote_id}
            className={styles.textarea}
            value={quote}
            onChange={(event) => {
              setQuote(event.target.value);
            }}
          />
        </div>
        <div className={styles.textareaRoot}>
          <label htmlFor={comment_id} className={styles.fieldLabel}>
            {t('library.notes.comment')}
          </label>
          <textarea
            id={comment_id}
            className={styles.textarea}
            value={comment}
            onChange={(event) => {
              setComment(event.target.value);
            }}
          />
        </div>
        <TextField
          className={styles.pageField}
          label={t('library.notes.page')}
          inputMode="numeric"
          autoComplete="off"
          value={page}
          onChange={(event) => {
            setPage(event.target.value);
          }}
          {...(page_error ? { error: page_error } : {})}
        />
        {error ? (
          <p role="alert" className={styles.fieldError}>
            {error}
          </p>
        ) : null}
        <div>
          <Button type="submit" variant="primary">
            {t('library.notes.add')}
          </Button>
        </div>
      </form>
      {list}
    </div>
  );
}
