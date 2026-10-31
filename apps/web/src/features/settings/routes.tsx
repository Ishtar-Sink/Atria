import { createRoute, type AnyRoute } from '@tanstack/react-router';
import { registerMessages } from '../../shared/i18n/i18n';
import { DashboardSettingsPage } from './dashboard-settings-page';
import messages from './i18n/pt-br.json';
import { InstanceSettingsPage } from './instance-settings-page';
import { SearchContextsPage } from './search-contexts-page';
import { SettingsLayout } from './settings-layout';
import { UserPreferencesPage } from './user-preferences-page';

registerMessages('settings', messages);

function inLayout(Page: () => React.JSX.Element) {
  return function SettingsRoute() {
    return (
      <SettingsLayout>
        <Page />
      </SettingsLayout>
    );
  };
}

const meta = (title_key: string) => ({ title_key, breadcrumb_key: title_key });

/**
 * As quatro rotas de Configurações; a TASK-35 as registra em `app/routes.ts`. Não há `nav.ts`:
 * Configurações abre pelo menu do perfil (PD-23).
 */
export function createSettingsRoutes(parent_route: AnyRoute): AnyRoute[] {
  return [
    createRoute({
      getParentRoute: () => parent_route,
      path: '/settings',
      component: inLayout(UserPreferencesPage),
      staticData: meta('settings.title'),
    }),
    createRoute({
      getParentRoute: () => parent_route,
      path: '/settings/search',
      component: inLayout(SearchContextsPage),
      staticData: meta('settings.section_search'),
    }),
    createRoute({
      getParentRoute: () => parent_route,
      path: '/settings/dashboard',
      component: inLayout(DashboardSettingsPage),
      staticData: meta('settings.section_dashboard'),
    }),
    createRoute({
      getParentRoute: () => parent_route,
      path: '/settings/instance',
      component: inLayout(InstanceSettingsPage),
      staticData: meta('settings.section_instance'),
    }),
  ];
}
