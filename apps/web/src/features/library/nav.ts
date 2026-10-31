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

function LibraryIcon(props: { 'aria-hidden': true }) {
  return createElement(
    'svg',
    { ...SVG_PROPS, ...props },
    createElement('path', { d: 'M4 19.5V5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2.5Z' }),
    createElement('path', { d: 'M8 7h7' }),
  );
}

export const libraryNavItem: NavItem = {
  id: 'library',
  label_key: 'library.nav.title',
  to: '/library',
  icon: LibraryIcon,
  order: 30,
};
