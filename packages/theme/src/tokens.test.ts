import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { dark, light, motion } from './tokens';

const css = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8').replaceAll("'", '"');

function toKebab(name: string): string {
  return name
    .replace(/([A-Z])/g, '-$1')
    .replace(/(\d+)/g, '-$1')
    .toLowerCase();
}

// O Prettier minuscula hex e remove zeros finais de decimais; compara-se o valor normalizado.
function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/(\.\d*?)0+\b/g, '$1')
    .replace(/\.(?=\D|$)/g, '');
}

function block(selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  const end = css.indexOf('}', start);
  const body = css.slice(start, end);
  const vars: Record<string, string> = {};
  for (const match of body.matchAll(/(--[\w-]+):\s*([^;]+);/g)) {
    vars[match[1] ?? ''] = normalize((match[2] ?? '').trim());
  }
  return vars;
}

function expected(theme: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(theme).map(([k, v]) => [`--${toKebab(k)}`, normalize(v)]),
  );
}

describe('tokens', () => {
  it('light and dark have the same keys', () => {
    expect(Object.keys(dark).sort()).toEqual(Object.keys(light).sort());
  });

  it('tokens.css mirrors tokens.ts in both themes', () => {
    expect(block(':root,\n[data-theme="light"]')).toEqual(expected(light));
    expect(block('[data-theme="dark"]')).toEqual(expected(dark));
  });

  it('motion durations never exceed 320 ms', () => {
    expect(Math.max(motion.fast, motion.base, motion.slow)).toBeLessThanOrEqual(320);
  });
});
