import { expect, test, type Page } from '@playwright/test';
import { expectNoAxeViolations, signIn as signInAs } from '../../app/e2e-session';

// Fluxos ponta a ponta do dashboard (TASK-35). Cada teste entra com uma pessoa nova semeada com
// uma tarefa e um lembrete de hoje, uma movimentação, uma entrada de diário e um livro em leitura
// (`seed=dashboard`). Os projetos do Playwright cobrem o desktop e as larguras de 720, 480 e
// 360 px; cada teste confere o axe no fim.

async function signIn(page: Page) {
  await signInAs(page, 'user', 'dashboard');
}

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
  await page.goto('/');
  await expect(page.getByRole('region', { name: 'Leituras' })).toBeVisible();
  await page.goto('/settings/dashboard');
  await page.getByRole('checkbox', { name: 'Leituras' }).uncheck();
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Diário' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Leituras' })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Diário' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Leituras' })).toHaveCount(0);
  await expectNoAxeViolations(page);
});

test('completing a task removes it from today', async ({ page }) => {
  await signIn(page);
  await page.goto('/');
  const tasks = page.getByRole('region', { name: 'Tarefas de hoje' });
  const check = tasks.getByRole('button', { name: /^Concluir/ }).first();
  const label = (await check.getAttribute('aria-label')) ?? '';
  expect(label).not.toBe('');
  const completed = page.waitForResponse(
    (response) => response.request().method() === 'POST' && response.url().endsWith('/completion'),
  );
  await check.click();
  await expect(tasks.getByRole('button', { name: label })).toHaveCount(0);
  // A tela some com a tarefa na hora (otimista); o servidor precisa aceitar, senão ela volta.
  expect((await completed).ok()).toBe(true);
  await page.reload();
  await expect(page.getByRole('region', { name: 'Tarefas de hoje' })).toBeVisible();
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
