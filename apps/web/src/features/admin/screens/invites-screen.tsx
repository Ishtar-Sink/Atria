import { Button, Card, Checkbox, ErrorState, LoadingState } from '@atria/ui';
import { useRouter } from '@tanstack/react-router';
import { useT } from '../../../shared/i18n/i18n';
import { StickyPageHeader } from '../../../shared/layout/sticky-page-header';
import { useInviteRequired } from '../hooks/use-invites';
import { useMe } from '../hooks/use-users';
import { canChangeInstance } from '../permissions';
import { AdminSections } from './admin-sections';
import styles from './info-screens.module.css';

export function InvitesScreen() {
  const t = useT();
  const router = useRouter();
  const me = useMe();
  const can_change = canChangeInstance(me.data);
  const { query, mutation } = useInviteRequired(can_change);

  function setting() {
    if (!can_change) return null;
    if (query.isPending) return <LoadingState label={t('admin.invites.loading')} rows={2} />;
    if (query.isError) {
      return (
        <ErrorState
          title={t('admin.invites.error_title')}
          description={t('admin.invites.error_description')}
          retryLabel={t('common.retry')}
          onRetry={() => {
            void query.refetch();
          }}
        />
      );
    }
    return (
      <Card as="section" aria-label={t('admin.invites.required_group')}>
        <div className={styles.switchBox}>
          <Checkbox
            role="switch"
            label={t('admin.invites.required_label')}
            checked={query.data.invite_required}
            onChange={(event) => {
              mutation.mutate(event.target.checked);
            }}
          />
          <p className={styles.help}>{t('admin.invites.required_help')}</p>
        </div>
      </Card>
    );
  }

  return (
    <>
      <StickyPageHeader
        eyebrow={t('admin.nav.title')}
        title={t('admin.invites.title')}
        subtitle={t('admin.invites.subtitle')}
      />
      <AdminSections />
      <Card as="section" className={styles.explain} aria-labelledby="invites-how">
        <h2 id="invites-how" className={styles.explainTitle}>
          {t('admin.invites.how_title')}
        </h2>
        <p className={styles.explainText}>{t('admin.invites.how_description')}</p>
        <div className={styles.row}>
          <Button
            variant="primary"
            onClick={() => {
              router.history.push('/admin/invites/new');
            }}
          >
            {t('admin.invites.generate')}
          </Button>
        </div>
      </Card>
      {setting()}
    </>
  );
}
