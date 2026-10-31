import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, expect } from 'vitest';
import * as axeMatchers from 'vitest-axe/matchers';

expect.extend(axeMatchers);

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

// O jsdom não implementa o canvas: a roda de cores recebe um contexto falso.
HTMLCanvasElement.prototype.getContext = function getContext() {
  return {
    createImageData: (width: number, height: number) => ({
      data: new Uint8ClampedArray(width * height * 4),
      width,
      height,
    }),
    putImageData: () => undefined,
  } as unknown as CanvasRenderingContext2D;
} as unknown as HTMLCanvasElement['getContext'];

// O jsdom não implementa a rolagem até o elemento.
Element.prototype.scrollIntoView = () => undefined;
