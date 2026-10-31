import { zodResolver } from '@hookform/resolvers/zod';
import { ErrorState, FormGrid, LoadingState } from '@atria/ui';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { ApiProblem } from '../../shared/api/problem';
import { FormSegmented, FormSelect } from '../../shared/forms/form-fields';
import { useT } from '../../shared/i18n/i18n';
import { usePreferences, type CreateLayout } from '../../shared/preferences/preferences-context';
import { currencyOptions, availableLocales, timeZoneOptions } from './settings-options';
import { ShortcutRecorder } from './shortcut-recorder';
import styles from './settings.module.css';
import {
  DEFAULT_PREFERENCES,
  notifySaved,
  useApplyTheme,
  useUpdatePreferences,
  useUserPreferences,
  type PreferencesChange,
} from './use-user-preferences';

const schema = z.object({
  theme: z.enum(['system', 'light', 'dark']),
  locale: z.string().min(1, 'settings.error_validation'),
  timezone: z.string().min(1, 'settings.error_validation'),
  currency: z.string().length(3, 'settings.error_validation'),
  create_layout: z.enum(['grid', 'list']),
});

type FormValues = z.infer<typeof schema>;

const SERVER_FIELDS = ['theme', 'locale', 'timezone', 'currency'] as const;

function isServerField(name: string): name is (typeof SERVER_FIELDS)[number] {
  return (SERVER_FIELDS as readonly string[]).includes(name);
}

/** Preferências da pessoa: cada mudança vale na hora e é gravada com desfazer se o servidor recusar. */
export function UserPreferencesPage() {
  const t = useT();
  const { locale, create_layout, set_create_layout } = usePreferences();
  const query = useUserPreferences();
  const update = useUpdatePreferences();
  const data = query.data;
  const applyTheme = useApplyTheme(data?.theme);

  const values = useMemo<FormValues>(
    () => ({
      theme: (data?.theme ?? DEFAULT_PREFERENCES.theme) as FormValues['theme'],
      locale: data?.locale ?? DEFAULT_PREFERENCES.locale,
      timezone: data?.timezone ?? DEFAULT_PREFERENCES.timezone,
      currency: data?.currency ?? DEFAULT_PREFERENCES.currency,
      create_layout,
    }),
    [data, create_layout],
  );
  const form = useForm<FormValues>({ resolver: zodResolver(schema), values });
  const { control, watch, reset } = form;
  const latest = useRef(values);
  latest.current = values;
  // Recusa do servidor: o formulário volta ao valor que está no cache, mesmo que ele não tenha mudado.
  const rollBack = useCallback(() => {
    reset(latest.current);
  }, [reset]);

  const save = update.mutate;
  useEffect(() => {
    // eslint-disable-next-line react-hooks/incompatible-library -- a assinatura é criada e desfeita neste efeito
    const subscription = watch((current, { name, type }) => {
      if (type !== 'change' || name === undefined) return;
      if (name === 'create_layout') {
        // A escolha fica no navegador, na preferência da base; não vai para o servidor (PD-10).
        const layout = current.create_layout;
        if (layout === 'grid' || layout === 'list')
          set_create_layout(layout satisfies CreateLayout);
        return;
      }
      if (!isServerField(name)) return;
      const value = current[name];
      if (value === undefined) return;
      const change: PreferencesChange = { [name]: value };
      if (name === 'theme') applyTheme(value);
      save(change, { onSuccess: notifySaved, onError: rollBack });
    });
    return () => {
      subscription.unsubscribe();
    };
  }, [watch, save, set_create_layout, applyTheme, rollBack]);

  const zones = useMemo(() => timeZoneOptions(data?.timezone), [data?.timezone]);
  const currencies = useMemo(
    () => currencyOptions(locale, data?.currency),
    [locale, data?.currency],
  );

  if (query.isPending) return <LoadingState label={t('settings.loading')} rows={4} />;
  if (query.isError) {
    return (
      <ErrorState
        title={t('settings.error')}
        retryLabel={t('common.retry')}
        onRetry={() => {
          void query.refetch();
        }}
      />
    );
  }

  const invalid = update.error instanceof ApiProblem && update.error.code === 'validation_failed';

  return (
    <form
      aria-label={t('settings.section_preferences')}
      onSubmit={(event) => {
        event.preventDefault();
      }}
    >
      <FormGrid>
        <div data-span="full">
          <FormSegmented
            control={control}
            name="theme"
            label={t('settings.theme')}
            options={[
              { value: 'system', label: t('settings.theme_system') },
              { value: 'light', label: t('settings.theme_light') },
              { value: 'dark', label: t('settings.theme_dark') },
            ]}
          />
        </div>
        <FormSelect
          control={control}
          name="locale"
          label={t('settings.language')}
          options={availableLocales()}
        />
        <FormSelect
          control={control}
          name="timezone"
          label={t('settings.timezone')}
          options={zones}
        />
        <FormSelect
          control={control}
          name="currency"
          label={t('settings.currency')}
          options={currencies}
        />
        <div data-span="full">
          <FormSegmented
            control={control}
            name="create_layout"
            label={t('settings.create_layout')}
            options={[
              { value: 'grid', label: t('settings.create_layout_grid') },
              { value: 'list', label: t('settings.create_layout_list') },
            ]}
          />
        </div>
        <ShortcutRecorder
          value={query.data.palette_shortcut}
          onChange={(shortcut) => {
            save({ palette_shortcut: shortcut }, { onSuccess: notifySaved });
          }}
        />
        {invalid ? (
          <p role="alert" className={styles.error} data-span="full">
            {t('settings.error_validation')}
          </p>
        ) : null}
      </FormGrid>
    </form>
  );
}
