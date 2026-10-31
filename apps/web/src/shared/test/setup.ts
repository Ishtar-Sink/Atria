import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, expect } from 'vitest';
import * as axeMatchers from 'vitest-axe/matchers';

expect.extend(axeMatchers);

type Listener = (event: MediaQueryListEvent) => void;

interface FakeQuery {
  query: string;
  listeners: Set<Listener>;
  list: MediaQueryList;
}

const DEFAULT_WIDTH = 1280;
let viewport_width = DEFAULT_WIDTH;
let prefers_dark = false;
const queries = new Set<FakeQuery>();

function evaluate(query: string): boolean {
  if (query.includes('prefers-color-scheme: dark')) return prefers_dark;
  const max = /max-width:\s*(\d+)px/.exec(query);
  if (max) return viewport_width <= Number(max[1]);
  const min = /min-width:\s*(\d+)px/.exec(query);
  if (min) return viewport_width >= Number(min[1]);
  return false;
}

function notify() {
  queries.forEach((entry) => {
    const matches = evaluate(entry.query);
    if (matches === entry.list.matches) return;
    Object.defineProperty(entry.list, 'matches', { value: matches, configurable: true });
    entry.listeners.forEach((listener) => {
      listener({ matches, media: entry.query } as MediaQueryListEvent);
    });
  });
}

/** Largura simulada do navegador, para os testes de layout responsivo. */
export function setViewportWidth(width: number) {
  viewport_width = width;
  notify();
}

export function setPrefersDark(value: boolean) {
  prefers_dark = value;
  notify();
}

function fakeMatchMedia(query: string): MediaQueryList {
  const listeners = new Set<Listener>();
  const list = {
    media: query,
    matches: evaluate(query),
    onchange: null,
    addEventListener: (_type: string, listener: Listener) => listeners.add(listener),
    removeEventListener: (_type: string, listener: Listener) => listeners.delete(listener),
    addListener: (listener: Listener) => listeners.add(listener),
    removeListener: (listener: Listener) => listeners.delete(listener),
    dispatchEvent: () => false,
  } as unknown as MediaQueryList;
  queries.add({ query, listeners, list });
  return list;
}

Object.defineProperty(window, 'matchMedia', { value: fakeMatchMedia, writable: true });

beforeEach(() => {
  viewport_width = DEFAULT_WIDTH;
  prefers_dark = false;
  queries.clear();
  try {
    localStorage.clear();
  } catch {
    // jsdom sem armazenamento: o app também tolera isso.
  }
  document.documentElement.removeAttribute('data-theme');
});

afterEach(() => {
  cleanup();
});

// O jsdom ainda pode não implementar a abertura modal do <dialog>.
if (typeof HTMLDialogElement.prototype.showModal !== 'function') {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
}
if (typeof HTMLDialogElement.prototype.close !== 'function') {
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.removeAttribute('open');
  };
}

// O jsdom não implementa a rolagem até o elemento.
Element.prototype.scrollIntoView = () => undefined;
