import { createRoute, redirect, type AnyRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { api } from '../../shared/api/client';
import { registerMessages } from '../../shared/i18n/i18n';
import messages from './i18n/pt-br.json';
import type { Me } from './hooks/use-users';
import { ROLE_FILTERS, USER_VIEWS } from './hooks/use-users';
import { canOpenAdmin } from './permissions';
import { InstanceScreen } from './screens/instance-screen';
import { InvitesScreen } from './screens/invites-screen';
import { NewInviteScreen } from './screens/new-invite-screen';
import { UsersScreen } from './screens/users-screen';

registerMessages('admin', messages);

/** Valor inválido na URL some; a tela aplica o padrão ([project/frontend-13]). */
const usersRouteSearch = z.object({
  role: z.enum(ROLE_FILTERS).optional().catch(undefined),
  q: z.string().optional().catch(undefined),
  view: z.enum(USER_VIEWS).optional().catch(undefined),
});

/** Quem não é `admin` nem `elevated` volta para `/`. O servidor continua recusando (RN-12). */
async function requireAdminArea() {
  let allowed = false;
  try {
    allowed = canOpenAdmin(await api.get<Me>('/me'));
  } catch {
    allowed = false;
  }
  // eslint-disable-next-line @typescript-eslint/only-throw-error -- o roteador exige lançar o redirect
  if (!allowed) throw redirect({ to: '/' });
}

/** As quatro rotas da administração; a TASK-35 as registra em `app/routes.ts`. */
export function createAdminRoutes(parent: AnyRoute): AnyRoute[] {
  const users = createRoute({
    getParentRoute: () => parent,
    path: '/admin/users',
    beforeLoad: requireAdminArea,
    validateSearch: usersRouteSearch,
    component: UsersScreen,
    staticData: { title_key: 'admin.users.title', breadcrumb_key: 'admin.users.title' },
  });
  const invites = createRoute({
    getParentRoute: () => parent,
    path: '/admin/invites',
    beforeLoad: requireAdminArea,
    component: InvitesScreen,
    staticData: { title_key: 'admin.invites.title', breadcrumb_key: 'admin.invites.title' },
  });
  const new_invite = createRoute({
    getParentRoute: () => parent,
    path: '/admin/invites/new',
    beforeLoad: requireAdminArea,
    component: NewInviteScreen,
    staticData: { title_key: 'admin.new_invite.title', breadcrumb_key: 'admin.new_invite.title' },
  });
  const instance = createRoute({
    getParentRoute: () => parent,
    path: '/admin/instance',
    beforeLoad: requireAdminArea,
    component: InstanceScreen,
    staticData: { title_key: 'admin.instance.title', breadcrumb_key: 'admin.instance.title' },
  });
  return [users, invites, new_invite, instance];
}
