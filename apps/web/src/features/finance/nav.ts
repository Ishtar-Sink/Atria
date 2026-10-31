import type { ComponentType } from 'react';
import { createElement } from 'react';
import { registerMessages } from '../../shared/i18n/i18n';
import type { NavItem } from '../../shared/navigation/nav-item';
import messages from './i18n/pt-br.json';

registerMessages('finance', messages);

const FinanceIcon: ComponentType<{ 'aria-hidden': true }> = (props) =>
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
    createElement('rect', { x: 2, y: 6, width: 20, height: 12, rx: 2 }),
    createElement('circle', { cx: 12, cy: 12, r: 2 }),
    createElement('path', { d: 'M6 12h.01M18 12h.01' }),
  );

/** Item "Financeiro" da sidebar; a TASK-35 o registra em `app/nav.ts`. */
export const financeNav: NavItem = {
  id: 'finance',
  label_key: 'finance.nav.title',
  to: '/finance',
  icon: FinanceIcon,
  order: 20,
};
