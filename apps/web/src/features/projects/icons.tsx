import type { ReactNode } from 'react';

/** Ícones SVG inline da feature: decorativos, o nome acessível fica no botão ([project/frontend-08]). */
export function Svg({ children, size = 16 }: { children: ReactNode; size?: number }) {
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

export const PlusIcon = () => (
  <Svg size={14}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);

export const PencilIcon = () => (
  <Svg>
    <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </Svg>
);

export const MoreIcon = () => (
  <Svg>
    <circle cx="5" cy="12" r="1" />
    <circle cx="12" cy="12" r="1" />
    <circle cx="19" cy="12" r="1" />
  </Svg>
);

export const CalendarIcon = () => (
  <Svg size={14}>
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <path d="M16 2v4M8 2v4M3 10h18" />
  </Svg>
);

export const ChecklistIcon = () => (
  <Svg size={14}>
    <path d="M9 11l3 3L22 4" />
    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
  </Svg>
);

export const LinkIcon = () => (
  <Svg size={14}>
    <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" />
    <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />
  </Svg>
);

export const ProjectsIcon = (props: { 'aria-hidden': true }) => (
  <svg
    viewBox="0 0 24 24"
    width={18}
    height={18}
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    focusable="false"
    {...props}
  >
    <rect x="3" y="3" width="5" height="18" rx="1" />
    <rect x="10" y="3" width="5" height="11" rx="1" />
    <rect x="17" y="3" width="4" height="15" rx="1" />
  </svg>
);

/** Seis pontinhos do puxador de reordenar (PD-47). */
export const HandleIcon = () => (
  <svg
    viewBox="0 0 8 20"
    width="8"
    height="20"
    fill="currentColor"
    aria-hidden="true"
    focusable="false"
  >
    <circle cx="2" cy="4" r="1.4" />
    <circle cx="6" cy="4" r="1.4" />
    <circle cx="2" cy="10" r="1.4" />
    <circle cx="6" cy="10" r="1.4" />
    <circle cx="2" cy="16" r="1.4" />
    <circle cx="6" cy="16" r="1.4" />
  </svg>
);
