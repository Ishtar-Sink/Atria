import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

// Fluxo ponta a ponta de CT-23. Roda na TASK-35, com o servidor e as rotas de Metas registradas:
// a pessoa entra, cria uma meta, acrescenta quatro marcos, conclui um e vê 25% — em 360 px e em
// desktop, com o axe no fim.

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
  test.describe(`metas em ${size.name}`, () => {
    test.use({ viewport: { width: size.width, height: size.height } });

    test('goal with four milestones shows 25 percent after one is done', async ({ page }) => {
      await signIn(page);
      await page.goto('/goals/new');
      await page.getByLabel('Título').fill('Ler doze livros neste ano');
      await page.getByRole('button', { name: 'Salvar' }).click();
      await expect(
        page.getByRole('heading', { level: 1, name: 'Ler doze livros neste ano' }),
      ).toBeVisible();

      await page.getByRole('tab', { name: 'Marcos' }).click();
      for (const title of ['Três livros', 'Seis livros', 'Nove livros', 'Doze livros']) {
        await page.getByLabel('Novo marco').fill(title);
        await page.getByLabel('Novo marco').press('Enter');
        await expect(page.getByLabel(title, { exact: true })).toBeVisible();
      }
      await page.getByLabel('Três livros', { exact: true }).check();
      await expect(page.getByRole('progressbar', { name: 'Progresso' })).toHaveAttribute(
        'aria-valuenow',
        '25',
      );
      await expect(page.getByText('25% dos marcos concluídos.')).toBeVisible();

      // Sem rolagem horizontal, mesmo em 360 px.
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      );
      expect(overflow).toBe(false);
      await expectNoAxeViolations(page);
    });
  });
}
