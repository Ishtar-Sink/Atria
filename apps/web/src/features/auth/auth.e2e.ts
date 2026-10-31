import { expect, test, type Page } from '@playwright/test';
import type { Schemas } from '@atria/contracts';
import { E2E_PASSWORD } from '../../app/e2e-sign-in-plugin';
import { api, expectNoAxeViolations } from '../../app/e2e-session';
import { totpCode } from '../../app/e2e-totp';
import { openPerson } from '../admin/e2e-support';

// Rodam na TASK-35, com as rotas registradas e o servidor no ar. Os projetos do Playwright cobrem
// o desktop e as larguras de 720, 480 e 360 px; cada fluxo termina com o axe sem violações. O
// banco é compartilhado: convites, pessoas com 2FA e links de redefinição são preparados pela
// API, com o admin de teste, num contexto à parte da página do teste.

const PASSWORD = 'senha-bem-longa-1';

function unique_email(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}@exemplo.com`;
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

/** Caminho relativo de um link devolvido pela API (o servidor monta com `ATRIA_PUBLIC_URL`). */
/**
 * Abre a tela e espera o token CSRF: sem cookies, o formulário aparece antes de o primeiro GET
 * (`/me`) responder, e um envio nesse meio-tempo volta 403 em vez de chegar ao servidor. Sob
 * carga, o preenchimento do Playwright chega antes.
 */
async function openPage(page: Page, path: string) {
  await page.goto(path);
  await expect
    .poll(async () => (await page.context().cookies()).some((c) => c.name === 'atria_csrf'))
    .toBe(true);
}

function relative(link: string): string {
  const url = new URL(link, 'http://localhost');
  return `${url.pathname}${url.search}`;
}

test('first run creates the admin and requires two-factor', async ({ page }) => {
  // O primeiro acesso só existe numa instância sem ninguém. Nos e2e o admin de teste já existe:
  // aí a prova é que `/setup` não abre mais e leva ao login; numa instância vazia, o fluxo todo.
  const status = await api<Schemas['SetupStatus']>(page, 'GET', '/setup');
  if (!status.required) {
    test.info().annotations.push({
      type: 'lacuna',
      description: 'instância já configurada: só o redirecionamento de /setup é conferido',
    });
    await openPage(page, '/setup');
    await expect(page).toHaveURL(/\/sign-in$/);
    await expectNarrowCard(page);
    await expectNoAxeViolations(page);
    return;
  }
  await openPage(page, '/setup');
  await expectNarrowCard(page);
  await page.getByLabel('E-mail').fill(unique_email('admin'));
  await fillPasswords(page, PASSWORD);
  await page.getByRole('button', { name: 'Criar conta' }).click();
  await expect(page).toHaveURL(/\/two-factor$/);
  await expect(page.getByRole('img', { name: /QR code/ })).toBeVisible();
  await expectNoAxeViolations(page);
  await openPage(page, '/setup');
  await expect(page).toHaveURL(/\/sign-in$/);
});

test('invite sign-up works once', async ({ page, browser }, testInfo) => {
  const admin = await openPerson(browser, 'admin');
  const invite = await api<Schemas['InviteResponse']>(admin.page, 'POST', '/admin/invites');
  await admin.close();
  const link = relative(invite.link);

  await openPage(page, link);
  await expectNarrowCard(page);
  await page.getByLabel('E-mail').fill(unique_email('membro'));
  await fillPasswords(page, PASSWORD);
  await page.getByRole('button', { name: 'Criar conta' }).click();
  await expect(page).not.toHaveURL(/\/sign-up/);

  // O convite usado de novo é recusado. Cada recusa conta no limite de cadastros por IP do
  // servidor, que é o mesmo para todos os e2e (e o cadastro bem-sucedido não zera a contagem):
  // a segunda tentativa roda só no desktop para não travar o cadastro dos outros testes.
  if (testInfo.project.name !== 'desktop') {
    await expectNoAxeViolations(page);
    return;
  }
  await page.context().clearCookies();
  await openPage(page, link);
  await page.getByLabel('E-mail').fill(unique_email('segundo'));
  await fillPasswords(page, PASSWORD);
  await page.getByRole('button', { name: 'Criar conta' }).click();
  await expect(
    page.getByRole('alert').filter({ hasText: 'Este convite não vale mais' }),
  ).toBeVisible();
  await expectNoAxeViolations(page);
});

test('sign-in requires the totp code after activation', async ({ page, browser }) => {
  // Uma pessoa nova ativa o 2FA pela API; a tela de login então pede o código.
  const person = await openPerson(browser);
  const enrollment = await api<Schemas['TotpEnrollmentResponse']>(
    person.page,
    'POST',
    '/auth/totp',
  );
  await api(person.page, 'POST', '/auth/totp/activation', {
    code: await totpCode(enrollment.secret),
  });
  await person.close();
  const wrong = (await totpCode(enrollment.secret)) === '000000' ? '111111' : '000000';

  await openPage(page, '/sign-in');
  await expectNarrowCard(page);
  await page.getByLabel('E-mail').fill(person.me.email);
  await page.getByLabel('Senha', { exact: true }).fill(E2E_PASSWORD);
  await page.getByRole('button', { name: 'Entrar' }).click();
  const code = page.getByLabel('Código de 6 números');
  await expect(code).toBeVisible();
  await expect(code).toBeFocused();
  await code.fill(wrong);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(
    page.getByRole('alert').filter({ hasText: 'Este código não confere' }),
  ).toBeVisible();
  await expectNoAxeViolations(page);
});

test('admin reset link works once', async ({ page, browser }) => {
  const person = await openPerson(browser);
  await person.close();
  const admin = await openPerson(browser, 'admin');
  const reset = await api<Schemas['PasswordResetLinkResponse']>(
    admin.page,
    'POST',
    '/admin/password-resets',
    { user_id: person.me.id },
  );
  await admin.close();
  const link = relative(reset.link);

  await openPage(page, link);
  await expectNarrowCard(page);
  await fillPasswords(page, 'nova-senha-bem-longa-2');
  await page.getByRole('button', { name: 'Redefinir senha' }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
  await openPage(page, link);
  await fillPasswords(page, 'nova-senha-bem-longa-3');
  await page.getByRole('button', { name: 'Redefinir senha' }).click();
  await expect(
    page.getByRole('alert').filter({ hasText: 'Este link não vale mais' }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Pedir outro link' })).toBeVisible();
  await expectNoAxeViolations(page);
});
