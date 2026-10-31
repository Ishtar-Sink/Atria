import { expect, test } from '@playwright/test';
import { api, expectNoAxeViolations, signIn } from '../../app/e2e-session';
import { openPerson, withInstanceSettings } from './e2e-support';

// Fluxos ponta a ponta da administração (TASK-35). Os projetos do Playwright cobrem o desktop e
// as larguras de 720, 480 e 360 px; cada teste confere o axe no fim. O banco é compartilhado:
// cada teste cria as pessoas que usa e as procura pela busca da lista, nunca por posição.

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

test('admin grants elevated and elevated manages a user', async ({ page, browser }) => {
  const ana = await openPerson(browser);
  const bia = await openPerson(browser);
  const ana_email = escape(ana.me.email);
  const bia_email = escape(bia.me.email);
  await ana.close();
  await bia.close();

  await signIn(page, 'admin');
  await page.goto(`/admin/users?q=${encodeURIComponent(ana.me.email)}`);
  await page.getByRole('button', { name: new RegExp(`^Conceder elevado: ${ana_email}`) }).click();
  await expect(
    page.getByRole('button', { name: new RegExp(`^Retirar elevado: ${ana_email}`) }),
  ).toBeVisible();
  await expectNoAxeViolations(page);

  await signIn(page, 'elevated');
  await page.goto(`/admin/users?q=${encodeURIComponent(bia.me.email)}`);
  await expect(
    page.getByRole('button', { name: new RegExp(`^Desativar: ${bia_email}`) }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: /elevado/i })).toHaveCount(0);
  await page.getByRole('button', { name: new RegExp(`^Desativar: ${bia_email}`) }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Desativar' }).click();
  await expect(
    page.getByRole('button', { name: new RegExp(`^Reativar: ${bia_email}`) }),
  ).toBeVisible();
  await expectNoAxeViolations(page);
});

test('elevated cannot change instance settings', async ({ page }) => {
  await signIn(page, 'elevated');
  await page.goto('/admin/invites');
  await expect(page.getByRole('button', { name: 'Gerar convite' })).toBeVisible();
  await expect(page.getByRole('switch')).toHaveCount(0);
  await page.goto('/admin/instance');
  await expect(page.getByText('Versão', { exact: true })).toBeVisible();
  await expect(page.getByRole('switch')).toHaveCount(0);
  await expectNoAxeViolations(page);
});

test('sign-up works without invite when the requirement is off', async ({ page, browser }) => {
  // A exigência de convite é da instância inteira: a trava evita que outro projeto a mude no meio,
  // e no fim o cadastro volta a exigir convite.
  test.setTimeout(3 * 60_000);
  await withInstanceSettings(browser, async (_before, admin) => {
    // Ponto de partida conhecido: o cadastro exige convite.
    await api(admin, 'PATCH', '/admin/instance/settings', { invite_required: true });
    await signIn(page, 'admin');
    await page.goto('/admin/invites');
    const toggle = page.getByRole('switch', { name: 'Exigir convite para cadastro' });
    // O interruptor é otimista: o estado muda assim que a mutação começa (`onMutate` assíncrono).
    await expect(toggle).toBeChecked();
    await toggle.click();
    await expect(toggle).not.toBeChecked();
    await expectNoAxeViolations(page);

    await page.context().clearCookies();
    await page.goto('/sign-up');
    // Sem cookies, o formulário aparece antes de o primeiro GET devolver o token CSRF.
    await expect
      .poll(async () => (await page.context().cookies()).some((c) => c.name === 'atria_csrf'))
      .toBe(true);
    await page.getByLabel('E-mail').fill(`novo-${crypto.randomUUID()}@casa.test`);
    await page.getByLabel('Senha', { exact: true }).fill('uma-senha-bem-longa-123');
    await page.getByLabel('Repita a senha').fill('uma-senha-bem-longa-123');
    await page.getByRole('button', { name: /criar conta/i }).click();
    await expect(page).not.toHaveURL(/sign-up/);
  });
});
