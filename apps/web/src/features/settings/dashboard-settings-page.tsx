import { Checkbox, ErrorState, FormGrid, LoadingState } from '@atria/ui';
import { useT } from '../../shared/i18n/i18n';
import { useCurrentUser } from '../../shared/session/current-user';
import { DASHBOARD_BLOCK_OPTIONS, useDashboardBlocks } from './use-dashboard-blocks';
import styles from './settings.module.css';

/** Blocos visíveis do dashboard: a mudança vale na hora, sem botão de salvar (PD-15, PD-30). */
export function DashboardSettingsPage() {
  const t = useT();
  const user = useCurrentUser();
  const blocks = useDashboardBlocks(user.data?.id);
  // Os blocos ocultos são guardados por pessoa: antes de saber quem é, a tela mostraria tudo
  // visível e uma mudança feita nesse meio-tempo não seria gravada.
  if (user.isPending) return <LoadingState label={t('settings.loading')} rows={3} />;
  if (user.isError) {
    return (
      <ErrorState
        title={t('settings.error')}
        retryLabel={t('common.retry')}
        onRetry={() => {
          void user.refetch();
        }}
      />
    );
  }
  return (
    <form
      aria-label={t('settings.section_dashboard')}
      onSubmit={(event) => {
        event.preventDefault();
      }}
    >
      <FormGrid>
        <fieldset className={styles.group} data-span="full">
          <legend className={styles.legend}>{t('settings.dashboard_blocks')}</legend>
          <p className={styles.hint}>{t('settings.dashboard_blocks_hint')}</p>
          <div className={styles.checks}>
            {DASHBOARD_BLOCK_OPTIONS.map((option) => (
              <Checkbox
                key={option.id}
                label={t(option.label_key)}
                checked={blocks.isVisible(option.id)}
                onChange={(event) => {
                  blocks.setVisible(option.id, event.target.checked);
                }}
              />
            ))}
          </div>
        </fieldset>
      </FormGrid>
    </form>
  );
}
