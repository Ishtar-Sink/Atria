import { useRouter } from '@tanstack/react-router';
import type { ReactNode } from 'react';

export interface DashboardLinkProps {
  to: string;
  className?: string;
  children: ReactNode;
}

/** Link interno: navega pelo roteador e mantém o `href` real para abrir em outra aba. */
export function DashboardLink({ to, className, children }: DashboardLinkProps) {
  const router = useRouter();
  return (
    <a
      href={to}
      className={className}
      onClick={(event) => {
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return;
        event.preventDefault();
        router.history.push(to);
      }}
    >
      {children}
    </a>
  );
}
