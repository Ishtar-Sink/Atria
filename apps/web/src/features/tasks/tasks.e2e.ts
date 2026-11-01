import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

// Fluxos de CT-24. Rodam na TASK-35, com as rotas de `createTasksRoutes` já registradas no app,
// em 360 px e em desktop (projetos do `playwright.config.ts`).

async function createTask(page: Page, title: string, recurring: boolean) {
  await page.goto('/tasks/new');
  await page.getByRole('textbox', { name: 'Título' }).fill(title);
  if (recurring) {
    await page.getByRole('radio', { name: 'Recorrente' }).check();
  }
  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
}

// A sessão do projeto `*-session` é a mesma pessoa em todas as larguras e execuções: cada
// teste cria a sua tarefa com um título único.
const unique = (title: string) => `${title} ${String(Date.now())}`;

test('single task is completed and reopened', async ({ page }) => {
  const title = unique('Pagar a conta de luz');
  await createTask(page, title, false);
  await page.goto('/tasks?status=all');

  const complete = page.getByRole('button', { name: `Concluir: ${title}` });
  await complete.click();
  const reopen = page.getByRole('button', { name: `Reabrir: ${title}` });
  await expect(reopen).toHaveAttribute('aria-pressed', 'true');

  await reopen.click();
  await expect(complete).toHaveAttribute('aria-pressed', 'false');

  const scan = await new AxeBuilder({ page }).analyze();
  expect(scan.violations).toEqual([]);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflow).toBe(false);
});

test('daily task completes only today occurrence', async ({ page }) => {
  const title = unique('Alongamento da manhã');
  await createTask(page, title, true);

  await page.getByRole('tab', { name: 'Ocorrências' }).click();
  const panel = page.getByRole('tabpanel');
  await expect(panel.getByRole('listitem')).toHaveCount(7);
  await panel.getByRole('button', { name: `Concluir hoje: ${title}` }).click();
  await expect(panel.getByRole('button', { name: `Reabrir hoje: ${title}` })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  // Só a ocorrência de hoje muda: as dos outros dias seguem abertas.
  await expect(panel.locator('[aria-pressed="true"]')).toHaveCount(1);

  const scan = await new AxeBuilder({ page }).analyze();
  expect(scan.violations).toEqual([]);
});

async function createWeekly(page: Page, title: string) {
  await page.goto('/tasks/new');
  await page.getByRole('textbox', { name: 'Título' }).fill(title);
  await page.getByRole('radio', { name: 'Recorrente' }).check();
  await page.getByRole('button', { name: /^Frequência/ }).click();
  await page.getByRole('option', { name: 'Semanal' }).click();
  await page.getByRole('checkbox', { name: 'segunda-feira' }).check();
  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
}

test('ct34 saves a daily task without time', async ({ page }) => {
  const title = unique('Beber água');
  await createTask(page, title, true);

  await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
  await expect(page.getByText('Tarefa criada.')).toBeVisible();
});

test('ct36 warns about a single task for tomorrow outside today', async ({ page }) => {
  const title = unique('Levar o carro à revisão');
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const day = new Intl.DateTimeFormat('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(tomorrow);
  await page.goto('/tasks/new');
  await page.getByRole('textbox', { name: 'Título' }).fill(title);
  await page.getByRole('button', { name: /^Data/ }).click();
  await page.getByRole('button', { name: day }).click();
  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();

  await page.goto('/tasks');
  const notice = page.getByRole('status').filter({ hasText: 'em outros dias' });
  await expect(notice).toContainText(/Há \d+ tarefas? abertas? em outros dias\./);
  await expect(page.getByText(title)).toHaveCount(0);

  await notice.getByRole('button', { name: 'Ver todas as datas' }).click();
  await expect(page.getByText(title)).toBeVisible();
});

test('ct37 lists one row per task in all', async ({ page }) => {
  const daily = unique('Alongamento diário');
  const weekly = unique('Revisão semanal');
  const single = unique('Pagar a conta');
  await createTask(page, daily, true);
  await createWeekly(page, weekly);
  await createTask(page, single, false);

  await page.goto('/tasks?range=all');
  for (const title of [daily, weekly, single]) {
    await expect(page.getByText(title)).toHaveCount(1);
  }
});
