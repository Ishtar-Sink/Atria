import { zodResolver } from '@hookform/resolvers/zod';
import { FormActions, TextField } from '@atria/ui';
import { Link, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useT } from '../../../shared/i18n/i18n';
import authForm from '../components/auth-form.module.css';
import { AuthCard } from '../components/auth-card';
import { AuthForm } from '../components/auth-form';
import { authErrorKey, useSignIn } from '../hooks/use-auth-mutations';
import { useFieldError } from '../hooks/use-field-error';
import { signInSchema, totpCodeSchema, type SignInValues } from '../schemas';

/** Login com e-mail e senha; quando a conta tem 2FA, o código aparece no mesmo formulário (RF-06). */
export function SignInScreen() {
  const t = useT();
  const fieldError = useFieldError();
  const navigate = useNavigate();
  const sign_in = useSignIn();
  const [needs_code, setNeedsCode] = useState(false);
  const { register, handleSubmit, setFocus, setError, formState } = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '', totp_code: '' },
  });

  useEffect(() => {
    if (needs_code) setFocus('totp_code');
  }, [needs_code, setFocus]);

  const submit = handleSubmit(async ({ email, password, totp_code }) => {
    if (needs_code && !totpCodeSchema.safeParse(totp_code).success) {
      setError('totp_code', { message: 'auth.errors.totp_code_invalid' });
      return;
    }
    const code = needs_code ? { totp_code: totp_code?.trim() ?? '' } : {};
    try {
      const result = await sign_in.mutateAsync({ email, password, ...code });
      if (result.status === 'totp_required') {
        setNeedsCode(true);
        return;
      }
      await navigate({ to: result.me.account_complete ? '/' : '/two-factor' });
    } catch {
      // O erro fica em `sign_in.error` e aparece no formulário.
    }
  });

  return (
    <AuthCard
      heading={t('auth.sign_in.title')}
      subtitle={needs_code ? t('auth.sign_in.totp_subtitle') : t('auth.sign_in.subtitle')}
    >
      <AuthForm
        label={t('auth.sign_in.title')}
        onSubmit={(event) => {
          void submit(event);
        }}
        error={sign_in.isError ? t(authErrorKey(sign_in.error)) : undefined}
        actions={
          <FormActions
            cancel_label={t('auth.sign_in.sign_up')}
            submit_label={
              sign_in.isPending ? t('auth.sign_in.submitting') : t('auth.sign_in.submit')
            }
            loading={sign_in.isPending}
            onCancel={() => {
              void navigate({ to: '/sign-up' });
            }}
          />
        }
      >
        <TextField
          label={t('auth.email')}
          type="email"
          autoComplete="username"
          error={fieldError(formState.errors.email)}
          {...register('email')}
        />
        <TextField
          label={t('auth.password')}
          type="password"
          autoComplete="current-password"
          error={fieldError(formState.errors.password)}
          {...register('password')}
        />
        {needs_code ? (
          <TextField
            label={t('auth.totp_code')}
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            error={fieldError(formState.errors.totp_code)}
            {...register('totp_code')}
          />
        ) : null}
        <p className={authForm.links}>
          <Link to="/forgot-password" className={authForm.link}>
            {t('auth.sign_in.forgot_password')}
          </Link>
        </p>
      </AuthForm>
    </AuthCard>
  );
}
