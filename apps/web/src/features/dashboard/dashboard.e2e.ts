import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

// Fluxos ponta a ponta do dashboard. Rodam na TASK-35, com o servidor e as rotas registradas:
// cada teste entra com uma conta semeada com tarefas, lembretes, movimentações, uma entrada de
// diário e um livro em leitura, em 360 px e em desktop, e confere o axe no fim.

const SIZES = [
  { name: '360', width: 360, height: 760 },
  { name: 'desktop', width: 1280, height: 800 },
];

async function signIn(page: Page) {
  await page.goto('/__test__/sign-in?seed=dashboard');
}

async function expectNoAxeViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
}

for (const size of SIZES) {
  test.describe(`dashboard em ${size.name}`, () => {
    test.use({ viewport: { width: size.width, height: size.height } });

    test('dashboard shows data from every module', async ({ page }) => {
      await signIn(page);
      await page.goto('/');
      await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible();
      await expect(page.getByRole('region', { name: 'Saudação' })).toBeVisible();
      for (const name of [
        'Tarefas de hoje',
        'Lembretes de hoje',
        'Próximos dias',
        'Diário',
        'Dinheiro',
        'Leituras',
      ]) {
        await expect(page.getByRole('region', { name })).toBeVisible();
      }
      await expect(page.getByRole('link', { name: 'Abrir entrada' })).toBeVisible();
      await expectNoAxeViolations(page);
    });

    test('block hidden in the dashboard settings stays hidden after reload', async ({ page }) => {
      await signIn(page);
      await page.goto('/settings/dashboard');
      await page.getByRole('checkbox', { name: 'Leituras' }).uncheck();
      await page.goto('/');
      await expect(page.getByRole('region', { name: 'Leituras' })).toHaveCount(0);
      await page.reload();
      await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible();
      await expect(page.getByRole('region', { name: 'Leituras' })).toHaveCount(0);
      await expectNoAxeViolations(page);
    });

    test('completing a task removes it from today', async ({ page }) => {
      await signIn(page);
      await page.goto('/');
      const tasks = page.getByRole('region', { name: 'Tarefas de hoje' });
      const check = tasks.getByRole('button', { name: /^Concluir/ }).first();
      const label = (await check.getAttribute('aria-label')) ?? '';
      await check.click();
      await expect(tasks.getByRole('button', { name: label })).toHaveCount(0);
      await expectNoAxeViolations(page);
    });

    test('eye hides the money values after reload', async ({ page }) => {
      await signIn(page);
      await page.goto('/');
      const money = page.getByRole('region', { name: 'Dinheiro' });
      await money.getByRole('button', { name: 'Esconder as informações de Dinheiro' }).click();
      await expect(money).toContainText('•••••');
      await page.reload();
      const again = page.getByRole('region', { name: 'Dinheiro' });
      await expect(again).toContainText('•••••');
      await expect(
        again.getByRole('button', { name: 'Mostrar as informações de Dinheiro' }),
      ).toHaveAttribute('aria-pressed', 'true');
      await expectNoAxeViolations(page);
    });
  });
}
