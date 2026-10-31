import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

// Fluxo ponta a ponta de CT-13. Roda na TASK-35, com o servidor e as rotas das features
// registradas e a aba Conexões montada nas telas de nota e de meta: a pessoa liga uma nota a uma
// meta, vê a ligação nos dois lados, filtra e agrupa a aba, remove pela meta e vê que a ligação
// some dos dois lados — em 360 px e em desktop, com o axe no fim.

const SIZES = [
  { name: '360', width: 360, height: 760 },
  { name: 'desktop', width: 1280, height: 800 },
];

async function signIn(page: Page) {
  await page.goto('/__test__/sign-in?role=user');
}

async function expectNoAxeViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
}

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflow).toBe(false);
}

async function createNote(page: Page, title: string) {
  await page.goto('/notes/new');
  await page.getByLabel('Título').fill(title);
  await page.getByLabel('Texto').fill('Lisboa em março.');
  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
}

async function createGoal(page: Page, title: string) {
  await page.goto('/goals/new');
  await page.getByLabel('Título').fill(title);
  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
}

for (const size of SIZES) {
  test.describe(`conexões em ${size.name}`, () => {
    test.use({ viewport: { width: size.width, height: size.height } });

    test('note is linked to a goal, seen on both sides and removed', async ({ page }) => {
      await signIn(page);
      await createGoal(page, 'Viajar para Portugal');
      const goal_url = page.url();
      await createNote(page, 'Ideias de viagem');
      const note_url = page.url();

      // Liga a nota à meta, a partir da aba Conexões da nota.
      await page.goto(`${note_url}?tab=connections`);
      await page.getByRole('link', { name: 'Conectar com' }).click();
      await page.getByRole('searchbox', { name: 'Buscar item para ligar' }).fill('Viajar');
      await page.getByRole('button', { name: 'Conectar com Viajar para Portugal' }).click();
      await expect(page).toHaveURL(/tab=connections/);
      await expect(page.getByRole('link', { name: 'Viajar para Portugal' })).toBeVisible();

      // O outro lado: a meta mostra a nota.
      await page.goto(`${goal_url}?tab=connections`);
      await expect(page.getByRole('link', { name: 'Ideias de viagem' })).toBeVisible();

      // Filtro, agrupamento e busca da aba.
      await page.getByLabel('Categoria').click();
      await page.getByRole('option', { name: 'Notas' }).click();
      await expect(page.getByRole('link', { name: 'Ideias de viagem' })).toBeVisible();
      await page
        .getByRole('group', { name: 'Visualização' })
        .getByRole('button', { name: 'Data' })
        .click();
      await expect(page.getByRole('heading', { level: 3 })).toHaveCount(1);
      await page.getByRole('searchbox', { name: 'Busca' }).fill('zzz');
      await expect(page.getByText('Nenhuma conexão encontrada')).toBeVisible();
      await page.getByRole('searchbox', { name: 'Busca' }).fill('');

      await expectNoHorizontalScroll(page);
      await expectNoAxeViolations(page);

      // Remove pela meta: some dos dois lados.
      await page.getByRole('button', { name: 'Remover ligação com Ideias de viagem' }).click();
      await page.getByRole('alertdialog').getByRole('button', { name: 'Remover ligação' }).click();
      await expect(page.getByRole('link', { name: 'Ideias de viagem' })).toHaveCount(0);

      await page.goto(`${note_url}?tab=connections`);
      await expect(page.getByRole('link', { name: 'Viajar para Portugal' })).toHaveCount(0);
      await expect(page.getByText('Nenhuma conexão')).toBeVisible();
    });
  });
}
