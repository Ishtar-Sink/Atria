import { zodResolver } from '@hookform/resolvers/zod';
import { FormActions, TextField } from '@atria/ui';
import { useNavigate } from '@tanstack/react-router';
import { useForm } from 'react-hook-form';
import { useT } from '../../../shared/i18n/i18n';
import { pushToast } from '../../../shared/toast/toast-store';
import { AuthCard } from '../components/auth-card';
import { AuthForm } from '../components/auth-form';
import { useFieldError } from '../hooks/use-field-error';
import { authErrorKey, isProblem, useSetup } from '../hooks/use-auth-mutations';
import { setupSchema, type SetupValues } from '../schemas';

/** Assistente de primeira execução: cria a conta de quem administra a instância (RF-03). */
export function SetupScreen() {
  const t = useT();
  const fieldError = useFieldError();
  const navigate = useNavigate();
  const setup = useSetup();
  const { register, handleSubmit, formState } = useForm<SetupValues>({
    resolver: zodResolver(setupSchema),
    defaultValues: { email: '', password: '', confirmation: '' },
  });

  const submit = handleSubmit(async ({ email, password }) => {
    try {
      await setup.mutateAsync({ email, password });
    } catch (error) {
      if (!isProblem(error, 'setup_already_done')) return;
      pushToast({ tone: 'info', message_key: 'auth.setup.already_done_notice' });
      await navigate({ to: '/sign-in' });
      return;
    }
    pushToast({ tone: 'info', message_key: 'auth.setup.two_factor_notice' });
    await navigate({ to: '/two-factor' });
  });

  return (
    <AuthCard heading={t('auth.setup.title')} subtitle={t('auth.setup.subtitle')}>
      <AuthForm
        label={t('auth.setup.title')}
        onSubmit={(event) => {
          void submit(event);
        }}
        error={setup.isError ? t(authErrorKey(setup.error)) : undefined}
        actions={
          <FormActions
            cancel_label={t('auth.setup.cancel')}
            submit_label={setup.isPending ? t('auth.setup.submitting') : t('auth.setup.submit')}
            loading={setup.isPending}
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
      </AuthForm>
    </AuthCard>
  );
}
