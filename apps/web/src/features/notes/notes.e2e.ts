import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

// Fluxo ponta a ponta de CT-26. Roda na TASK-35, com o servidor e as rotas de Notas registradas:
// a pessoa entra, cria uma nota, edita o título, exclui com confirmação e não a vê mais na lista
// — em 360 px e em desktop, com o axe no fim.

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
  test.describe(`notas em ${size.name}`, () => {
    test.use({ viewport: { width: size.width, height: size.height } });

    test('note is created, edited and deleted', async ({ page }) => {
      await signIn(page);
      await page.goto('/notes/new');
      await page.getByLabel('Título').fill('Ideias de viagem');
      await page.getByLabel('Texto').fill('Lisboa em março.');
      await page.getByRole('button', { name: 'Salvar' }).click();
      await expect(page.getByRole('heading', { level: 1, name: 'Ideias de viagem' })).toBeVisible();
      await expect(page.getByText('Lisboa em março.')).toBeVisible();

      await page.getByRole('link', { name: 'Editar' }).click();
      await page.getByLabel('Título').fill('Ideias para Portugal');
      await page.getByRole('button', { name: 'Salvar' }).click();
      await expect(
        page.getByRole('heading', { level: 1, name: 'Ideias para Portugal' }),
      ).toBeVisible();

      // Sem rolagem horizontal, mesmo em 360 px.
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      );
      expect(overflow).toBe(false);
      await expectNoAxeViolations(page);

      await page.getByRole('button', { name: 'Mais ações' }).click();
      await page.getByRole('menuitem', { name: 'Excluir' }).click();
      await page.getByRole('alertdialog').getByRole('button', { name: 'Excluir' }).click();
      await expect(page).toHaveURL(/\/notes$/);
      await expect(page.getByRole('link', { name: 'Ideias para Portugal' })).toHaveCount(0);
    });
  });
}
