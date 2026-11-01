import { LoadingState } from '@atria/ui';
import { useNavigate, useParams } from '@tanstack/react-router';
import { useCallback, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useTheme } from '../../app/theme/theme-provider';
import { registerMessages, useT } from '../../shared/i18n/i18n';
import { pushToast } from '../../shared/toast/toast-store';
import messages from './i18n/pt-br.json';
import { PassageNotePanel } from './passage-note-panel';
import { PdfViewer, type TextSelection } from './pdf-viewer';
import { ReaderToolbar } from './reader-toolbar';
import styles from './reader.module.css';
import { SelectionToolbar } from './selection-toolbar';
import { SessionOfferDialog } from './session-offer-dialog';
import { useCreateHighlight, useHighlights, type HighlightColor } from './use-highlights';
import { usePdfDocument, type PdfStatus, type ReaderItemType } from './use-pdf-document';
import { useReadingPosition } from './use-reading-position';
import { useReadingSessionOffer, type SessionOffer } from './use-reading-session-offer';

registerMessages('reader', messages);

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 3;
const ZOOM_STEP = 0.25;
// 100% é a largura de leitura (cerca de 960 px), não a largura toda do palco (inferência G).
const READING_WIDTH = 960;

const ERROR_KEYS: Partial<Record<PdfStatus, string>> = {
  corrupted: 'reader.error_corrupted',
  protected: 'reader.error_protected',
  no_file: 'reader.error_no_file',
  error: 'reader.error_generic',
};

function clampZoom(value: number): number {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(value * 100) / 100));
}

