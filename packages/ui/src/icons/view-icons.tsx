import type { ReactNode } from 'react';

export interface ViewIconProps {
  /** Lado do ícone em pixels. */
  size?: number;
}

/** Base comum: SVG decorativo que herda a cor do texto. */
function ViewIcon({ size = 18, children }: ViewIconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

/** Visualização em lista. */
export function ListIcon(props: ViewIconProps) {
  return (
    <ViewIcon {...props}>
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
    </ViewIcon>
  );
}

/** Visualização em grade. */
export function GridIcon(props: ViewIconProps) {
  return (
    <ViewIcon {...props}>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </ViewIcon>
  );
}

/** Visualização em estante. */
export function ShelfIcon(props: ViewIconProps) {
  return (
    <ViewIcon {...props}>
      <path d="M4 20h16M6 4v16M10 4v16M14.5 5l3.5 15" />
    </ViewIcon>
  );
}

/** Visualização em tabela. */
export function TableIcon(props: ViewIconProps) {
  return (
    <ViewIcon {...props}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 10h18M9 4v16" />
    </ViewIcon>
  );
}

/** Visualização por dia. */
export function DayIcon(props: ViewIconProps) {
  return (
    <ViewIcon {...props}>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18M8 14h4v4H8z" />
    </ViewIcon>
  );
}

/** Visualização em linha do tempo. */
export function TimelineIcon(props: ViewIconProps) {
  return (
    <ViewIcon {...props}>
      <path d="M6 3v18M10 6h10M10 12h10M10 18h7" />
      <circle cx="6" cy="6" r="1.5" />
      <circle cx="6" cy="12" r="1.5" />
      <circle cx="6" cy="18" r="1.5" />
    </ViewIcon>
  );
}
