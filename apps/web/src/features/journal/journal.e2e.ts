import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

// Fluxo do CT-27. Roda na TASK-35, com as rotas de `createJournalRoutes` já registradas no app,
// em 360 px e em desktop (projetos do `playwright.config.ts`).

async function createEntry(page: Page, text: string, emotion: string, intensity: string) {
  await page.goto('/journal/new');
  await page.getByRole('textbox', { name: 'Texto' }).fill(text);
  await page.getByRole('checkbox', { name: emotion }).check();
  // O ponto é um rádio escondido: a área de toque dele fica por cima do chip.
  await page
    .getByRole('radiogroup', { name: `Intensidade de ${emotion}` })
    .getByRole('radio', { name: intensity })
    .check({ force: true });
  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByRole('heading', { level: 1, name: text })).toBeVisible();
}

test('two entries on the same day with emotions and a new emotion in the list', async ({
  page,
}) => {
  // A sessão do projeto `*-session` é a mesma pessoa em todas as larguras e execuções: os
  // textos e a emoção nova levam um sufixo único.
  const suffix = String(Date.now());
  const morning = `Manhã tranquila ${suffix}`;
  const afternoon = `Tarde corrida ${suffix}`;
  const emotion = `Orgulho ${suffix}`;
  await createEntry(page, morning, 'Calma', '4 de 5');
  await createEntry(page, afternoon, 'Ansiedade', '2 de 5');

  await page.goto('/journal');
  await expect(page.getByText(morning)).toBeVisible();
  await expect(page.getByText(afternoon)).toBeVisible();

  await page.goto('/journal/emotions');
  await page.getByRole('textbox', { name: 'Nova emoção' }).fill(emotion);
  // A lista mostra a emoção na hora (otimista); o `goto` seguinte recarrega a página e cancelaria
  // o POST ainda em andamento.
  const created = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' && response.url().endsWith('/api/v1/emotions'),
  );
  await page.getByRole('button', { name: 'Adicionar' }).click();
  const list = page.getByRole('list', { name: 'Lista de emoções' });
  await expect(list.getByText(emotion)).toBeVisible();
  expect((await created).ok()).toBe(true);

  await page.goto('/journal/new');
  await expect(page.getByRole('checkbox', { name: emotion })).toBeVisible();

  const scan = await new AxeBuilder({ page }).analyze();
  expect(scan.violations).toEqual([]);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflow).toBe(false);
});
