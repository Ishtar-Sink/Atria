import { expect, test, type Page } from '@playwright/test';
import type { Schemas } from '@atria/contracts';
import { api, expectNoAxeViolations, signIn } from '../../app/e2e-session';
import { withInstanceSettings } from '../admin/e2e-support';

// Fluxos ponta a ponta de Configurações (CT-31 e CT-32), na TASK-35. Os projetos do Playwright
// cobrem o desktop e as larguras de 720, 480 e 360 px; cada teste entra com uma pessoa nova do
// papel pedido e confere o axe no fim.

/** O atalho gravado, no grupo "Atalho da paleta" (o anúncio para leitor de tela repete o texto). */
function paletteShortcut(page: Page) {
  return page.getByRole('group', { name: 'Atalho da paleta' }).getByText('Ctrl + J', {
    exact: true,
  });
}

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
  // A tela muda na hora (otimista); antes de sair, espera o servidor gravar o atalho, senão a
  // navegação seguinte cancela o PATCH.
  const saved = page.waitForResponse(
    (response) =>
      response.request().method() === 'PATCH' &&
      response.url().endsWith('/api/v1/me/preferences') &&
      (response.request().postData() ?? '').includes('palette_shortcut'),
  );
  await page.keyboard.press('Control+J');
  await expect(paletteShortcut(page)).toBeVisible();
  expect((await saved).ok()).toBe(true);

  await page.goto('/settings/search');
  const contexts_saved = page.waitForResponse(
    (response) =>
      response.request().method() === 'PATCH' &&
      response.url().endsWith('/api/v1/me/preferences') &&
      (response.request().postData() ?? '').includes('search_contexts'),
  );
  await page.getByRole('button', { name: 'Notas' }).click();
  await expect(page.getByRole('button', { name: 'Notas' })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  expect((await contexts_saved).ok()).toBe(true);
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
  await expect(paletteShortcut(page)).toBeVisible();
  await expectNoAxeViolations(page);
});

test('admin turns on web push, sets smtp and turns off the invite (CT-32)', async ({
  page,
  browser,
}) => {
  // Configurações da instância inteira: a trava evita outro projeto no meio, e no fim voltam os
  // valores de antes (com o convite exigido).
  test.setTimeout(3 * 60_000);
  await withInstanceSettings(browser, async (before, admin) => {
    // Ponto de partida conhecido: o cadastro exige convite e o Web Push está desligado.
    await api(admin, 'PATCH', '/admin/instance/settings', {
      invite_required: true,
      web_push_enabled: false,
    });
    await signIn(page, 'admin');
    // Sem a chave VAPID no servidor, o Web Push não pode ser ligado: a tela mostra o aviso e o
    // teste registra a lacuna (o servidor dos e2e a recebe por `docker-compose.e2e.yml`).
    const web_push_available = before.web_push_configured;
    await page.goto('/settings/instance');
    const web_push = page.getByRole('checkbox', { name: 'Notificações Web Push' });

    if (web_push_available) {
      await web_push.click();
      await expect(web_push).toBeChecked();
    } else {
      test.info().annotations.push({
        type: 'lacuna',
        description: 'servidor dos e2e sem ATRIA_WEB_PUSH_VAPID_KEY_FILE: Web Push não ligado',
      });
      await expect(web_push).toBeDisabled();
      await expect(page.getByText(/não tem a chave VAPID configurada/)).toBeVisible();
    }
    // Os interruptores são otimistas: o estado muda quando a mutação começa (`onMutate` assíncrono).
    const invite = page.getByRole('checkbox', { name: 'Cadastro só com convite' });
    await expect(invite).toBeChecked();
    await invite.click();
    await expect(invite).not.toBeChecked();
    await page.getByLabel('Servidor SMTP').fill('smtp.casa.test');
    await page.getByLabel('Porta SMTP').fill('587');
    await page.getByLabel('Usuário SMTP').fill('atria');
    await page.getByLabel('Remetente').fill('atria@casa.test');
    await page.getByRole('button', { name: 'Salvar' }).click();
    await expect(page.getByText('Preferência salva.').first()).toBeVisible();
    await expect(page.locator('input[type="password"]')).toHaveCount(0);
    // Sem animação: o axe não mede a cor do botão no meio da transição de "salvando" para o normal.
    await expect(page.getByRole('button', { name: 'Salvar' })).toBeEnabled();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expectNoAxeViolations(page);

    await page.reload();
    if (web_push_available) await expect(web_push).toBeChecked();
    await expect(page.getByRole('checkbox', { name: 'Cadastro só com convite' })).not.toBeChecked();
    await expect(page.getByLabel('Servidor SMTP')).toHaveValue('smtp.casa.test');
  });
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
  // O botão do perfil leva o e-mail da pessoa (sem `display_name`) como nome acessível.
  const me = await api<Schemas['MeResponse']>(page, 'GET', '/me');
  await page.goto('/');
  // Até 720 px a sidebar é uma gaveta: abre pelo botão "Abrir menu".
  const drawer = page.getByRole('button', { name: 'Abrir menu' });
  if (await drawer.isVisible()) await drawer.click();
  await expect(
    page
      .getByRole('navigation', { name: 'Principal' })
      .getByRole('link', { name: 'Configurações' }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: me.email, exact: true }).click();
  await page.getByRole('menuitem', { name: 'Configurações' }).click();
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Configurações' })).toBeVisible();
  await expectNoAxeViolations(page);
});

test('hidden dashboard block disappears from the dashboard (PD-30)', async ({ page }) => {
  // O bloco "Leituras" só aparece com um livro em leitura: a pessoa vem com os dados do dashboard.
  await signIn(page, 'user', 'dashboard');
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Leituras' })).toBeVisible();
  await page.goto('/settings/dashboard');
  await page.getByRole('checkbox', { name: 'Leituras' }).uncheck();
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Tarefas de hoje' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Leituras' })).toHaveCount(0);
  await page.goto('/settings/dashboard');
  await page.getByRole('checkbox', { name: 'Leituras' }).check();
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Leituras' })).toBeVisible();
  await expectNoAxeViolations(page);
});
