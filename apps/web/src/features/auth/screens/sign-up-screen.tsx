import { zodResolver } from '@hookform/resolvers/zod';
import { FormActions, TextField } from '@atria/ui';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { useForm } from 'react-hook-form';
import { useT } from '../../../shared/i18n/i18n';
import { AuthCard } from '../components/auth-card';
import { AuthForm } from '../components/auth-form';
import { authErrorKey, useSignUp } from '../hooks/use-auth-mutations';
import { useFieldError } from '../hooks/use-field-error';
import { signUpSchema, type SignUpValues } from '../schemas';

/** Cadastro: o convite vem de `?invite=` na URL e é opcional quando a instância não o exige (RF-04). */
export function SignUpScreen() {
  const t = useT();
  const fieldError = useFieldError();
  const navigate = useNavigate();
  const search: { invite?: unknown } = useSearch({ strict: false });
  const invite =
    typeof search.invite === 'string' && search.invite !== '' ? search.invite : undefined;
  const sign_up = useSignUp();
  const { register, handleSubmit, formState } = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { email: '', password: '', confirmation: '' },
  });

  const submit = handleSubmit(async ({ email, password }) => {
    try {
      const me = await sign_up.mutateAsync({
        email,
        password,
        ...(invite === undefined ? {} : { invite_token: invite }),
      });
      await navigate({ to: me.account_complete ? '/' : '/two-factor' });
    } catch {
      // O erro fica em `sign_up.error`; os campos continuam preenchidos.
    }
  });

  return (
    <AuthCard heading={t('auth.sign_up.title')} subtitle={t('auth.sign_up.subtitle')}>
      <AuthForm
        label={t('auth.sign_up.title')}
        onSubmit={(event) => {
          void submit(event);
        }}
        error={sign_up.isError ? t(authErrorKey(sign_up.error)) : undefined}
        actions={
          <FormActions
            cancel_label={t('auth.sign_up.sign_in')}
            submit_label={
              sign_up.isPending ? t('auth.sign_up.submitting') : t('auth.sign_up.submit')
            }
            loading={sign_up.isPending}
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
