import { Button, ConfirmDialog, EmptyState, ErrorState, LoadingState, TextField } from '@atria/ui';
import { useEffect, useId, useRef, useState } from 'react';
import { registerMessages, useT } from '../../shared/i18n/i18n';
import messages from './i18n/pt-br.json';
import {
  useCreateItemNote,
  useDeleteItemNote,
  useItemNotes,
  useUpdateItemNote,
  validateNote,
  type ItemNote,
} from './use-item-notes';
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
  const update = useUpdateItemNote(kind, item_id);
  const remove = useDeleteItemNote(kind, item_id);
  const [editing_id, setEditingId] = useState<string>();
  const [removing, setRemoving] = useState<ItemNote>();
  const edit_buttons = useRef(new Map<string, HTMLButtonElement>());
  const return_focus = useRef<string | null>(null);
  const [quote, setQuote] = useState('');
  const [comment, setComment] = useState('');
  const [page, setPage] = useState('');
  const [error, setError] = useState<string>();
  const [page_error, setPageError] = useState<string>();

  function submit() {
    const result = validateNote({ quote, comment, page });
    if (result.error === 'library.notes.add_error') {
      setError(t(result.error));
      return;
    }
    if (result.error) {
      setPageError(t(result.error));
      return;
    }
    setError(undefined);
    setPageError(undefined);
    create.mutate({
      ...(result.body?.quote ? { quote: result.body.quote } : {}),
      ...(result.body?.comment ? { comment: result.body.comment } : {}),
      ...(result.body?.page ? { page: result.body.page } : {}),
    });
    setQuote('');
    setComment('');
    setPage('');
  }

  useEffect(() => {
    if (editing_id === undefined && return_focus.current !== null) {
      edit_buttons.current.get(return_focus.current)?.focus();
      return_focus.current = null;
    }
  }, [editing_id]);

  function closeEdit(note_id: string) {
    return_focus.current = note_id;
    setEditingId(undefined);
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
            {editing_id === note.id ? (
              <NoteEditForm
                note={note}
                onCancel={() => {
                  closeEdit(note.id);
                }}
                onSave={(body) => {
                  update.mutate({ note_id: note.id, patch: body });
                  closeEdit(note.id);
                }}
              />
            ) : (
              <>
                {note.quote ? <blockquote className={styles.quote}>{note.quote}</blockquote> : null}
                {note.comment ? <p className={styles.longText}>{note.comment}</p> : null}
                {note.page ? (
                  <span className={styles.sub}>
                    {t('library.notes.page_ref', { page: note.page })}
                  </span>
                ) : null}
                <div className={styles.sessionActions}>
                  <button
                    type="button"
                    className={styles.linkButton}
                    disabled={note.id.startsWith('pending-')}
                    aria-label={t('library.notes.edit_label', { excerpt: excerptOf(note) })}
                    ref={(node) => {
                      if (node) edit_buttons.current.set(note.id, node);
                      else edit_buttons.current.delete(note.id);
                    }}
                    onClick={() => {
                      setEditingId(note.id);
                    }}
                  >
                    {t('library.notes.edit')}
                  </button>
                  <button
                    type="button"
                    className={styles.linkButton}
                    disabled={note.id.startsWith('pending-')}
                    aria-label={t('library.notes.delete_label', { excerpt: excerptOf(note) })}
                    onClick={() => {
                      setRemoving(note);
                    }}
                  >
                    {t('library.notes.delete')}
                  </button>
                </div>
              </>
            )}
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
      <ConfirmDialog
        open={removing !== undefined}
        title={t('library.notes.delete_title')}
        description={t('library.notes.delete_text')}
        confirmLabel={t('library.notes.delete_confirm')}
        cancelLabel={t('library.notes.delete_cancel')}
        onCancel={() => {
          setRemoving(undefined);
        }}
        onConfirm={() => {
          if (removing) remove.mutate({ note_id: removing.id });
          setRemoving(undefined);
        }}
      />
    </div>
  );
}

const EXCERPT_MAX = 40;

/** Início do trecho ou do comentário, para dizer a qual nota o botão se refere. */
function excerptOf(note: ItemNote): string {
  const text = (note.quote ?? note.comment ?? '').trim();
  return text.length > EXCERPT_MAX ? `${text.slice(0, EXCERPT_MAX).trimEnd()}…` : text;
}

interface NoteEditFormProps {
  note: ItemNote;
  onSave: (body: { quote: string | null; comment: string | null; page: number | null }) => void;
  onCancel: () => void;
}

/** Edição da nota no próprio histórico; `Escape` cancela. */
function NoteEditForm({ note, onSave, onCancel }: NoteEditFormProps) {
  const t = useT();
  const quote_id = useId();
  const comment_id = useId();
  const form = useRef<HTMLFormElement>(null);
  const first = useRef<HTMLTextAreaElement>(null);
  const [quote, setQuote] = useState(note.quote ?? '');
  const [comment, setComment] = useState(note.comment ?? '');
  const [page, setPage] = useState(note.page ? String(note.page) : '');
  const [error, setError] = useState<string>();
  const [page_error, setPageError] = useState<string>();

  useEffect(() => {
    first.current?.focus();
    const node = form.current;
    if (!node) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onCancel();
      }
    };
    node.addEventListener('keydown', onKeyDown);
    return () => {
      node.removeEventListener('keydown', onKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- registrado uma vez, ao abrir a edição
  }, []);

  function submit() {
    const result = validateNote({ quote, comment, page });
    setError(result.error === 'library.notes.add_error' ? t(result.error) : undefined);
    setPageError(result.error === 'library.notes.page_invalid' ? t(result.error) : undefined);
    if (result.body) onSave(result.body);
  }

  return (
    <form
      ref={form}
      noValidate
      className={styles.noteForm}
      aria-label={t('library.notes.edit_title')}
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
          ref={first}
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
      <div className={styles.sessionActions}>
        <Button type="submit" variant="primary">
          {t('library.notes.save')}
        </Button>
        <Button type="button" onClick={onCancel}>
          {t('library.notes.cancel')}
        </Button>
      </div>
    </form>
  );
}
