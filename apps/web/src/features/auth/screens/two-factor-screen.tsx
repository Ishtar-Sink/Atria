import { zodResolver } from '@hookform/resolvers/zod';
import { Button, FormActions, TextField } from '@atria/ui';
import { useNavigate } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useT } from '../../../shared/i18n/i18n';
import { AuthCard } from '../components/auth-card';
import { AuthForm } from '../components/auth-form';
import styles from '../components/auth-form.module.css';
import { QrCode } from '../components/qr-code';
import { authErrorKey, useActivateTotp, useStartTotp } from '../hooks/use-auth-mutations';
import { useFieldError } from '../hooks/use-field-error';
import { twoFactorSchema, type TwoFactorValues } from '../schemas';

/** Ativação do 2FA: QR code e segredo em texto, e a confirmação com o primeiro código (RF-07). */
export function TwoFactorScreen() {
  const t = useT();
  const fieldError = useFieldError();
  const navigate = useNavigate();
  const start = useStartTotp();
  const activate = useActivateTotp();
  const started = useRef(false);
  const [copied, setCopied] = useState(false);
  const { register, handleSubmit, formState } = useForm<TwoFactorValues>({
    resolver: zodResolver(twoFactorSchema),
    defaultValues: { code: '' },
  });

  const { mutate: startEnrollment } = start;
  useEffect(() => {
    // Cada abertura gera um segredo novo no servidor; a guarda evita gerar dois.
    if (started.current) return;
    started.current = true;
    startEnrollment();
  }, [startEnrollment]);

  const submit = handleSubmit(async ({ code }) => {
    try {
      await activate.mutateAsync(code.trim());
      await navigate({ to: '/' });
    } catch {
      // O erro fica em `activate.error`; a pessoa segue nesta tela até ativar.
    }
  });

  async function copySecret(secret: string) {
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  const enrollment = start.data;
  const error = activate.isError ? activate.error : start.error;
  return (
    <AuthCard heading={t('auth.two_factor.title')} subtitle={t('auth.two_factor.subtitle')}>
      <AuthForm
        label={t('auth.two_factor.title')}
        onSubmit={(event) => {
          void submit(event);
        }}
        error={error ? t(authErrorKey(error)) : undefined}
        actions={
          <FormActions
            cancel_label={t('auth.two_factor.cancel')}
            submit_label={
              activate.isPending ? t('auth.two_factor.submitting') : t('auth.two_factor.submit')
            }
            loading={activate.isPending}
            submit_disabled={enrollment === undefined}
            onCancel={() => {
              void navigate({ to: '/sign-in' });
            }}
          />
        }
      >
        {enrollment ? (
          <>
            <QrCode value={enrollment.otpauth_uri} label={t('auth.two_factor.qr_label')} />
            <div>
              <p className={styles.live}>{t('auth.two_factor.secret_label')}</p>
              <p className={styles.secret}>{enrollment.secret}</p>
            </div>
            <Button
              onClick={() => {
                void copySecret(enrollment.secret);
              }}
              aria-label={t('auth.two_factor.copy_secret')}
            >
              {t('auth.two_factor.copy_secret')}
            </Button>
            <p aria-live="polite" className={styles.live}>
              {copied ? t('auth.two_factor.secret_copied') : ''}
            </p>
          </>
        ) : (
          <p role="status" className={styles.live}>
            {t('auth.two_factor.loading')}
          </p>
        )}
        <TextField
          label={t('auth.totp_code')}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          error={fieldError(formState.errors.code)}
          {...register('code')}
        />
      </AuthForm>
    </AuthCard>
  );
}
