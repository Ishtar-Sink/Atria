import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expectNoAxeViolations, setTheme, signIn } from './e2e-session';

// Lido em tempo de execução, a partir de apps/web: o JSON fica na raiz, fora do build do frontend.
const lighthouse = JSON.parse(
  readFileSync(join(process.cwd(), '../../lighthouserc.json'), 'utf8'),
) as { ci: { collect: { url: string[] } } };

// RNF-06: axe nas telas principais (as de `lighthouserc.json`), nos temas claro e escuro, e com
// os seletores da base abertos (PD-57, PD-62).

const SCREENS = lighthouse.ci.collect.url.map((url) => new URL(url).pathname);
const THEMES = ['light', 'dark'] as const;

for (const path of SCREENS) {
  for (const theme of THEMES) {
    test(`axe ${path} ${theme}: sem violações`, async ({ page }) => {
      await signIn(page, 'admin');
      await page.goto(path);
      await setTheme(page, theme);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expectNoAxeViolations(page);
    });
  }
}

/** Abre cada seletor (período, data, emoções) da tela e passa o axe com ele aberto. */
async function axeWithEveryPickerOpen(page: Page, path: string) {
  await page.goto(path);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  const pickers = page.locator('main [aria-haspopup="dialog"], main [aria-haspopup="listbox"]');
  const count = await pickers.count();
  expect(count, path).toBeGreaterThan(0);
  for (let index = 0; index < count; index += 1) {
    await pickers.nth(index).click();
    await expect(page.getByRole('dialog').or(page.getByRole('listbox')).first()).toBeVisible();
    await expectNoAxeViolations(page);
    await page.keyboard.press('Escape');
  }
}

test('axe seletores da base abertos: sem violações', async ({ page }) => {
  await signIn(page);
  for (const path of ['/finance', '/journal', '/reports/fin-flow', '/tasks/new', '/journal/new']) {
    await axeWithEveryPickerOpen(page, path);
  }
});