function isTyping(target: EventTarget): boolean {
  return (
    target instanceof HTMLElement &&
    (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')
  );
}

interface NoteTarget {
  page: number;
  quote: string | undefined;
}

export interface ReaderPageProps {
  item_type: ReaderItemType;
  item_id: string;
}

/** Tela do leitor, sem sidebar nem topbar (RF-65). */
export function ReaderPage({ item_type, item_id }: ReaderPageProps) {
  const t = useT();
  const navigate = useNavigate();
  const app_theme = useTheme();
  const document_state = usePdfDocument(item_type, item_id);
  const position = useReadingPosition(item_type, item_id);
  const session = useReadingSessionOffer(item_type, item_id, position.initial_page);
  const highlights = useHighlights(item_type, item_id);
  const create_highlight = useCreateHighlight(item_type, item_id);

  const [theme, setTheme] = useState<'light' | 'dark'>(app_theme.theme);
  const [zoom, setZoom] = useState(1);
  const [page, setPage] = useState<number>();
  const [goto, setGoto] = useState<{ page: number; nonce: number }>();
  const [selection, setSelection] = useState<TextSelection>();
  const [note, setNote] = useState<NoteTarget>();
  const [offer, setOffer] = useState<SessionOffer>();
  const closing_page = useRef(1);

  const { doc, status } = document_state;
  const ready = status === 'ready' && doc !== undefined && position.initial_page !== undefined;

  // Retomada: abre na última página lida, limitada ao total do PDF (RF-66).
  const resume = ready ? Math.min(position.initial_page ?? 1, doc.page_count) : 1;
  const resume_goto = useMemo(
    () => (resume > 1 ? { page: resume, nonce: 0 } : undefined),
    [resume],
  );
  const current_page = page ?? resume;

  const goToPage = useCallback(
    (target: number) => {
      if (!doc) return;
      const clamped = Math.min(doc.page_count, Math.max(1, Math.round(target)));
      setPage(clamped);
      setGoto((previous) => ({ page: clamped, nonce: (previous?.nonce ?? 0) + 1 }));
      position.save_page(clamped);
    },
    [doc, position],
  );

  const onScrollPage = useCallback(
    (target: number) => {
      setPage(target);
      position.save_page(target);
    },
    [position],
  );

  const changeZoom = useCallback((value: number) => {
    setZoom(clampZoom(value));
  }, []);

  function leave(message_key: string, params: Record<string, number>) {
    pushToast({ tone: 'success', message_key, params });
    void navigate({ to: itemPath(item_type, item_id) });
  }

  // Fechar: a página de saída é sempre guardada, confirmando a sessão ou não (DEC-004).
  async function close() {
    const closing = current_page;
    closing_page.current = closing;
    await position.save_closing(closing);
    const proposed = session.offer_for(closing);
    if (proposed) {
      setOffer(proposed);
      return;
    }
    leave('reader.page_saved', { page: closing });
  }

  function confirmSession(pages_read: number) {
    if (!offer) return;
    session.register({ offer, pages_read }).then(
      () => {
        setOffer(undefined);
        pushToast({
          tone: 'success',
          message_key: 'reader.session_registered',
          params: { pages: pages_read },
        });
        void navigate({ to: itemPath(item_type, item_id), search: { tab: 'reading' } });
      },
      () => undefined,
    );
  }

  function skipSession() {
    setOffer(undefined);
    session.reset();
    leave('reader.session_skipped', { page: closing_page.current });
  }

  function highlight(color: HighlightColor) {
    if (!selection || document_state.file_id === undefined || selection.rects.length === 0) return;
    create_highlight.mutate({
      color,
      file_id: document_state.file_id,
      page: selection.page,
      text: selection.text,
      rects: selection.rects,
    });
    document.getSelection()?.removeAllRanges();
    setSelection(undefined);
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.defaultPrevented || isTyping(event.target) || event.ctrlKey || event.metaKey) return;
    switch (event.key) {
      case 'Escape':
        void close();
        break;
      case 'ArrowLeft':
      case 'PageUp':
        if (!ready) return;
        goToPage(current_page - 1);
        break;
      case 'ArrowRight':
      case 'PageDown':
        if (!ready) return;
        goToPage(current_page + 1);
        break;
      case '+':
      case '=':
        changeZoom(zoom + ZOOM_STEP);
        break;
      case '-':
        changeZoom(zoom - ZOOM_STEP);
        break;
      default:
        return;
    }
    event.preventDefault();
  }

  const error_key = ERROR_KEYS[status];

  return (
    <main aria-label={t('reader.region')}>
      <div className={styles.root} data-theme={theme} role="presentation" onKeyDown={onKeyDown}>
        <ReaderToolbar
          title={document_state.title}
          page={current_page}
          page_count={doc?.page_count}
          zoom={zoom}
          theme={theme}
          file_id={document_state.file_id}
          can_navigate={ready}
          onClose={() => {
            void close();
          }}
          onPage={goToPage}
          onZoom={changeZoom}
          onToggleTheme={() => {
            setTheme((previous) => (previous === 'dark' ? 'light' : 'dark'));
          }}
          onNote={() => {
            setNote({ page: current_page, quote: undefined });
          }}
        />
        <div className={styles.body}>
          {error_key ? (
            <div className={styles.status} role="alert">
              <p>{t(error_key)}</p>
            </div>
          ) : ready ? (
            <PdfViewer
              doc={doc}
              zoom={zoom}
              reading_width={READING_WIDTH}
              goto={goto ?? resume_goto}
              highlights={highlights.data?.items ?? []}
              onPageChange={onScrollPage}
              onSelection={setSelection}
            />
          ) : (
            <div className={styles.status}>
              <LoadingState label={t('reader.loading')} />
            </div>
          )}
          {selection && ready && !note ? (
            <SelectionToolbar
              can_highlight={selection.rects.length > 0}
              onNote={() => {
                setNote({ page: selection.page, quote: selection.text });
              }}
              onHighlight={highlight}
            />
          ) : null}
          {note ? (
            <PassageNotePanel
              key={`${String(note.page)}-${note.quote ?? ''}`}
              item_type={item_type}
              item_id={item_id}
              page={note.page}
              quote={note.quote}
              onClose={() => {
                setNote(undefined);
              }}
            />
          ) : null}
        </div>
        {offer ? (
          <SessionOfferDialog
            offer={offer}
            is_pending={session.is_pending}
            has_error={session.has_error}
            onConfirm={confirmSession}
            onSkip={skipSession}
          />
        ) : null}
      </div>
    </main>
  );
}

function itemPath(item_type: ReaderItemType, item_id: string): string {
  return `/library/${item_type === 'book' ? 'books' : 'articles'}/${encodeURIComponent(item_id)}`;
}

function useRouteId(name: 'bookId' | 'articleId'): string {
  return useParams({
    strict: false,
    select: (params: Record<string, unknown>) =>
      typeof params[name] === 'string' ? params[name] : '',
  });
}

/** Componente da rota `/library/books/$bookId/read`. */
export function BookReaderPage() {
  return <ReaderPage item_type="book" item_id={useRouteId('bookId')} />;
}

/** Componente da rota `/library/articles/$articleId/read`. */
export function ArticleReaderPage() {
  return <ReaderPage item_type="article" item_id={useRouteId('articleId')} />;
}
