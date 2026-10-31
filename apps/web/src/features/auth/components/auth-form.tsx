import type { SubmitEventHandler, ReactNode } from 'react';
import styles from './auth-form.module.css';

export interface AuthFormProps {
  label: string;
  onSubmit: SubmitEventHandler<HTMLFormElement>;
  /** Erro do servidor, já traduzido, mostrado no próprio formulário. */
  error?: string | undefined;
  /** O `FormActions`, sempre por último. */
  actions: ReactNode;
  children: ReactNode;
}

/** Formulário de uma coluna dos cartões de entrada: campos, erro do servidor e ações embaixo. */
export function AuthForm({ label, onSubmit, error, actions, children }: AuthFormProps) {
  return (
    <form aria-label={label} noValidate onSubmit={onSubmit} className={styles.form}>
      {children}
      {error ? (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      ) : null}
      {actions}
    </form>
  );
}
