import { ErrorState, FormGrid, LoadingState } from '@atria/ui';
import { useState } from 'react';
import { useT } from '../../shared/i18n/i18n';
import styles from './settings.module.css';
import { notifySaved, useUpdatePreferences, useUserPreferences } from './use-user-preferences';

export const SEARCH_CONTEXTS = [
  'finance',
  'goals',
  'tasks',
  'reminders',
  'notes',
  'journal',
  'library',
  'projects',
] as const;

/** Contextos em que a busca procura por padrão: ao menos um (RF-59). */
export function SearchContextsPage() {
  const t = useT();
  const query = useUserPreferences();
  const update = useUpdatePreferences();
  const [required, setRequired] = useState(false);

  if (query.isPending) return <LoadingState label={t('settings.loading')} rows={3} />;
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
  const selected = query.data.search_contexts;

  function toggle(context: string) {
    const active = selected.includes(context);
    if (active && selected.length === 1) {
      setRequired(true);
      return;
    }
    setRequired(false);
    const next = active
      ? selected.filter((item) => item !== context)
      : SEARCH_CONTEXTS.filter((item) => item === context || selected.includes(item));
    update.mutate({ search_contexts: next }, { onSuccess: notifySaved });
  }

  return (
    <form
      aria-label={t('settings.section_search')}
      onSubmit={(event) => {
        event.preventDefault();
      }}
    >
      <FormGrid>
        <fieldset className={styles.group} data-span="full">
          <legend className={styles.legend}>{t('settings.search_contexts')}</legend>
          <p className={styles.hint}>{t('settings.search_contexts_hint')}</p>
          <div className={styles.toggles}>
            {SEARCH_CONTEXTS.map((context) => (
              <button
                key={context}
                type="button"
                className={styles.toggle}
                aria-pressed={selected.includes(context)}
                onClick={() => {
                  toggle(context);
                }}
              >
                {t(`settings.context_${context}`)}
              </button>
            ))}
          </div>
          {required ? (
            <p role="alert" className={styles.error}>
              {t('settings.search_contexts_required')}
            </p>
          ) : null}
        </fieldset>
      </FormGrid>
    </form>
  );
}
