import { createElement } from 'react';
import type { NavItem } from '../../shared/navigation/nav-item';

const SVG_PROPS = {
  viewBox: '0 0 24 24',
  width: 18,
  height: 18,
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  focusable: 'false',
} as const;

function ReportsIcon(props: { 'aria-hidden': true }) {
  return createElement(
    'svg',
    { ...SVG_PROPS, ...props },
    createElement('path', { d: 'M3 3v18h18' }),
    createElement('path', { d: 'M7 15l4-4 3 3 5-6' }),
  );
}

export const reportsNavItem: NavItem = {
  id: 'reports',
  label_key: 'reports.nav',
  to: '/reports',
  icon: ReportsIcon,
  order: 70,
};
