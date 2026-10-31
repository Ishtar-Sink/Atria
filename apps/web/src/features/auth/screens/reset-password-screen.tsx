import { zodResolver } from '@hookform/resolvers/zod';
import { FormActions, TextField } from '@atria/ui';
import { Link, useNavigate, useParams } from '@tanstack/react-router';
import { useForm } from 'react-hook-form';
import { useT } from '../../../shared/i18n/i18n';
import { pushToast } from '../../../shared/toast/toast-store';
import { AuthCard } from '../components/auth-card';
import { AuthForm } from '../components/auth-form';
import styles from '../components/auth-form.module.css';
import { authErrorKey, isProblem, useResetPassword } from '../hooks/use-auth-mutations';
import { useFieldError } from '../hooks/use-field-error';
import { resetPasswordSchema, type ResetPasswordValues } from '../schemas';

/** Nova senha pelo token do link, vindo do e-mail ou do admin; o token vale uma vez (RF-08, RF-09). */
export function ResetPasswordScreen() {
  const t = useT();
  const fieldError = useFieldError();
  const navigate = useNavigate();
  const params: { token?: unknown } = useParams({ strict: false });
  const token = typeof params.token === 'string' ? params.token : '';
  const reset = useResetPassword();
  const { register, handleSubmit, formState } = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: '', confirmation: '' },
  });

  const submit = handleSubmit(async ({ password }) => {
    try {
      await reset.mutateAsync({ token, password });
    } catch {
      return;
    }
    pushToast({ tone: 'success', message_key: 'auth.reset_password.done_notice' });
    await navigate({ to: '/sign-in' });
  });

  return (
    <AuthCard heading={t('auth.reset_password.title')} subtitle={t('auth.reset_password.subtitle')}>
      <AuthForm
        label={t('auth.reset_password.title')}
        onSubmit={(event) => {
          void submit(event);
        }}
        error={reset.isError ? t(authErrorKey(reset.error)) : undefined}
        actions={
          <FormActions
            cancel_label={t('auth.reset_password.cancel')}
            submit_label={
              reset.isPending
                ? t('auth.reset_password.submitting')
                : t('auth.reset_password.submit')
            }
            loading={reset.isPending}
            onCancel={() => {
              void navigate({ to: '/sign-in' });
            }}
          />
        }
      >
        <TextField
          label={t('auth.password')}
          type="password"
          autoComplete="new-password"
          help={t('auth.password_help')}
          error={fieldError(formState.errors.password)}
          {...register('password')}
        />
        <TextField
          label={t('auth.confirmation')}
          type="password"
          autoComplete="new-password"
          error={fieldError(formState.errors.confirmation)}
          {...register('confirmation')}
        />
        {isProblem(reset.error, 'reset_token_invalid') ? (
          <p className={styles.links}>
            <Link to="/forgot-password" className={styles.link}>
              {t('auth.reset_password.ask_another')}
            </Link>
          </p>
        ) : null}
      </AuthForm>
    </AuthCard>
  );
}
