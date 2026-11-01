import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = join(__dirname, '..');

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'evidence' ? [] : sources(path);
    return entry.name.endsWith('.tsx') && !entry.name.endsWith('.test.tsx') ? [path] : [];
  });
}

describe('dialogs', () => {
  it('uses the generic dialog in every app dialog', () => {
    const offenders = sources(SRC).filter((file) => {
      const text = readFileSync(file, 'utf8');
      return text.includes('<dialog') || text.includes('showModal(');
    });
    expect(offenders).toEqual([]);
  });
});
