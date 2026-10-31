import { EmptyState } from '@atria/ui';
import { useT } from '../../shared/i18n/i18n';
import { StickyPageHeader } from '../../shared/layout/sticky-page-header';

export function NotFoundPage() {
  const t = useT();
  return (
    <>
      <StickyPageHeader
        eyebrow={t('common.not_found_eyebrow')}
        title={t('common.not_found_title')}
      />
      <EmptyState
        title={t('common.not_found_title')}
        description={t('common.not_found_description')}
      />
    </>
  );
}
