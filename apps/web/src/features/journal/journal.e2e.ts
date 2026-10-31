import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

// Fluxo do CT-27. Roda na TASK-35, com as rotas de `createJournalRoutes` já registradas no app,
// em 360 px e em desktop (projetos do `playwright.config.ts`).

async function createEntry(page: Page, text: string, emotion: string, intensity: string) {
  await page.goto('/journal/new');
  await page.getByRole('textbox', { name: 'Texto' }).fill(text);
  await page.getByRole('checkbox', { name: emotion }).check();
  // O ponto é um rádio escondido: a área de toque dele fica por cima do chip.
  await page.getByRole('radio', { name: intensity }).first().check({ force: true });
  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByRole('heading', { level: 1, name: text })).toBeVisible();
}

test('two entries on the same day with emotions and a new emotion in the list', async ({
  page,
}) => {
  await createEntry(page, 'Manhã tranquila', 'Calma', '4 de 5');
  await createEntry(page, 'Tarde corrida', 'Ansiedade', '2 de 5');

  await page.goto('/journal');
  await expect(page.getByText('Manhã tranquila')).toBeVisible();
  await expect(page.getByText('Tarde corrida')).toBeVisible();

  await page.goto('/journal/emotions');
  await page.getByRole('textbox', { name: 'Nova emoção' }).fill('Orgulho');
  await page.getByRole('button', { name: 'Adicionar' }).click();
  const list = page.getByRole('list', { name: 'Lista de emoções' });
  await expect(list.getByText('Orgulho')).toBeVisible();

  await page.goto('/journal/new');
  await expect(page.getByRole('checkbox', { name: 'Orgulho' })).toBeVisible();

  const scan = await new AxeBuilder({ page }).analyze();
  expect(scan.violations).toEqual([]);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflow).toBe(false);
});
