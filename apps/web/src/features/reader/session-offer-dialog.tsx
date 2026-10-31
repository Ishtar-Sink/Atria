import { Button, TextField } from '@atria/ui';
import { useEffect, useId, useRef, useState, type SyntheticEvent, type KeyboardEvent } from 'react';
import { registerMessages, useT } from '../../shared/i18n/i18n';
import messages from './i18n/pt-br.json';
import styles from './reader.module.css';
import { parsePagesRead, type SessionOffer } from './use-reading-session-offer';

registerMessages('reader', messages);

export interface SessionOfferDialogProps {
  offer: SessionOffer;
  is_pending: boolean;
  has_error: boolean;
  onConfirm: (pages_read: number) => void;
  onSkip: () => void;
}

/**
 * Confirmação do registro da sessão (PD-60): as páginas avançadas já vêm preenchidas e podem
 * ser corrigidas. O diálogo é de `<dialog>` próprio porque o `ConfirmDialog` não comporta campo.
 */
export function SessionOfferDialog({
  offer,
  is_pending,
  has_error,
  onConfirm,
  onSkip,
}: SessionOfferDialogProps) {
  const t = useT();
  const base = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const [pages, setPages] = useState(String(offer.suggested_pages));
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    el.showModal();
    return () => {
      el.close();
    };
  }, []);

  function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = parsePagesRead(pages);
    if (value === undefined) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    onConfirm(value);
  }

  function onKeyDown(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onSkip();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>('input, button:not(:disabled)'),
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <dialog
      ref={dialog}
      aria-labelledby={`${base}-title`}
      aria-describedby={`${base}-text`}
      className={styles.dialog}
      onKeyDown={onKeyDown}
      onCancel={(event) => {
        event.preventDefault();
        onSkip();
      }}
    >
      <form onSubmit={submit} noValidate>
        <h2 id={`${base}-title`} className={styles.dialogTitle}>
          {t('reader.session_offer_title')}
        </h2>
        <p id={`${base}-text`} className={styles.dialogText}>
          {t('reader.session_offer_text', { from: offer.from_page, to: offer.to_page })}
        </p>
        <TextField
          label={t('reader.session_offer_pages')}
          type="number"
          inputMode="numeric"
          min={1}
          step={1}
          value={pages}
          // eslint-disable-next-line jsx-a11y/no-autofocus -- o diálogo abre por ação da pessoa
          autoFocus
          onChange={(event) => {
            setPages(event.target.value);
            setInvalid(false);
          }}
          {...(invalid ? { error: t('reader.session_offer_pages_invalid') } : {})}
        />
        {has_error ? (
          <p role="alert" className={styles.error}>
            {t('reader.session_offer_error')}
          </p>
        ) : null}
        <div className={styles.actions}>
          <Button variant="ghost" onClick={onSkip} disabled={is_pending}>
            {t('reader.session_offer_skip')}
          </Button>
          <Button type="submit" variant="primary" loading={is_pending}>
            {t('reader.session_offer_confirm')}
          </Button>
        </div>
      </form>
    </dialog>
  );
}
