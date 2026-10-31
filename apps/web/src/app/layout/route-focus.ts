import { useRouterState } from '@tanstack/react-router';
import { useEffect, useRef } from 'react';

/** A cada troca de rota depois da primeira pintura, leva o foco ao título da página (PD-22). */
export function useRouteFocus() {
  const href = useRouterState({ select: (state) => state.location.pathname });
  const previous = useRef(href);
  useEffect(() => {
    if (previous.current === href) return;
    previous.current = href;
    // A página nova monta depois da troca: espera o título existir.
    const frame = requestAnimationFrame(() => {
      document.querySelector<HTMLElement>('[data-page-heading]')?.focus({ preventScroll: true });
    });
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [href]);
}
