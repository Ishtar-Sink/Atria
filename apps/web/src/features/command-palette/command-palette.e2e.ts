import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

// Fluxo ponta a ponta de CT-12. Roda na TASK-35, com o servidor e a paleta montada no layout:
// Ctrl/Cmd + K com o foco num campo, fundo borrado, busca com e sem contextos, nota rápida e
// "abrir para completar" até a tela da nota — em 360 px e em desktop, com o axe no fim.

const SIZES = [
  { name: '360', width: 360, height: 760 },
  { name: 'desktop', width: 1280, height: 800 },
];

async function signIn(page: Page) {
  await page.goto('/__test__/sign-in?role=user');
}

async function expectNoAxeViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
}

for (const size of SIZES) {
  test.describe(`paleta de comandos em ${size.name}`, () => {
    test.use({ viewport: { width: size.width, height: size.height } });

    test('palette searches by context and creates a quick note', async ({ page }) => {
      await signIn(page);
      await page.goto('/notes/new');

      // Abre com o foco num campo de texto: o atalho não escreve nada no campo.
      const field = page.getByLabel('Título');
      await field.focus();
      await page.keyboard.press('ControlOrMeta+K');
      const dialog = page.getByRole('dialog', { name: 'Paleta de comandos' });
      await expect(dialog).toBeVisible();
      await expect(field).toHaveValue('');

      // Fundo borrado atrás do diálogo.
      const blur = await page
        .locator('.command-palette-overlay')
        .evaluate((node) => getComputedStyle(node).backdropFilter);
      expect(blur).toContain('blur');

      // Busca em tudo e depois só nos contextos escolhidos.
      const search = dialog.getByRole('combobox');
      await search.fill('ideias');
      await expect(dialog.getByRole('option').first()).toBeVisible();
      await dialog.getByRole('button', { name: 'Tarefas' }).click();
      await expect(dialog.getByRole('button', { name: 'Tarefas' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      await expect(dialog.getByRole('option').first()).toBeVisible();

      // Sem rolagem horizontal, mesmo em 360 px.
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      );
      expect(overflow).toBe(false);
      await expectNoAxeViolations(page);

      // Nota rápida e "abrir para completar".
      await search.fill('');
      await dialog.getByRole('option', { name: /Criar nota/ }).click();
      await dialog.getByLabel('Título').fill('Nota da paleta');
      await dialog.getByRole('button', { name: 'Salvar' }).click();
      await expect(dialog.getByText('Criado: Nota da paleta')).toBeVisible();
      await dialog.getByRole('button', { name: 'Abrir para completar' }).click();
      await expect(page).toHaveURL(/\/notes\/[^/]+\/edit$/);
      await expect(page.getByLabel('Título')).toHaveValue('Nota da paleta');
    });

    test('palette closes with escape and returns the focus', async ({ page }) => {
      await signIn(page);
      await page.goto('/notes');
      const trigger = page.getByRole('button', { name: /^Buscar ou criar/ });
      await trigger.click();
      await expect(page.getByRole('dialog', { name: 'Paleta de comandos' })).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await expect(trigger).toBeFocused();
    });
  });
}
