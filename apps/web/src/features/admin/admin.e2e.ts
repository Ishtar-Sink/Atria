import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

// Fluxos ponta a ponta da administração. Rodam na TASK-35, com o servidor e as rotas registradas:
// cada teste entra com uma conta de papel conhecido (semeada pelo servidor de teste) em 360 px e
// em desktop, e confere o axe no fim.

const SIZES = [
  { name: '360', width: 360, height: 760 },
  { name: 'desktop', width: 1280, height: 800 },
];

async function signIn(page: Page, role: 'admin' | 'elevated') {
  await page.goto(`/__test__/sign-in?role=${role}`);
}

async function expectNoAxeViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
}

for (const size of SIZES) {
  test.describe(`administração em ${size.name}`, () => {
    test.use({ viewport: { width: size.width, height: size.height } });

    test('admin grants elevated and elevated manages a user', async ({ page }) => {
      await signIn(page, 'admin');
      await page.goto('/admin/users');
      await page.getByRole('button', { name: /^Conceder elevado: ana@/ }).click();
      await expect(page.getByRole('button', { name: /^Retirar elevado: ana@/ })).toBeVisible();
      await expectNoAxeViolations(page);

      await signIn(page, 'elevated');
      await page.goto('/admin/users');
      await expect(page.getByRole('button', { name: /elevado/i })).toHaveCount(0);
      await page.getByRole('button', { name: /^Desativar: bia@/ }).click();
      await page.getByRole('alertdialog').getByRole('button', { name: 'Desativar' }).click();
      await expect(page.getByRole('button', { name: /^Reativar: bia@/ })).toBeVisible();
      await expectNoAxeViolations(page);
    });

    test('elevated cannot change instance settings', async ({ page }) => {
      await signIn(page, 'elevated');
      await page.goto('/admin/invites');
      await expect(page.getByRole('button', { name: 'Gerar convite' })).toBeVisible();
      await expect(page.getByRole('switch')).toHaveCount(0);
      await page.goto('/admin/instance');
      await expect(page.getByText('Versão')).toBeVisible();
      await expect(page.getByRole('switch')).toHaveCount(0);
      await expectNoAxeViolations(page);
    });

    test('sign-up works without invite when the requirement is off', async ({ page }) => {
      await signIn(page, 'admin');
      await page.goto('/admin/invites');
      const toggle = page.getByRole('switch', { name: 'Exigir convite para cadastro' });
      await toggle.uncheck();
      await expect(toggle).not.toBeChecked();
      await expectNoAxeViolations(page);

      await page.context().clearCookies();
      await page.goto('/sign-up');
      await page.getByLabel('E-mail').fill(`novo-${size.name}@casa.test`);
      await page.getByLabel('Senha', { exact: true }).fill('uma-senha-bem-longa-123');
      await page.getByRole('button', { name: /criar conta/i }).click();
      await expect(page).not.toHaveURL(/sign-up/);
    });
  });
}
