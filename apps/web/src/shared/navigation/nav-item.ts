import type { ComponentType } from 'react';

/** Item da sidebar; cada feature registra os seus em `app/nav.ts`. */
export type NavItem = {
  id: string;
  label_key: string;
  to: string;
  icon: ComponentType<{ 'aria-hidden': true }>;
  order: number;
};
