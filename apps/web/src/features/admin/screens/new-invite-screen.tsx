import { Button, FormActions, FormGrid, TextField } from '@atria/ui';
import { useRouter } from '@tanstack/react-router';
import { useState, type SyntheticEvent } from 'react';
import { useT } from '../../../shared/i18n/i18n';
import { formatDateTime } from '../../../shared/format/intl';
import { FormScreen } from '../../../shared/layout/form-screen';
import { StickyPageHeader } from '../../../shared/layout/sticky-page-header';
import { usePreferences } from '../../../shared/preferences/preferences-context';
import { useCreateInvite, type Invite } from '../hooks/use-invites';
import styles from './info-screens.module.css';

type CopyState = 'idle' | 'copied' | 'failed';

export function NewInviteScreen() {
  const t = useT();
  const router = useRouter();
  const { locale, time_zone } = usePreferences();
  const create = useCreateInvite();
  const [invite, setInvite] = useState<Invite | undefined>(undefined);
  const [copy, setCopy] = useState<CopyState>('idle');

  function onSubmit(event: SyntheticEvent) {
    event.preventDefault();
    setCopy('idle');
    create.mutate(undefined, {
      onSuccess: (created) => {
        setInvite(created);
      },
    });
  }

  async function copyLink() {
    if (!invite) return;
    try {
      await navigator.clipboard.writeText(invite.link);
      setCopy('copied');
    } catch {
      setCopy('failed');
    }
  }

  return (
    <FormScreen>
      <StickyPageHeader
        eyebrow={t('admin.nav.title')}
        title={t('admin.new_invite.title')}
        subtitle={t('admin.new_invite.subtitle')}
      />
      <form onSubmit={onSubmit} aria-label={t('admin.new_invite.title')}>
        <FormGrid>
          <div data-span="full" className={styles.copyRow}>
            <TextField
              label={t('admin.new_invite.link_label')}
              help={t('admin.new_invite.link_help')}
              placeholder={t('admin.new_invite.link_placeholder')}
              readOnly
              value={invite?.link ?? ''}
              {...(create.isError ? { error: t('admin.new_invite.error') } : {})}
            />
            {invite ? (
              <>
                <p className={styles.expires}>
                  {t('admin.new_invite.expires', {
                    date: formatDateTime(invite.expires_at, locale, time_zone),
                  })}
                </p>
                <div className={styles.row}>
                  <Button
                    onClick={() => {
                      void copyLink();
                    }}
                  >
                    {t('admin.new_invite.copy')}
                  </Button>
                </div>
              </>
            ) : null}
            <p aria-live="polite" className={styles.polite}>
              {copy === 'copied' ? t('admin.new_invite.copied') : null}
              {copy === 'failed' ? t('admin.new_invite.copy_failed') : null}
            </p>
          </div>
          <FormActions
            cancel_label={t('admin.new_invite.cancel')}
            submit_label={t('admin.new_invite.generate')}
            loading={create.isPending}
            onCancel={() => {
              router.history.push('/admin/invites');
            }}
          />
        </FormGrid>
      </form>
    </FormScreen>
  );
}
