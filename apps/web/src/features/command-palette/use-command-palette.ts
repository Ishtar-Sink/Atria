import { useCallback, useEffect, useState } from 'react';
import {
  closeCommandPalette,
  openCommandPalette,
  useCommandPaletteOpen,
} from '../../shared/command-palette/palette-store';

/** Estado aberto da paleta, compartilhado com o gatilho da topbar. */
export function useCommandPalette() {
  const is_open = useCommandPaletteOpen();
  const toggle = useCallback(() => {
    if (is_open) closeCommandPalette();
    else openCommandPalette();
  }, [is_open]);
  return { is_open, open: openCommandPalette, close: closeCommandPalette, toggle };
}

/**
 * Guarda o elemento que tinha o foco quando a paleta montou e devolve o foco a ele ao
 * desmontar, se ele ainda estiver na tela.
 */
export function useRestoreFocus() {
  // O inicializador roda antes de a paleta pegar o foco.
  const [opener] = useState<Element | null>(() => document.activeElement);
  useEffect(() => {
    return () => {
      if (opener instanceof HTMLElement && document.contains(opener)) opener.focus();
    };
  }, [opener]);
}
