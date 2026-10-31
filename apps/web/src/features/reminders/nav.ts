import type { ComponentType } from 'react';
import { createElement } from 'react';
import type { NavItem } from '../../shared/navigation/nav-item';
import { registerMessages } from '../../shared/i18n/i18n';
import messages from './i18n/pt-br.json';

registerMessages('reminders', messages);

const RemindersIcon: ComponentType<{ 'aria-hidden': true }> = (props) =>
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
    createElement('path', { d: 'M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9' }),
    createElement('path', { d: 'M13.7 21a2 2 0 0 1-3.4 0' }),
  );

/** Item "Lembretes" da sidebar; a TASK-35 o registra em `app/nav.ts`. */
export const remindersNav: NavItem = {
  id: 'reminders',
  label_key: 'reminders.nav.title',
  to: '/reminders',
  icon: RemindersIcon,
  order: 45,
};
