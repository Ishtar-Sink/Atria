import { createRoute, redirect, type AnyRoute } from '@tanstack/react-router';
import { registerMessages } from '../../shared/i18n/i18n';
import { fetchSetupRequired, hasSession } from '../../shared/session/current-user';
import messages from './i18n/pt-br.json';
import { AdminPasswordResetScreen } from './screens/admin-password-reset-screen';
import { ForgotPasswordScreen } from './screens/forgot-password-screen';
import { ResetPasswordScreen } from './screens/reset-password-screen';
import { SetupScreen } from './screens/setup-screen';
import { SignInScreen } from './screens/sign-in-screen';
import { SignUpScreen } from './screens/sign-up-screen';
import { TwoFactorScreen } from './screens/two-factor-screen';

registerMessages('auth', messages);

function meta(screen: string, layout: 'app' | 'bare') {
  return {
    title_key: `auth.${screen}.title`,
    breadcrumb_key: `auth.${screen}.title`,
    layout,
  };
}

/** Rotas de autenticação: as públicas sob `publicParent` e a do admin sob `adminParent`. */
export function createAuthRoutes(publicParent: AnyRoute, adminParent: AnyRoute): AnyRoute[] {
  const setup = createRoute({
    getParentRoute: () => publicParent,
    path: '/setup',
    component: SetupScreen,
    staticData: meta('setup', 'bare'),
    loader: async () => {
      // eslint-disable-next-line @typescript-eslint/only-throw-error -- o redirect() do roteador é lançado por contrato
      if (!(await fetchSetupRequired())) throw redirect({ to: '/sign-in' });
    },
  });
  const sign_in = createRoute({
    getParentRoute: () => publicParent,
    path: '/sign-in',
    component: SignInScreen,
    staticData: meta('sign_in', 'bare'),
    loader: async () => {
      // eslint-disable-next-line @typescript-eslint/only-throw-error -- o redirect() do roteador é lançado por contrato
      if (await fetchSetupRequired()) throw redirect({ to: '/setup' });
      // eslint-disable-next-line @typescript-eslint/only-throw-error -- o redirect() do roteador é lançado por contrato
      if (await hasSession()) throw redirect({ to: '/' });
    },
  });
  const sign_up = createRoute({
    getParentRoute: () => publicParent,
    path: '/sign-up',
    component: SignUpScreen,
    staticData: meta('sign_up', 'bare'),
    validateSearch: (search: Record<string, unknown>): { invite?: string } =>
      typeof search['invite'] === 'string' ? { invite: search['invite'] } : {},
  });
  const two_factor = createRoute({
    getParentRoute: () => publicParent,
    path: '/two-factor',
    component: TwoFactorScreen,
    staticData: meta('two_factor', 'bare'),
  });
  const forgot_password = createRoute({
    getParentRoute: () => publicParent,
    path: '/forgot-password',
    component: ForgotPasswordScreen,
    staticData: meta('forgot_password', 'bare'),
  });
  const reset_password = createRoute({
    getParentRoute: () => publicParent,
    path: '/reset-password/$token',
    component: ResetPasswordScreen,
    staticData: meta('reset_password', 'bare'),
  });
  const admin_reset = createRoute({
    getParentRoute: () => adminParent,
    path: '/admin/users/$userId/password-reset',
    component: AdminPasswordResetScreen,
    staticData: meta('admin_password_reset', 'app'),
  });
  return [setup, sign_in, sign_up, two_factor, forgot_password, reset_password, admin_reset];
}
