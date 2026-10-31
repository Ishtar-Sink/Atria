import { Button } from '@atria/ui';
import { useState, type KeyboardEvent } from 'react';
import { registerMessages, useT } from '../../shared/i18n/i18n';
import messages from './i18n/pt-br.json';
import styles from './reader.module.css';
import { fileUrl } from './use-pdf-document';

registerMessages('reader', messages);

export interface ReaderToolbarProps {
  title: string;
  page: number;
  page_count: number | undefined;
  zoom: number;
  theme: 'light' | 'dark';
  file_id: string | undefined;
  can_navigate: boolean;
  onClose: () => void;
  onPage: (page: number) => void;
  onZoom: (zoom: number) => void;
  onToggleTheme: () => void;
  onNote: () => void;
}

/** Fechar, zoom, navegação por página, tema, nota da página e baixar (RF-65, RF-70). */
export function ReaderToolbar({
  title,
  page,
  page_count,
  zoom,
  theme,
  file_id,
  can_navigate,
  onClose,
  onPage,
  onZoom,
  onToggleTheme,
  onNote,
}: ReaderToolbarProps) {
  const t = useT();
  const [edited, setEdited] = useState<string>();
  const draft = edited ?? String(page);
  const percent = Math.round(zoom * 100);

  function commit() {
    const value = Number(draft);
    if (
      Number.isInteger(value) &&
      value >= 1 &&
      (page_count === undefined || value <= page_count)
    ) {
      onPage(value);
    }
    setEdited(undefined);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault();
      commit();
    }
  }

  return (
    <div role="toolbar" aria-label={t('reader.toolbar_label')} className={styles.bar}>
      <Button variant="ghost" onClick={onClose}>
        {`← ${t('reader.close')}`}
      </Button>
      <p className={styles.title}>{title === '' ? t('reader.title_fallback') : title}</p>
      {can_navigate ? (
        <>
          <div className={styles.group}>
            <Button
              aria-label={t('reader.previous_page')}
              disabled={page <= 1}
              onClick={() => {
                onPage(page - 1);
              }}
            >
              ‹
            </Button>
            <input
              className={styles.pageInput}
              type="text"
              inputMode="numeric"
              aria-label={t('reader.page_label')}
              value={draft}
              onChange={(event) => {
                setEdited(event.target.value);
              }}
              onBlur={commit}
              onKeyDown={onKeyDown}
            />
            {page_count === undefined ? null : (
              <span className={styles.muted}>{t('reader.page_of', { total: page_count })}</span>
            )}
            <Button
              aria-label={t('reader.next_page')}
              disabled={page_count !== undefined && page >= page_count}
              onClick={() => {
                onPage(page + 1);
              }}
            >
              ›
            </Button>
          </div>
          <div className={styles.group}>
            <Button
              aria-label={t('reader.zoom_out')}
              onClick={() => {
                onZoom(zoom - 0.25);
              }}
            >
              −
            </Button>
            <Button
              aria-label={t('reader.zoom_reset_label', { percent })}
              onClick={() => {
                onZoom(1);
              }}
            >
              {t('reader.zoom_reset', { percent })}
            </Button>
            <Button
              aria-label={t('reader.zoom_in')}
              onClick={() => {
                onZoom(zoom + 0.25);
              }}
            >
              +
            </Button>
          </div>
          <Button onClick={onNote}>{t('reader.create_page_note')}</Button>
        </>
      ) : null}
      <Button onClick={onToggleTheme}>
        {theme === 'dark' ? t('reader.theme_light') : t('reader.theme_dark')}
      </Button>
      {file_id === undefined ? null : (
        <a className={styles.link} href={fileUrl(file_id)} download>
          {t('reader.download')}
        </a>
      )}
    </div>
  );
}
