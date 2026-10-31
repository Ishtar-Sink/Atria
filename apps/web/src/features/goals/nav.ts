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

function GoalsIcon(props: { 'aria-hidden': true }) {
  return createElement(
    'svg',
    { ...SVG_PROPS, ...props },
    createElement('circle', { cx: 12, cy: 12, r: 9 }),
    createElement('circle', { cx: 12, cy: 12, r: 5 }),
    createElement('circle', { cx: 12, cy: 12, r: 1 }),
  );
}

export const goalsNav: NavItem = {
  id: 'goals',
  label_key: 'goals.nav.title',
  to: '/goals',
  icon: GoalsIcon,
  order: 20,
};
