import { Button, FormActions, TextField } from '@atria/ui';
import { useNavigate, useParams } from '@tanstack/react-router';
import { useState, type SubmitEvent } from 'react';
import { useT } from '../../../shared/i18n/i18n';
import { AuthCard } from '../components/auth-card';
import { AuthForm } from '../components/auth-form';
import styles from '../components/auth-form.module.css';
import { authErrorKey, useAdminPasswordReset } from '../hooks/use-auth-mutations';

type CopyState = 'idle' | 'copied' | 'failed';

/** O admin gera o link de uso único de redefinição para uma pessoa e o copia (RF-09). */
export function AdminPasswordResetScreen() {
  const t = useT();
  const navigate = useNavigate();
  const params: { userId?: unknown } = useParams({ strict: false });
  const user_id = typeof params.userId === 'string' ? params.userId : '';
  const reset = useAdminPasswordReset();
  const [copy, setCopy] = useState<CopyState>('idle');

  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setCopy('idle');
    reset.mutate(user_id);
  }

  async function copyLink(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      setCopy('copied');
    } catch {
      setCopy('failed');
    }
  }

  const link = reset.data?.link;
  const notice =
    copy === 'copied'
      ? t('auth.admin_password_reset.copied')
      : copy === 'failed'
        ? t('auth.admin_password_reset.copy_failed')
        : '';
  return (
    <AuthCard
      inline
      heading={t('auth.admin_password_reset.title')}
      subtitle={t('auth.admin_password_reset.subtitle')}
    >
      <AuthForm
        label={t('auth.admin_password_reset.title')}
        onSubmit={submit}
        error={reset.isError ? t(authErrorKey(reset.error)) : undefined}
        actions={
          <FormActions
            cancel_label={t('auth.admin_password_reset.cancel')}
            submit_label={
              reset.isPending
                ? t('auth.admin_password_reset.submitting')
                : t('auth.admin_password_reset.submit')
            }
            loading={reset.isPending}
            onCancel={() => {
              void navigate({ to: '/admin/users' });
            }}
          />
        }
      >
        {link ? (
          <>
            <TextField
              label={t('auth.admin_password_reset.link_label')}
              help={t('auth.admin_password_reset.link_help')}
              readOnly
              value={link}
            />
            <Button
              onClick={() => {
                void copyLink(link);
              }}
            >
              {t('auth.admin_password_reset.copy')}
            </Button>
          </>
        ) : null}
        <p aria-live="polite" className={styles.live}>
          {notice}
        </p>
      </AuthForm>
    </AuthCard>
  );
}
