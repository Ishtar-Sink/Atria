import { zodResolver } from '@hookform/resolvers/zod';
import { Button, FormActions, TextField } from '@atria/ui';
import { Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useT } from '../../../shared/i18n/i18n';
import { AuthCard } from '../components/auth-card';
import { AuthForm } from '../components/auth-form';
import styles from '../components/auth-form.module.css';
import { authErrorKey, useForgotPassword } from '../hooks/use-auth-mutations';
import { useFieldError } from '../hooks/use-field-error';
import { forgotPasswordSchema, type ForgotPasswordValues } from '../schemas';

/** Pedido do link por e-mail; a resposta é sempre a mesma, exista a conta ou não (RF-08, CB-11). */
export function ForgotPasswordScreen() {
  const t = useT();
  const fieldError = useFieldError();
  const navigate = useNavigate();
  const forgot = useForgotPassword();
  const [sent, setSent] = useState(false);
  const { register, handleSubmit, formState } = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  const submit = handleSubmit(async ({ email }) => {
    try {
      await forgot.mutateAsync(email);
      setSent(true);
    } catch {
      // O erro fica em `forgot.error` e aparece no formulário.
    }
  });

  const back = (
    <Link to="/sign-in" className={styles.link}>
      {t('auth.back_to_sign_in')}
    </Link>
  );

  return (
    <AuthCard
      heading={t('auth.forgot_password.title')}
      subtitle={t('auth.forgot_password.subtitle')}
      back={back}
    >
      {sent ? (
        <>
          <p role="status" className={styles.notice}>
            {t('auth.forgot_password.neutral')}
          </p>
          <Button
            onClick={() => {
              void navigate({ to: '/sign-in' });
            }}
          >
            {t('auth.back_to_sign_in')}
          </Button>
        </>
      ) : (
        <AuthForm
          label={t('auth.forgot_password.title')}
          onSubmit={(event) => {
            void submit(event);
          }}
          error={forgot.isError ? t(authErrorKey(forgot.error)) : undefined}
          actions={
            <FormActions
              cancel_label={t('auth.back_to_sign_in')}
              submit_label={
                forgot.isPending
                  ? t('auth.forgot_password.submitting')
                  : t('auth.forgot_password.submit')
              }
              loading={forgot.isPending}
              onCancel={() => {
                void navigate({ to: '/sign-in' });
              }}
            />
          }
        >
          <TextField
            label={t('auth.email')}
            type="email"
            autoComplete="email"
            error={fieldError(formState.errors.email)}
            {...register('email')}
          />
        </AuthForm>
      )}
    </AuthCard>
  );
}
