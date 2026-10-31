import type { ComponentType } from 'react';
import { createElement } from 'react';
import type { NavItem } from '../../shared/navigation/nav-item';
import { registerMessages } from '../../shared/i18n/i18n';
import messages from './i18n/pt-br.json';

registerMessages('tasks', messages);

const TasksIcon: ComponentType<{ 'aria-hidden': true }> = (props) =>
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
    createElement('path', { d: 'M9 11l3 3 8-8' }),
    createElement('path', { d: 'M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9' }),
  );

/** Item "Tarefas" da sidebar; a TASK-35 o registra em `app/nav.ts`. */
export const tasksNav: NavItem = {
  id: 'tasks',
  label_key: 'tasks.nav.title',
  to: '/tasks',
  icon: TasksIcon,
  order: 40,
};
