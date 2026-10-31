import { ErrorState, LoadingState, Tabs } from '@atria/ui';
import { useParams } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { z } from 'zod';
import { registerMessages, useT } from '../../shared/i18n/i18n';
import { StickyPageHeader } from '../../shared/layout/sticky-page-header';
import { BackLink } from '../../shared/navigation/back-link';
import { useListSearch } from '../../shared/url-state/use-list-search';
import messages from './i18n/pt-br.json';
import { ItemNotesTab } from './item-notes-tab';
import {
  ItemHeaderActions,
  LibraryOverview,
  SafeLink,
  type OverviewFact,
} from './library-overview';
import { useVideo } from './use-library-items';
import { useDeleteItem } from './use-library-mutations';

registerMessages('library', messages);

const tabSearchSchema = z.object({ tab: z.string().default('overview') });

/** Tela do vídeo: visão geral em cartões (miniatura, canal, status e endereço) e notas (PD-37, PD-59). */
export function VideoPage() {
  const t = useT();
  const video_id =
    useParams({
      strict: false,
      select: (params: Record<string, unknown>) =>
        typeof params.videoId === 'string' ? params.videoId : undefined,
    }) ?? '';
  const video = useVideo(video_id);
  const remove = useDeleteItem('video');
  const { search, setSearch } = useListSearch(tabSearchSchema);

  if (video.isPending) return <LoadingState label={t('library.video.loading')} />;
  if (video.isError) {
    return (
      <ErrorState
        title={t('library.video.error_title')}
        retryLabel={t('library.form.retry')}
        onRetry={() => {
          void video.refetch();
        }}
      />
    );
  }
  const data = video.data;
  const title = data.title || data.url;
  const facts: OverviewFact[] = [
    {
      label: t('library.overview.channel'),
      value: data.channel || t('library.video.channel_empty'),
    },
    {
      label: t('library.overview.status'),
      value: t(`library.video.status.${data.watch_status}`),
    },
    { label: t('library.overview.url'), value: <SafeLink href={data.url} /> },
  ];

  const tabs: { id: string; label: string; panel: ReactNode }[] = [
    {
      id: 'overview',
      label: t('library.video.tab_overview'),
      panel: (
        <LibraryOverview
          kind="video"
          id={data.id}
          title={title}
          cover_file_id={data.thumbnail_file_id}
          facts={facts}
          tags={data.tags}
          visibility={data.visibility}
          created_at={data.created_at}
          updated_at={data.updated_at}
        />
      ),
    },
    {
      id: 'notes',
      label: t('library.video.tab_notes'),
      panel: <ItemNotesTab kind="video" item_id={data.id} />,
    },
  ];
  const current = tabs.some((tab) => tab.id === search.tab) ? search.tab : 'overview';

  return (
    <div>
      <StickyPageHeader
        back={<BackLink module="library" fallback_to="/library" />}
        eyebrow={t('library.video.eyebrow')}
        title={title}
        {...(data.channel ? { subtitle: data.channel } : {})}
        actions={
          <ItemHeaderActions
            kind="video"
            id={data.id}
            on_delete={() => {
              remove.mutate({ id: data.id });
            }}
            delete_title={t('library.video.delete_title')}
            delete_text={t('library.video.delete_text')}
            delete_confirm={t('library.video.delete_confirm')}
            delete_cancel={t('library.video.delete_cancel')}
          />
        }
      />
      <Tabs
        label={t('library.video.tabs')}
        tabs={tabs}
        value={current}
        onChange={(tab) => {
          setSearch({ tab });
        }}
      />
    </div>
  );
}
