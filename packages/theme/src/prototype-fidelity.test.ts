import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const prototype = readFileSync(
  new URL('../../../prototype/atria-prototype.html', import.meta.url),
  'utf8',
);
const css = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8').replaceAll("'", '"');

// Normaliza espaços, caixa e zeros finais dos decimais (o Prettier reescreve o CSS do app).
function normalize(value: string): string {
  return value
    .replaceAll('"', "'")
    .replace(/\s+/g, '')
    .toLowerCase()
    .replace(/(\.\d*?)0+(?=\D|$)/g, '$1')
    .replace(/\.(?=\D|$)/g, '');
}

function declarations(source: string, selector: string): Record<string, string> {
  const start = source.indexOf(`${selector} {`);
  expect(start, `bloco ${selector}`).toBeGreaterThanOrEqual(0);
  const body = source.slice(start, source.indexOf('\n}', start));
  const vars: Record<string, string> = {};
  for (const match of body.matchAll(/(--[\w-]+):\s*([^;]+);/g)) {
    vars[match[1] ?? ''] = normalize(match[2] ?? '');
  }
  return vars;
}

const style = prototype.slice(prototype.indexOf('<style>'));

describe('prototype tokens', () => {
  it.each([
    [':root,\n[data-theme="light"]', ':root,\n[data-theme="light"]'],
    ['[data-theme="dark"]', '[data-theme="dark"]'],
  ])('mirror the prototype in %s', (selector) => {
    const expected = declarations(style, selector);
    const actual = declarations(css, selector);
    expect(Object.keys(expected).length).toBeGreaterThan(30);
    for (const [name, value] of Object.entries(expected)) {
      expect(actual[name], name).toBe(value);
    }
  });

  it('mirror the shared scales of the prototype (radius, space, gradient, fonts, motion)', () => {
    const start = style.indexOf('\n:root {');
    const expected = declarations(style.slice(start - 1), ':root');
    const actual = declarations(css, ':root');
    expect(Object.keys(expected)).toContain('--s6');
    for (const [name, value] of Object.entries(expected)) {
      expect(actual[name], name).toBe(value);
    }
  });
});
