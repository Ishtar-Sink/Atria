import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

// Fluxos ponta a ponta de Configurações (CT-31 e CT-32). Rodam na TASK-35, com o servidor e as rotas
// registradas: cada teste entra com uma conta de papel conhecido (semeada pelo servidor de teste)
// em 360 px e em desktop, e confere o axe no fim.

// Nome visível do usuário de teste na sidebar (e-mail, sem `display_name`); é o nome acessível do botão do perfil.
const TEST_USER_NAME = 'ana@atria.example';

const SIZES = [
  { name: '360', width: 360, height: 760 },
  { name: 'desktop', width: 1280, height: 800 },
];

async function signIn(page: Page, role: 'admin' | 'user') {
  await page.goto(`/__test__/sign-in?role=${role}`);
}

async function expectNoAxeViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
}

for (const size of SIZES) {
  test.describe(`configurações em ${size.name}`, () => {
    test.use({ viewport: { width: size.width, height: size.height } });

    test('user preferences apply at once and after reload (CT-31)', async ({ page }) => {
      await signIn(page, 'user');
      await page.goto('/settings');

      await page.getByRole('radio', { name: 'Escuro' }).check();
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

      await page.getByRole('button', { name: /^Fuso horário/ }).click();
      await page.getByRole('option', { name: 'Europe/Lisbon' }).click();
      await page.getByRole('button', { name: /^Moeda/ }).click();
      await page.getByRole('option', { name: /\(USD\)$/ }).click();

      await page.getByRole('button', { name: 'Gravar' }).click();
      await page.keyboard.press('Control+J');
      await expect(page.getByText('Ctrl + J')).toBeVisible();

      await page.goto('/settings/search');
      await page.getByRole('button', { name: 'Notas' }).click();
      await expect(page.getByRole('button', { name: 'Notas' })).toHaveAttribute(
        'aria-pressed',
        'false',
      );
      await expectNoAxeViolations(page);

      await page.reload();
      await expect(page.getByRole('button', { name: 'Notas' })).toHaveAttribute(
        'aria-pressed',
        'false',
      );
      await page.goto('/settings');
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
      await expect(page.getByRole('radio', { name: 'Escuro' })).toBeChecked();
      await expect(page.getByRole('button', { name: /^Fuso horário.*Lisbon/ })).toBeVisible();
      await expect(page.getByRole('button', { name: /^Moeda.*\(USD\)/ })).toBeVisible();
      await expect(page.getByText('Ctrl + J')).toBeVisible();
      await expectNoAxeViolations(page);
    });

    test('admin turns on web push, sets smtp and turns off the invite (CT-32)', async ({
      page,
    }) => {
      await signIn(page, 'admin');
      await page.goto('/settings/instance');

      await page.getByRole('checkbox', { name: 'Notificações Web Push' }).check();
      await page.getByRole('checkbox', { name: 'Cadastro só com convite' }).uncheck();
      await page.getByLabel('Servidor SMTP').fill('smtp.casa.test');
      await page.getByLabel('Porta SMTP').fill('587');
      await page.getByLabel('Usuário SMTP').fill('atria');
      await page.getByLabel('Remetente').fill('atria@casa.test');
      await page.getByRole('button', { name: 'Salvar' }).click();
      await expect(page.getByText('Preferência salva.').first()).toBeVisible();
      await expect(page.locator('input[type="password"]')).toHaveCount(0);
      await expectNoAxeViolations(page);

      await page.reload();
      await expect(page.getByRole('checkbox', { name: 'Notificações Web Push' })).toBeChecked();
      await expect(
        page.getByRole('checkbox', { name: 'Cadastro só com convite' }),
      ).not.toBeChecked();
      await expect(page.getByLabel('Servidor SMTP')).toHaveValue('smtp.casa.test');
    });

    test('a regular user does not get the instance section (RN-12)', async ({ page }) => {
      await signIn(page, 'user');
      await page.goto('/settings/instance');
      await expect(
        page.getByText('Só o administrador altera as configurações da instância.'),
      ).toBeVisible();
      await expect(page.getByRole('link', { name: 'Instância' })).toHaveCount(0);
      await expectNoAxeViolations(page);
    });

    test('settings opens from the profile menu (PD-23)', async ({ page }) => {
      await signIn(page, 'user');
      await page.goto('/');
      await expect(
        page
          .getByRole('navigation', { name: 'Principal' })
          .getByRole('link', { name: 'Configurações' }),
      ).toHaveCount(0);
      await page.getByRole('button', { name: TEST_USER_NAME }).click();
      await page.getByRole('menuitem', { name: 'Configurações' }).click();
      await expect(page).toHaveURL(/\/settings$/);
      await expect(page.getByRole('heading', { level: 1, name: 'Configurações' })).toBeVisible();
      await expectNoAxeViolations(page);
    });

    test('hidden dashboard block disappears from the dashboard (PD-30)', async ({ page }) => {
      await signIn(page, 'user');
      await page.goto('/settings/dashboard');
      await page.getByRole('checkbox', { name: 'Leituras' }).uncheck();
      await page.goto('/');
      await expect(page.getByRole('heading', { name: 'Leituras' })).toHaveCount(0);
      await expect(page.getByRole('heading', { name: 'Tarefas de hoje' })).toBeVisible();
      await page.goto('/settings/dashboard');
      await page.getByRole('checkbox', { name: 'Leituras' }).check();
      await page.goto('/');
      await expect(page.getByRole('heading', { name: 'Leituras' })).toBeVisible();
      await expectNoAxeViolations(page);
    });
  });
}
