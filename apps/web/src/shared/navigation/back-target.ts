import { useMemo } from 'react';

const KEY = 'atria_back:';
const memory = new Map<string, string>();

/** Chamado pelas listagens e pelo dashboard com a URL completa (aba e filtros). */
export function rememberListLocation(module: string, href: string) {
  memory.set(module, href);
  try {
    sessionStorage.setItem(`${KEY}${module}`, href);
  } catch {
    // Sem armazenamento: a origem fica só em memória.
  }
}

export function forgetListLocations(options: { keep_session?: boolean } = {}) {
  memory.clear();
  if (options.keep_session) return;
  try {
    Object.keys(sessionStorage)
      .filter((key) => key.startsWith(KEY))
      .forEach((key) => {
        sessionStorage.removeItem(key);
      });
  } catch {
    // Sem armazenamento: nada a limpar.
  }
}

function lastLocation(module: string): string | undefined {
  const remembered = memory.get(module);
  if (remembered) return remembered;
  try {
    return sessionStorage.getItem(`${KEY}${module}`) ?? undefined;
  } catch {
    return undefined;
  }
}

export interface BackTargetOptions {
  module: string;
  /** A listagem do tipo, quando não há origem guardada. */
  fallback_to: string;
  /** Destino explícito (na edição, o detalhe). */
  to?: string;
}

export function useBackTarget({ module, fallback_to, to }: BackTargetOptions): string {
  // A origem é lida a cada render: ela muda fora do React, antes de a tela abrir.
  return useMemo(() => to ?? lastLocation(module) ?? fallback_to, [to, module, fallback_to]);
}
