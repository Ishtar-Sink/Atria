import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

// Rodam na TASK-35, com as rotas registradas e o servidor no ar. Os projetos do Playwright
// cobrem o desktop e os 360 px; cada fluxo termina com o axe sem violações.

const PASSWORD = 'senha-bem-longa-1';

function unique_email(prefix: string): string {
  return `${prefix}-${String(Date.now())}@exemplo.com`;
}

async function expectNoAxeViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
}

async function expectNarrowCard(page: Page) {
  const card = page.locator('[data-auth-card]');
  await expect(card).toBeVisible();
  const box = await card.boundingBox();
  expect(box?.width ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(400);
}

async function fillPasswords(page: Page, password: string) {
  await page.getByLabel('Senha', { exact: true }).fill(password);
  await page.getByLabel('Repita a senha').fill(password);
}

test('first run creates the admin and requires two-factor', async ({ page }) => {
  await page.goto('/setup');
  await expectNarrowCard(page);
  await page.getByLabel('E-mail').fill(unique_email('admin'));
  await fillPasswords(page, PASSWORD);
  await page.getByRole('button', { name: 'Criar conta' }).click();
  await expect(page).toHaveURL(/\/two-factor$/);
  await expect(page.getByRole('img', { name: /QR code/ })).toBeVisible();
  await expectNoAxeViolations(page);
  await page.goto('/setup');
  await expect(page).toHaveURL(/\/sign-in$/);
});

test('invite sign-up works once', async ({ page }) => {
  const invite = process.env['ATRIA_E2E_INVITE'] ?? 'convite-de-teste';
  await page.goto(`/sign-up?invite=${invite}`);
  await expectNarrowCard(page);
  await page.getByLabel('E-mail').fill(unique_email('membro'));
  await fillPasswords(page, PASSWORD);
  await page.getByRole('button', { name: 'Criar conta' }).click();
  await expect(page).not.toHaveURL(/\/sign-up/);
  await page.goto(`/sign-up?invite=${invite}`);
  await page.getByLabel('E-mail').fill(unique_email('segundo'));
  await fillPasswords(page, PASSWORD);
  await page.getByRole('button', { name: 'Criar conta' }).click();
  await expect(
    page.getByRole('alert').filter({ hasText: 'Este convite não vale mais' }),
  ).toBeVisible();
  await expectNoAxeViolations(page);
});

test('sign-in requires the totp code after activation', async ({ page }) => {
  const email = process.env['ATRIA_E2E_TOTP_EMAIL'] ?? 'admin-2fa@exemplo.com';
  await page.goto('/sign-in');
  await expectNarrowCard(page);
  await page.getByLabel('E-mail').fill(email);
  await page
    .getByLabel('Senha', { exact: true })
    .fill(process.env['ATRIA_E2E_PASSWORD'] ?? PASSWORD);
  await page.getByRole('button', { name: 'Entrar' }).click();
  const code = page.getByLabel('Código de 6 números');
  await expect(code).toBeVisible();
  await expect(code).toBeFocused();
  await code.fill('000000');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(
    page.getByRole('alert').filter({ hasText: 'Este código não confere' }),
  ).toBeVisible();
  await expectNoAxeViolations(page);
});

test('admin reset link works once', async ({ page }) => {
  const link = process.env['ATRIA_E2E_RESET_LINK'] ?? '/reset-password/token-de-teste';
  await page.goto(link);
  await expectNarrowCard(page);
  await fillPasswords(page, 'nova-senha-bem-longa-2');
  await page.getByRole('button', { name: 'Redefinir senha' }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
  await page.goto(link);
  await fillPasswords(page, 'nova-senha-bem-longa-3');
  await page.getByRole('button', { name: 'Redefinir senha' }).click();
  await expect(
    page.getByRole('alert').filter({ hasText: 'Este link não vale mais' }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Pedir outro link' })).toBeVisible();
  await expectNoAxeViolations(page);
});
