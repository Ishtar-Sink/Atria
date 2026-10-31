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

function NotesIcon(props: { 'aria-hidden': true }) {
  return createElement(
    'svg',
    { ...SVG_PROPS, ...props },
    createElement('path', { d: 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z' }),
    createElement('path', { d: 'M14 3v5h5M9 13h6M9 17h6' }),
  );
}

export const notesNav: NavItem = {
  id: 'notes',
  label_key: 'notes.nav.title',
  to: '/notes',
  icon: NotesIcon,
  order: 50,
};
