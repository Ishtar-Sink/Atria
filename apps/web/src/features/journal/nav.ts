import type { ComponentType } from 'react';
import { createElement } from 'react';
import { registerMessages } from '../../shared/i18n/i18n';
import type { NavItem } from '../../shared/navigation/nav-item';
import messages from './i18n/pt-br.json';

registerMessages('journal', messages);

const JournalIcon: ComponentType<{ 'aria-hidden': true }> = (props) =>
  createElement(
    'svg',
    {
      ...props,
      viewBox: '0 0 24 24',
      width: 18,
      height: 18,
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 2,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      focusable: 'false',
    },
    createElement('path', { d: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20' }),
    createElement('path', { d: 'M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z' }),
    createElement('path', { d: 'M9 7h6M9 11h6' }),
  );

/** Item "Diário" da sidebar; a TASK-35 o registra em `app/nav.ts`. */
export const journalNavItem: NavItem = {
  id: 'journal',
  label_key: 'journal.nav',
  to: '/journal',
  icon: JournalIcon,
  order: 60,
};
