import { createElement } from 'react';
import type { NavItem } from '../../shared/navigation/nav-item';
import type { Role } from './permissions';

function AdminIcon(props: { 'aria-hidden': true }) {
  return createElement(
    'svg',
    {
      viewBox: '0 0 24 24',
      width: 18,
      height: 18,
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 2,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      ...props,
    },
    createElement('path', { d: 'M12 3 4 6v6c0 4.4 3.4 8.4 8 9 4.6-.6 8-4.6 8-9V6l-8-3Z' }),
    createElement('path', { d: 'm9 12 2 2 4-4' }),
  );
}

/** Item "Administração" da sidebar; a sidebar só o mostra a quem tem um dos `roles`. */
export const adminNav: NavItem & { roles: readonly Role[] } = {
  id: 'admin',
  label_key: 'admin.nav.title',
  to: '/admin/users',
  icon: AdminIcon,
  order: 90,
  roles: ['admin', 'elevated'],
};
