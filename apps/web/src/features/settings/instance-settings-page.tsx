import { zodResolver } from '@hookform/resolvers/zod';
import {
  Checkbox,
  EmptyState,
  ErrorState,
  FormActions,
  FormGrid,
  LoadingState,
  TextField,
} from '@atria/ui';
import { Link, useRouter } from '@tanstack/react-router';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { ApiProblem } from '../../shared/api/problem';
import { useT } from '../../shared/i18n/i18n';
import styles from './settings.module.css';
import {
  useInstanceSettings,
  useUpdateInstanceSettings,
  useViewerRole,
  type InstanceSettings,
} from './use-instance-settings';
import { notifySaved } from './use-user-preferences';

const ROLES = ['admin', 'elevated', 'user'] as const;

const schema = z.object({
  smtp_host: z.string().trim(),
  smtp_port: z
    .string()
    .trim()
    .refine(
      (value) =>
        value === '' || (/^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= 65535),
      {
        message: 'settings.smtp_port_invalid',
      },
    ),
  smtp_user: z.string().trim(),
  smtp_from: z.string().trim(),
});

type FormValues = z.infer<typeof schema>;

function toValues(settings: InstanceSettings | undefined): FormValues {
  return {
    smtp_host: settings?.smtp_host ?? '',
    smtp_port: settings?.smtp_port == null ? '' : String(settings.smtp_port),
    smtp_user: settings?.smtp_user ?? '',
    smtp_from: settings?.smtp_from ?? '',
  };
}

/** Configurações da instância: só o admin vê e altera (RF-60, RN-12). O servidor também recusa. */
export function InstanceSettingsPage() {
  const t = useT();
  const router = useRouter();
  const viewer = useViewerRole();
  const settings = useInstanceSettings(viewer.is_admin);
  const update = useUpdateInstanceSettings();
  const data = settings.data;

  const form = useForm<FormValues>({ resolver: zodResolver(schema), values: toValues(data) });
  const { register, handleSubmit, formState, reset } = form;
  useEffect(() => {
    reset(toValues(data));
  }, [data, reset]);

  if (viewer.isPending) return <LoadingState label={t('settings.loading')} rows={4} />;
  if (viewer.isError) {
    return (
      <ErrorState
        title={t('settings.error')}
        retryLabel={t('common.retry')}
        onRetry={() => {
          void viewer.refetch();
        }}
      />
    );
  }
  if (!viewer.is_admin) {
    return (
      <EmptyState title={t('settings.forbidden_title')} description={t('settings.forbidden')} />
    );
  }
  if (settings.isPending) return <LoadingState label={t('settings.loading')} rows={4} />;
  if (settings.isError) {
    return (
      <ErrorState
        title={t('settings.error')}
        retryLabel={t('common.retry')}
        onRetry={() => {
          void settings.refetch();
        }}
      />
    );
  }

  const current = settings.data;
  // Sem a chave VAPID o Web Push não pode ser ligado; já ligado, ele sempre pode ser desligado.
  const web_push_available = current.web_push_enabled || current.web_push_configured;
  const invalid = update.error instanceof ApiProblem && update.error.code === 'validation_failed';

  const onSubmit = handleSubmit((values) => {
    update.mutate(
      {
        smtp_host: values.smtp_host,
        smtp_port: values.smtp_port === '' ? null : Number(values.smtp_port),
        smtp_user: values.smtp_user,
        smtp_from: values.smtp_from,
      },
      { onSuccess: notifySaved },
    );
  });

  return (
    <div className={styles.stack}>
      <form
        aria-label={t('settings.section_instance')}
        className={styles.stack}
        onSubmit={(event) => void onSubmit(event)}
      >
        <FormGrid>
          <h2 className={styles.sectionTitle} data-span="full">
            {t('settings.section_instance')}
          </h2>
          <div data-span="full" className={styles.group}>
            <Checkbox
              label={t('settings.invite_required')}
              checked={current.invite_required}
              onChange={(event) => {
                update.mutate(
                  { invite_required: event.target.checked },
                  { onSuccess: notifySaved },
                );
              }}
            />
            <p className={styles.hint}>{t('settings.invite_required_help')}</p>
          </div>
          <div data-span="full" className={styles.group}>
            <Checkbox
              label={t('settings.web_push')}
              checked={current.web_push_enabled}
              disabled={!web_push_available}
              onChange={(event) => {
                update.mutate(
                  { web_push_enabled: event.target.checked },
                  { onSuccess: notifySaved },
                );
              }}
            />
            {web_push_available ? null : (
              <p className={styles.hint}>{t('settings.web_push_unavailable')}</p>
            )}
          </div>
        </FormGrid>
        <FormGrid>
          <h2 className={styles.sectionTitle} data-span="full">
            {t('settings.smtp')}
          </h2>
          <TextField
            label={t('settings.smtp_host')}
            autoComplete="off"
            {...register('smtp_host')}
          />
          <TextField
            label={t('settings.smtp_port')}
            inputMode="numeric"
            autoComplete="off"
            {...(formState.errors.smtp_port?.message
              ? { error: t(formState.errors.smtp_port.message) }
              : {})}
            {...register('smtp_port')}
          />
          <TextField
            label={t('settings.smtp_user')}
            autoComplete="off"
            {...register('smtp_user')}
          />
          <TextField
            label={t('settings.smtp_from')}
            autoComplete="off"
            {...register('smtp_from')}
          />
          <p className={styles.hint} data-span="full">
            {t('settings.smtp_password_hint')}
          </p>
          {invalid ? (
            <p role="alert" className={styles.error} data-span="full">
              {t('settings.error_validation')}
            </p>
          ) : null}
          <FormActions
            cancel_label={t('settings.cancel')}
            submit_label={t('settings.save')}
            loading={update.isPending}
            onCancel={() => {
              reset(toValues(current));
              router.history.back();
            }}
          />
        </FormGrid>
      </form>
      <section aria-labelledby="settings-roles">
        <FormGrid>
          <h2 id="settings-roles" className={styles.sectionTitle} data-span="full">
            {t('settings.roles')}
          </h2>
          <p className={styles.hint} data-span="full">
            {t('settings.roles_hint')}
          </p>
          <ul className={styles.roles} data-span="full">
            {ROLES.map((role) => (
              <li key={role} className={styles.role}>
                <span className={styles.roleName}>{t(`settings.role_${role}`)}</span>
                <span className={styles.roleDescription}>
                  {t(`settings.role_${role}_description`)}
                </span>
              </li>
            ))}
          </ul>
          <div data-span="full">
            <Link to="/admin/users" className={styles.link}>
              {t('settings.roles_manage')}
            </Link>
          </div>
        </FormGrid>
      </section>
    </div>
  );
}
