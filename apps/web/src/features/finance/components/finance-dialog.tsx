import { Button } from '@atria/ui';
import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import styles from './finance.module.css';

export interface FinanceDialogProps {
  open: boolean;
  title: string;
  children: ReactNode;
  cancel_label: string;
  onCancel: () => void;
  /** Ações à direita do "Cancelar"; a última é a principal. */
  actions: ReactNode;
}

const FOCUSABLE = 'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

/**
 * Diálogo de confirmação com conteúdo (a categoria de destino, a conta com movimentações).
 * Continua sendo só confirmação ([project/architecture-10]); o foco volta a quem o abriu.
 */
export function FinanceDialog({
  open,
  title,
  children,
  cancel_label,
  onCancel,
  actions,
}: FinanceDialogProps) {
  const base = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !open) return;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.showModal();
    cancelRef.current?.focus();
    return () => {
      dialog.close();
      trigger?.focus();
    };
  }, [open]);

  function onKeyDown(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      onCancel();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(FOCUSABLE));
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

  if (!open) return null;

  return (
    <dialog
      ref={dialogRef}
      role="alertdialog"
      aria-labelledby={`${base}-title`}
      aria-describedby={`${base}-body`}
      className={styles.dialog}
      onKeyDown={onKeyDown}
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
    >
      <h2 id={`${base}-title`} className={styles.dialogTitle}>
        {title}
      </h2>
      <div id={`${base}-body`} className={styles.dialogBody}>
        {children}
      </div>
      <div className={styles.dialogActions}>
        <Button ref={cancelRef} variant="ghost" onClick={onCancel}>
          {cancel_label}
        </Button>
        {actions}
      </div>
    </dialog>
  );
}
