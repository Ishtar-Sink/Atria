import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  GridIcon,
  ItemSwatch,
  ListIcon,
  LoadingState,
  MenuButton,
  ProgressBar,
  SelectField,
  Toolbar,
  ViewSwitcher,
} from '@atria/ui';
import { Link, useRouterState } from '@tanstack/react-router';
import { useEffect } from 'react';
import { useT, type Translate } from '../../shared/i18n/i18n';
import { useScreenInfo } from '../../shared/layout/screen-info';
import { StickyPageHeader } from '../../shared/layout/sticky-page-header';
import { rememberListLocation } from '../../shared/navigation/back-target';
import { useListSearch } from '../../shared/url-state/use-list-search';
import styles from './projects.module.css';
import {
  projectsSearchSchema,
  searchToFilters,
  useProjects,
  type Project,
  type Visibility,
} from './use-projects';

const VISIBILITIES = ['personal', 'shared'] as const satisfies readonly Visibility[];

export function percentOf(project: Pick<Project, 'progress'>): number {
  const { done_cards, total_cards } = project.progress;
  return total_cards > 0 ? Math.floor((done_cards * 100) / total_cards) : 0;
}

function progressText(project: Project, t: Translate): string {
  return project.progress.total_cards === 0
    ? t('projects.list.no_cards')
    : t('projects.list.progress', {
        done: project.progress.done_cards,
        total: project.progress.total_cards,
      });
}

function ProjectRow({ project }: { project: Project }) {
  const t = useT();
  return (
    <li className={styles.row}>
      <ItemSwatch id={project.id} className={styles.swatch} />
      <div className={styles.rowMain}>
        <Link to={`/projects/${project.id}`} className={styles.rowTitle}>
          {project.name}
        </Link>
        <span className={styles.rowSub}>{progressText(project, t)}</span>
      </div>
      <div className={styles.rowMeta}>
        <Badge tone="neutral">{t(`projects.visibility.${project.visibility}`)}</Badge>
      </div>
      <div className={styles.rowProgress}>
        <ProgressBar
          label={t('projects.list.progress_label', { name: project.name })}
          value={percentOf(project)}
        />
      </div>
    </li>
  );
}

function ProjectTile({ project }: { project: Project }) {
  const t = useT();
  return (
    <li className={styles.tile}>
      <ItemSwatch id={project.id} className={styles.art} />
      <Link to={`/projects/${project.id}`} className={styles.rowTitle}>
        {project.name}
      </Link>
      <span className={styles.rowSub}>{progressText(project, t)}</span>
      <div className={styles.tileFoot}>
        <ProgressBar
          label={t('projects.list.progress_label', { name: project.name })}
          value={percentOf(project)}
        />
        <div className={styles.pills}>
          <Badge tone="neutral">{t(`projects.visibility.${project.visibility}`)}</Badge>
        </div>
      </div>
    </li>
  );
}

/** Lista de projetos em lista e grade, com busca, filtro e visualização na URL (RF-54, PD-42). */
export function ProjectsListPage() {
  const t = useT();
  const { search, setSearch } = useListSearch(projectsSearchSchema, { view_key: 'projects' });
  const query = useProjects(searchToFilters(search));
  const { set_items } = useScreenInfo();
  const href = useRouterState({ select: (state) => state.location.href });

  useEffect(() => {
    rememberListLocation('projects', href);
  }, [href]);

  const projects = query.data?.pages.flatMap((page) => page.items) ?? [];
  const total = projects.length;
  useEffect(() => {
    set_items(
      query.isSuccess
        ? [
            {
              label: t('projects.list.items_label'),
              value: t('projects.list.items', { count: total }),
            },
          ]
        : [],
    );
    return () => {
      set_items([]);
    };
  }, [query.isSuccess, total, set_items, t]);

  const filtered = search.visibility !== undefined || search.q !== undefined;
  const create = (
    <Link to="/projects/new" className={[styles.linkButton, styles.linkPrimary].join(' ')}>
      {t('projects.list.create')}
    </Link>
  );

  let body;
  if (query.isPending) {
    body = <LoadingState label={t('projects.list.loading')} />;
  } else if (query.isError) {
    body = (
      <ErrorState
        title={t('projects.list.error_title')}
        description={t('projects.list.error')}
        retryLabel={t('projects.list.retry')}
        onRetry={() => {
          void query.refetch();
        }}
      />
    );
  } else if (projects.length === 0) {
    body = filtered ? (
      <EmptyState
        title={t('projects.list.empty_filtered_title')}
        description={t('projects.list.empty_filtered_text')}
      />
    ) : (
      <EmptyState
        title={t('projects.list.empty_title')}
        description={t('projects.list.empty_text')}
        action={create}
      />
    );
  } else {
    body = (
      <>
        {search.view === 'grid' ? (
          <ul className={styles.grid}>
            {projects.map((project) => (
              <ProjectTile key={project.id} project={project} />
            ))}
          </ul>
        ) : (
          <ul className={styles.list}>
            {projects.map((project) => (
              <ProjectRow key={project.id} project={project} />
            ))}
          </ul>
        )}
        {query.hasNextPage ? (
          <div className={styles.more}>
            <Button
              loading={query.isFetchingNextPage}
              onClick={() => {
                void query.fetchNextPage();
              }}
            >
              {t('projects.list.more')}
            </Button>
          </div>
        ) : null}
      </>
    );
  }

  return (
    <div>
      <StickyPageHeader
        eyebrow={t('projects.list.eyebrow')}
        title={t('projects.list.title')}
        subtitle={t('projects.list.subtitle')}
        actions={
          <div className={styles.actions}>
            <MenuButton
              label={t('projects.list.reports')}
              trigger={t('projects.list.reports')}
              items={[
                {
                  id: 'proj-cards',
                  label: t('projects.list.report_proj_cards'),
                  href: '/reports/proj-cards?from_module=projects',
                },
              ]}
            />
            {create}
          </div>
        }
      />
      <Toolbar
        searchLabel={t('projects.list.search_label')}
        searchPlaceholder={t('projects.list.search_placeholder')}
        searchValue={search.q ?? ''}
        onSearchChange={(value) => {
          setSearch({ q: value === '' ? undefined : value });
        }}
        filters={
          <div
            role="group"
            aria-label={t('projects.list.filters_label')}
            className={styles.actions}
          >
            <SelectField
              label={t('projects.list.filter_visibility')}
              value={search.visibility ?? ''}
              options={[
                { value: '', label: t('projects.list.filter_visibility_all') },
                ...VISIBILITIES.map((visibility) => ({
                  value: visibility,
                  label: t(`projects.visibility.${visibility}`),
                })),
              ]}
              onChange={(value) => {
                setSearch({ visibility: VISIBILITIES.find((item) => item === value) });
              }}
            />
          </div>
        }
      >
        <ViewSwitcher
          label={t('projects.list.view_label')}
          value={search.view}
          options={[
            { value: 'list', label: t('projects.list.view_list'), icon: <ListIcon /> },
            { value: 'grid', label: t('projects.list.view_grid'), icon: <GridIcon /> },
          ]}
          onChange={(value) => {
            setSearch({ view: value === 'grid' ? 'grid' : 'list' });
          }}
        />
      </Toolbar>
      <div aria-live="polite">{body}</div>
    </div>
  );
}
