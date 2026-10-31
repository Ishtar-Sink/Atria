import { useEffect } from 'react';
import { matchesShortcut } from './shortcut';

/**
 * Escuta o atalho em qualquer tela, na fase de captura, para valer também com o foco num
 * campo de texto (CB-13), e impede a ação padrão do navegador.
 */
export function usePaletteShortcut(shortcut: string, onTrigger: () => void) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!matchesShortcut(event, shortcut)) return;
      event.preventDefault();
      onTrigger();
    }
    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
    };
  }, [shortcut, onTrigger]);
}
