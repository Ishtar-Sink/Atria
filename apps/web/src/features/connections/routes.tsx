import { createRoute, type AnyRoute } from '@tanstack/react-router';
import { NewConnectionPage } from './new-connection-page';

/**
 * Rotas de Conexões, para a TASK-35 registrar. A feature não tem item de navegação: a aba é
 * montada nas telas das entidades e a rota de ligar recebe a origem em `source_type` e `source_id`.
 */
export function createConnectionsRoutes(parent_route: AnyRoute): AnyRoute[] {
  const create = createRoute({
    getParentRoute: () => parent_route,
    path: '/connections/new',
    component: NewConnectionPage,
    staticData: { title_key: 'connections.new.title', breadcrumb_key: 'connections.new.title' },
  });
  return [create];
}
