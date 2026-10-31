import { createElement } from 'react';
import { registerMessages } from '../../shared/i18n/i18n';
import type { NavItem } from '../../shared/navigation/nav-item';
import messages from './i18n/pt-br.json';

registerMessages('dashboard', messages);

function HomeIcon(props: { 'aria-hidden': true }) {
  return createElement(
    'svg',
    {
      viewBox: '0 0 24 24',
      width: 20,
      height: 20,
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 1.8,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      focusable: 'false',
      ...props,
    },
    createElement('path', { d: 'M3 11.5 12 4l9 7.5' }),
    createElement('path', { d: 'M5 10v10h14V10' }),
  );
}

export const dashboardNav: NavItem = {
  id: 'dashboard',
  label_key: 'dashboard.nav.title',
  to: '/',
  icon: HomeIcon,
  order: 0,
};
