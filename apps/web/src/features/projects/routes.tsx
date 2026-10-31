import { createRoute, type AnyRoute } from '@tanstack/react-router';
import { CardFormPage } from './card-form-page';
import { LaneFormPage } from './lane-form-page';
import { ProjectFormPage } from './project-form-page';
import { ProjectPage, type ProjectPageProps } from './project-page';
import { ProjectsListPage } from './projects-list-page';

export type ProjectsRoutesOptions = ProjectPageProps;

/**
 * Rotas de Projetos, para a TASK-35 registrar. A Visão geral, o Quadro e as Configurações são abas
 * de `/projects/$projectId` (`tab` na URL, PD-41); a aba Conexões chega por `extra_tabs`, e as
 * ligações do projeto, por `links_slot`.
 */
export function createProjectsRoutes(
  parent_route: AnyRoute,
  options: ProjectsRoutesOptions = {},
): AnyRoute[] {
  const meta = (key: string) => ({ title_key: key, breadcrumb_key: key });
  const list = createRoute({
    getParentRoute: () => parent_route,
    path: '/projects',
    component: ProjectsListPage,
    staticData: meta('projects.nav.title'),
  });
  const create = createRoute({
    getParentRoute: () => parent_route,
    path: '/projects/new',
    component: ProjectFormPage,
    staticData: meta('projects.form.title_new'),
  });
  const detail = createRoute({
    getParentRoute: () => parent_route,
    path: '/projects/$projectId',
    component: () => <ProjectPage {...options} />,
    staticData: meta('projects.detail.crumb'),
  });
  const edit = createRoute({
    getParentRoute: () => parent_route,
    path: '/projects/$projectId/edit',
    component: ProjectFormPage,
    staticData: meta('projects.form.title_edit'),
  });
  const lane_new = createRoute({
    getParentRoute: () => parent_route,
    path: '/projects/$projectId/lanes/new',
    component: LaneFormPage,
    staticData: meta('projects.lane_form.title_new'),
  });
  const lane_edit = createRoute({
    getParentRoute: () => parent_route,
    path: '/projects/$projectId/lanes/$laneId/edit',
    component: LaneFormPage,
    staticData: meta('projects.lane_form.title_edit'),
  });
  const card_new = createRoute({
    getParentRoute: () => parent_route,
    path: '/projects/$projectId/cards/new',
    component: CardFormPage,
    staticData: meta('projects.card_form.title_new'),
  });
  const card_edit = createRoute({
    getParentRoute: () => parent_route,
    path: '/projects/$projectId/cards/$cardId',
    component: CardFormPage,
    staticData: meta('projects.card_form.title_edit'),
  });
  return [list, create, detail, edit, lane_new, lane_edit, card_new, card_edit];
}
