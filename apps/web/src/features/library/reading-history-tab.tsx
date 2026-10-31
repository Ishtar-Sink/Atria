import { ConfirmDialog, EmptyState, ErrorState, LoadingState } from '@atria/ui';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { registerMessages, useT } from '../../shared/i18n/i18n';
import { usePreferences } from '../../shared/preferences/preferences-context';
import messages from './i18n/pt-br.json';
import { BookProgressBar } from './book-progress';
import { useReadingSessionList, type ReadingSession } from './use-book';
import { useBookProgress } from './use-book-progress';
import type { Book } from './use-library-items';
import { useDeleteReadingSession } from './use-reading-sessions';
import styles from './library.module.css';

registerMessages('library', messages);

/** Dia da leitura em `26/10/2026`: é uma data sem horário, então não muda com o fuso. */
export function formatSessionDate(read_on: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${read_on}T00:00:00Z`));
}

/**
 * Histórico de leitura (PD-40, PD-60): "Registrar sessão" em cima e a lista embaixo, da data mais
 * recente para a mais antiga, cada linha como "50 páginas · 26/10/2026".
 */
export function ReadingHistoryTab({ book }: { book: Book }) {
  const t = useT();
  const { locale } = usePreferences();
  const query = useReadingSessionList(book.id);
  const remove = useDeleteReadingSession(book.id);
  const [removing, setRemoving] = useState<ReadingSession>();
  const sessions = query.data ?? [];
  const progress = useBookProgress(book.page_count, sessions);

  let list;
  if (query.isPending) {
    list = <LoadingState label={t('library.session.loading')} />;
  } else if (query.isError) {
    list = (
      <ErrorState
        title={t('library.session.error_title')}
        retryLabel={t('library.form.retry')}
        onRetry={() => {
          void query.refetch();
        }}
      />
    );
  } else if (sessions.length === 0) {
    list = (
      <EmptyState
        title={t('library.session.empty_title')}
        description={t('library.session.empty_text')}
      />
    );
  } else {
    list = (
      <ul aria-label={t('library.session.history_label')} className={styles.list}>
        {sessions.map((session) => {
          const date = formatSessionDate(session.read_on, locale);
          return (
            <li key={session.id} className={styles.sessionRow}>
              <div className={styles.sessionMain}>
                <span className={styles.sessionLine}>
                  {t('library.session.history_item', { pages: session.pages_read, date })}
                </span>
                {session.observation ? (
                  <span className={styles.sub}>{session.observation}</span>
                ) : null}
              </div>
              <div className={styles.sessionActions}>
                <Link
                  to={`/library/books/${book.id}/sessions/${session.id}/edit`}
                  className={styles.linkButton}
                  aria-label={t('library.session.edit_label', { date })}
                >
                  {t('library.session.edit')}
                </Link>
                <button
                  type="button"
                  className={styles.linkButton}
                  aria-label={t('library.session.delete_label', { date })}
                  onClick={() => {
                    setRemoving(session);
                  }}
                >
                  {t('library.session.delete')}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <div className={styles.stack}>
      <div className={styles.historyHead}>
        <Link
          to={`/library/books/${book.id}/sessions/new`}
          className={[styles.linkButton, styles.linkPrimary].join(' ')}
        >
          {t('library.session.register')}
        </Link>
        {query.isSuccess && sessions.length > 0 ? (
          <p className={styles.muted} data-testid="session-summary">
            {t('library.session.summary', { pages: progress.pages_read, count: sessions.length })}
          </p>
        ) : null}
      </div>
      {query.isSuccess ? (
        <BookProgressBar
          label={t('library.book.progress_label')}
          percent={progress.percent}
          pages_read={progress.pages_read}
          page_count={book.page_count}
          detailed
        />
      ) : null}
      {list}
      <ConfirmDialog
        open={removing !== undefined}
        title={t('library.session.delete_title')}
        description={t('library.session.delete_text')}
        confirmLabel={t('library.session.delete_confirm')}
        cancelLabel={t('library.session.delete_cancel')}
        onCancel={() => {
          setRemoving(undefined);
        }}
        onConfirm={() => {
          if (removing) remove.mutate({ id: removing.id });
          setRemoving(undefined);
        }}
      />
    </div>
  );
}
