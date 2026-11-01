import { Button, Dialog, TextField } from '@atria/ui';
import { useId, useState, type SyntheticEvent } from 'react';
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
 * ser corrigidas. O diálogo usa o `Dialog` genérico porque o `ConfirmDialog` não comporta campo.
 */
export function SessionOfferDialog({
  offer,
  is_pending,
  has_error,
  onConfirm,
  onSkip,
}: SessionOfferDialogProps) {
  const t = useT();
  const form_id = useId();
  const [pages, setPages] = useState(String(offer.suggested_pages));
  const [invalid, setInvalid] = useState(false);

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

  return (
    <Dialog
      open
      title={t('reader.session_offer_title')}
      onClose={onSkip}
      actions={
        <>
          <Button variant="ghost" onClick={onSkip} disabled={is_pending}>
            {t('reader.session_offer_skip')}
          </Button>
          <Button type="submit" form={form_id} variant="primary" loading={is_pending}>
            {t('reader.session_offer_confirm')}
          </Button>
        </>
      }
    >
      <form id={form_id} onSubmit={submit} noValidate>
        <p className={styles.dialogText}>
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
      </form>
    </Dialog>
  );
}
