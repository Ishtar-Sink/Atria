import { Button, Dialog } from '@atria/ui';
import { useEffect, useRef, type ReactNode } from 'react';
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
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) cancelRef.current?.focus();
  }, [open]);

  return (
    <Dialog
      open={open}
      title={title}
      onClose={onCancel}
      role="alertdialog"
      actions={
        <>
          <Button ref={cancelRef} variant="ghost" onClick={onCancel}>
            {cancel_label}
          </Button>
          {actions}
        </>
      }
    >
      <div className={styles.dialogBody}>{children}</div>
    </Dialog>
  );
}
