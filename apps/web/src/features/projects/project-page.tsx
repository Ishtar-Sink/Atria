import { ConfirmDialog, ErrorState, LoadingState, MenuButton, Tabs } from '@atria/ui';
import { Link, useNavigate, useParams } from '@tanstack/react-router';
import { useState, type ReactNode } from 'react';
import { z } from 'zod';
import { useT } from '../../shared/i18n/i18n';
import { StickyPageHeader } from '../../shared/layout/sticky-page-header';
import { BackLink } from '../../shared/navigation/back-link';
import { useListSearch } from '../../shared/url-state/use-list-search';
import { MoreIcon, PencilIcon } from './icons';
import { KanbanBoardPage } from './kanban-board-page';
import { ProjectOverviewTab } from './project-overview-tab';
import { ProjectSettingsTab } from './project-settings-tab';
import styles from './projects.module.css';
import { useDeleteProject, useProject, type Project } from './use-projects';

/** Aba que outra feature acrescenta ao projeto (Conexões, montada na TASK-35). */
export interface ProjectExtraTab {
  id: string;
  label: string;
  render: (project: Project) => ReactNode;
}

export const projectTabSearchSchema = z.object({
  tab: z.string().default('overview'),
});

export interface ProjectPageProps {
  extra_tabs?: readonly ProjectExtraTab[];
  /** Ligações do próprio projeto, montadas pela TASK-35 dentro de "Ligações" da Visão geral. */
  links_slot?: (project: Project) => ReactNode;
}

export function projectReportHref(project_id: string): string {
  return `/reports/proj-cards?project_id=${encodeURIComponent(project_id)}&run=1&from_module=projects`;
}

/** Tela do projeto: Visão geral (padrão), Quadro, abas extras e Configurações (PD-14, PD-41). */
export function ProjectPage({ extra_tabs = [], links_slot }: ProjectPageProps) {
  const t = useT();
  const projectId = useParams({
    strict: false,
    select: (params: Record<string, unknown>) =>
      typeof params.projectId === 'string' ? params.projectId : undefined,
  });
  const id = projectId ?? '';
  const project = useProject(id);
  const remove = useDeleteProject();
  const navigate = useNavigate();
  const { search, setSearch } = useListSearch(projectTabSearchSchema);
  const [confirming, setConfirming] = useState(false);

  if (project.isPending) return <LoadingState label={t('projects.detail.loading')} />;
  if (project.isError) {
    return (
      <ErrorState
        title={t('projects.detail.error_title')}
        description={t('projects.detail.error')}
        retryLabel={t('projects.list.retry')}
        onRetry={() => {
          void project.refetch();
        }}
      />
    );
  }

  const data = project.data;
  const { done_cards, total_cards } = data.progress;
  const tabs = [
    {
      id: 'overview',
      label: t('projects.tabs.overview'),
      panel: (
        <ProjectOverviewTab
          project={data}
          {...(links_slot ? { links_slot: links_slot(data) } : {})}
        />
      ),
    },
    { id: 'board', label: t('projects.tabs.board'), panel: <KanbanBoardPage project={data} /> },
    ...extra_tabs.map((tab) => ({ id: tab.id, label: tab.label, panel: tab.render(data) })),
    {
      id: 'settings',
      label: t('projects.tabs.settings'),
      panel: <ProjectSettingsTab project={data} />,
    },
  ];
  const current = tabs.some((tab) => tab.id === search.tab) ? search.tab : 'overview';

  return (
    <div>
      <StickyPageHeader
        back={<BackLink module="projects" fallback_to="/projects" />}
        eyebrow={t('projects.detail.eyebrow')}
        title={data.name}
        subtitle={
          total_cards === 0
            ? t('projects.list.no_cards')
            : t('projects.list.progress', { done: done_cards, total: total_cards })
        }
        actions={
          <>
            <Link to={`/projects/${data.id}/edit`} className={styles.linkButton}>
              <PencilIcon />
              {t('projects.header.edit')}
            </Link>
            <MenuButton
              label={t('projects.header.more_actions')}
              trigger={<MoreIcon />}
              items={[
                {
                  id: 'report',
                  label: t('projects.header.report_proj_cards'),
                  href: projectReportHref(data.id),
                },
                {
                  id: 'delete',
                  label: t('projects.header.delete'),
                  tone: 'danger',
                  onSelect: () => {
                    setConfirming(true);
                  },
                },
              ]}
            />
          </>
        }
      />
      <Tabs
        label={t('projects.tabs.label')}
        tabs={tabs}
        value={current}
        onChange={(tab) => {
          setSearch({ tab });
        }}
      />
      <ConfirmDialog
        open={confirming}
        title={t('projects.detail.delete_title')}
        description={t('projects.detail.delete_description')}
        confirmLabel={t('projects.detail.delete_confirm')}
        cancelLabel={t('projects.detail.delete_cancel')}
        onCancel={() => {
          setConfirming(false);
        }}
        onConfirm={() => {
          setConfirming(false);
          remove.mutate(
            { id: data.id },
            {
              onSuccess: () => {
                void navigate({ to: '/projects' });
              },
            },
          );
        }}
      />
    </div>
  );
}
