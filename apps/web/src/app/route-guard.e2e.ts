import { expect, test } from '@playwright/test';
import { expectNoAxeViolations, signIn } from './e2e-session';

// Proteção das rotas sem sessão (RF-01, RF-02): o e2e roda sobre uma instância já configurada;
// o caso da instância nova (assistente) fica no teste de componente `session-guard.test.tsx`.

const signInHeading = (page: import('@playwright/test').Page) =>
  page.getByRole('heading', { level: 1, name: 'Entrar' });

test('rota autenticada sem sessão leva ao login', async ({ browser }, info) => {
  test.skip(info.project.name !== 'desktop', 'o fluxo não depende da largura');
  // Garante a instância configurada antes de abrir a rota num contexto sem cookies.
  const setup = await browser.newContext();
  await signIn(await setup.newPage());
  await setup.close();

  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('/finance');
  await expect(page).toHaveURL(/\/sign-in$/);
  await expect(signInHeading(page)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Financeiro' })).toHaveCount(0);
  await expectNoAxeViolations(page);
  const shot = process.env['ATRIA_E2E_SHOT'];
  if (shot) await page.screenshot({ path: shot, fullPage: true, animations: 'disabled' });
  await context.close();
});

test('sessão expirada no uso leva ao login e volta ao endereço', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'o fluxo não depende da largura');
  await signIn(page);
  await page.goto('/notes');
  // Espera as leituras da tela: sem isso elas saem já sem cookie e levam ao login antes do clique.
  await expect(page.getByRole('heading', { level: 1, name: 'Notas' })).toBeVisible();
  await page.waitForLoadState('networkidle');
  await page.context().clearCookies();
  await page.getByRole('navigation', { name: 'Principal' }).locator('a[href="/goals"]').click();
  await expect(page).toHaveURL(/\/sign-in$/);
  await page.goto('/__test__/sign-in?role=user');
  await expect(page).toHaveURL(/\/goals$/);
});
