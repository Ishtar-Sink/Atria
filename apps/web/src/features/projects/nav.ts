import type { NavItem } from '../../shared/navigation/nav-item';
import { ProjectsIcon } from './icons';

export const projectsNavItem: NavItem = {
  id: 'projects',
  label_key: 'projects.nav.title',
  to: '/projects',
  icon: ProjectsIcon,
  order: 25,
};
