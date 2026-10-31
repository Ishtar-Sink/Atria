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
  type LibraryExtraTab,
  type OverviewFact,
} from './library-overview';
import { useArticle, type Article } from './use-library-items';
import { useDeleteItem } from './use-library-mutations';

registerMessages('library', messages);

export type ArticleExtraTab = LibraryExtraTab<Article>;

const tabSearchSchema = z.object({ tab: z.string().default('overview') });

export interface ArticlePageProps {
  /** Abas que outra feature acrescenta (Conexões e Destaques, montadas na TASK-35). */
  extra_tabs?: readonly ArticleExtraTab[];
}

/** Tela do artigo: visão geral em cartões e histórico de notas, sem barra de progresso (RN-22, PD-59). */
export function ArticlePage({ extra_tabs = [] }: ArticlePageProps) {
  const t = useT();
  const article_id =
    useParams({
      strict: false,
      select: (params: Record<string, unknown>) =>
        typeof params.articleId === 'string' ? params.articleId : undefined,
    }) ?? '';
  const article = useArticle(article_id);
  const remove = useDeleteItem('article');
  const { search, setSearch } = useListSearch(tabSearchSchema);

  if (article.isPending) return <LoadingState label={t('library.article.loading')} />;
  if (article.isError) {
    return (
      <ErrorState
        title={t('library.article.error_title')}
        retryLabel={t('library.form.retry')}
        onRetry={() => {
          void article.refetch();
        }}
      />
    );
  }
  const data = article.data;
  const dash = t('library.overview.none');
  const facts: OverviewFact[] = [
    {
      label: t('library.overview.status'),
      value: t(`library.article.status.${data.reading_status}`),
    },
    { label: t('library.overview.author'), value: data.author ?? dash },
    { label: t('library.overview.source'), value: data.source ?? dash },
    { label: t('library.overview.url'), value: data.url ? <SafeLink href={data.url} /> : dash },
  ];

  const tabs: { id: string; label: string; panel: ReactNode }[] = [
    {
      id: 'overview',
      label: t('library.article.tab_overview'),
      panel: (
        <LibraryOverview
          kind="article"
          id={data.id}
          title={data.title}
          cover_file_id={data.cover_file_id}
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
      label: t('library.article.tab_notes'),
      panel: <ItemNotesTab kind="article" item_id={data.id} />,
    },
    ...extra_tabs.map((tab) => ({ id: tab.id, label: tab.label, panel: tab.render(data) })),
  ];
  const current = tabs.some((tab) => tab.id === search.tab) ? search.tab : 'overview';

  return (
    <div>
      <StickyPageHeader
        back={<BackLink module="library" fallback_to="/library" />}
        eyebrow={t('library.article.eyebrow')}
        title={data.title}
        {...(data.author ? { subtitle: data.author } : {})}
        actions={
          <ItemHeaderActions
            kind="article"
            id={data.id}
            read_to={`/library/articles/${data.id}/read`}
            pdf_file_id={data.pdf_file_id}
            on_delete={() => {
              remove.mutate({ id: data.id });
            }}
            delete_title={t('library.article.delete_title')}
            delete_text={t('library.article.delete_text')}
            delete_confirm={t('library.article.delete_confirm')}
            delete_cancel={t('library.article.delete_cancel')}
          />
        }
      />
      <Tabs
        label={t('library.article.tabs')}
        tabs={tabs}
        value={current}
        onChange={(tab) => {
          setSearch({ tab });
        }}
      />
    </div>
  );
}
