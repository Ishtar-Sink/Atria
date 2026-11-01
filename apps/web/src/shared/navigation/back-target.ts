import { useRouterState } from '@tanstack/react-router';
import { useMemo } from 'react';

// O TanStack Router muda a localização antes de a listagem desmontar, e o efeito
// dela grava o endereço da página que está abrindo (Bug 2). Por isso o destino
// ignora a origem igual à página atual e guarda as últimas origens, não só uma.

const KEY = 'atria_back:';
const MAX_ORIGINS = 5;
const memory = new Map<string, string[]>();

export function pathnameOf(href: string): string {
  return new URL(href, 'http://atria.invalid').pathname;
}

function read(module: string): string[] {
  const remembered = memory.get(module);
  if (remembered) return remembered;
  try {
    const stored = sessionStorage.getItem(`${KEY}${module}`);
    if (stored === null) return [];
    return parseStored(stored);
  } catch {
    return [];
  }
}

// A versão anterior guardava o texto puro da URL; ele vira uma lista de um item.
function parseStored(stored: string): string[] {
  try {
    const parsed: unknown = JSON.parse(stored);
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is string => typeof item === 'string');
    }
  } catch {
    // Não é JSON: texto puro da versão anterior.
  }
  return [stored];
}

function write(module: string, list: string[]) {
  memory.set(module, list);
  try {
    sessionStorage.setItem(`${KEY}${module}`, JSON.stringify(list));
  } catch {
    // Sem armazenamento: a origem fica só em memória.
  }
}

/** Chamado pelas listagens e pelo dashboard com a URL completa (aba e filtros). */
export function rememberListLocation(module: string, href: string) {
  const others = read(module).filter((item) => pathnameOf(item) !== pathnameOf(href));
  write(module, [href, ...others].slice(0, MAX_ORIGINS));
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

function pickBackTarget(module: string, current_path: string): string | undefined {
  const list = read(module);
  const rest = list.filter((item) => pathnameOf(item) !== current_path);
  // A listagem nunca vive no endereço de um detalhe: a entrada é lixo da troca de rota.
  if (rest.length !== list.length) write(module, rest);
  return rest[0];
}

export interface BackTargetOptions {
  module: string;
  /** A listagem do tipo, quando não há origem guardada. */
  fallback_to: string;
  /** Destino explícito (na edição, o detalhe). */
  to?: string;
}

export function useBackTarget({ module, fallback_to, to }: BackTargetOptions): string {
  const current = useRouterState({ select: (state) => state.location.pathname });
  // A origem é lida a cada render: ela muda fora do React, antes de a tela abrir.
  return useMemo(
    () => to ?? pickBackTarget(module, current) ?? fallback_to,
    [to, module, fallback_to, current],
  );
}
