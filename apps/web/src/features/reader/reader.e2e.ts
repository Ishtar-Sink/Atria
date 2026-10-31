import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

// Fluxos ponta a ponta dos CT-35 a CT-38. Rodam na TASK-35, com o servidor, as rotas do leitor
// registradas e um livro e um artigo com PDF (o PDF de exemplo do protótipo, 62+ páginas).

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

async function goToPage(page: Page, number: number) {
  const field = page.getByLabel('Página atual');
  await field.fill(String(number));
  await field.press('Enter');
  await expect(field).toHaveValue(String(number));
}

async function closeReader(page: Page) {
  await page.getByRole('button', { name: /Fechar leitor/ }).click();
}

for (const size of SIZES) {
  test.describe(`leitor em ${size.name}`, () => {
    test.use({ viewport: { width: size.width, height: size.height } });

    test('CT-35 opens book and article, zooms, navigates, switches theme and resumes', async ({
      page,
    }) => {
      await signIn(page);
      await page.goto('/library/books/book-pdf/read');
      await expect(page.getByRole('toolbar', { name: 'Barra do leitor' })).toBeVisible();
      await expect(page.getByRole('navigation')).toHaveCount(0);
      await page.getByRole('button', { name: 'Aumentar zoom' }).click();
      await expect(page.getByRole('button', { name: /atual 125%/ })).toBeVisible();
      await page.getByRole('button', { name: 'Usar tema escuro no leitor' }).click();
      await expect(page.locator('[data-theme="dark"]').first()).toBeVisible();
      await goToPage(page, 12);
      await closeReader(page);
      await page.goto('/library/books/book-pdf/read');
      await expect(page.getByLabel('Página atual')).toHaveValue('12');

      await page.goto('/library/articles/article-pdf/read');
      await expect(page.getByRole('toolbar', { name: 'Barra do leitor' })).toBeVisible();
      await expectNoAxeViolations(page);
    });

    test('CT-36 offers the session with the pages read and keeps the resume page', async ({
      page,
    }) => {
      await signIn(page);
      for (const choice of ['confirm', 'correct', 'skip'] as const) {
        await page.goto('/library/books/book-pdf/read');
        await goToPage(page, 40);
        await closeReader(page);
        await page.goto('/library/books/book-pdf/read');
        await goToPage(page, 62);
        await closeReader(page);
        const dialog = page.getByRole('dialog');
        await expect(dialog).toContainText('da página 40 até a 62');
        await expect(dialog.getByLabel('Páginas lidas')).toHaveValue('22');
        if (choice === 'correct') await dialog.getByLabel('Páginas lidas').fill('30');
        if (choice === 'skip') await dialog.getByRole('button', { name: 'Agora não' }).click();
        else await dialog.getByRole('button', { name: 'Registrar sessão' }).click();
        if (choice === 'confirm') await expect(page.getByText('22 páginas')).toBeVisible();
        await page.goto('/library/books/book-pdf/read');
        await expect(page.getByLabel('Página atual')).toHaveValue('62');
      }
      await expectNoAxeViolations(page);
    });

    test('CT-37 creates passage notes with and without comment', async ({ page }) => {
      await signIn(page);
      await page.goto('/library/books/book-pdf/read');
      await page.getByRole('button', { name: 'Nota da página' }).click();
      await page.getByLabel('Comentário').fill('Figura importante');
      await page.getByRole('button', { name: 'Salvar nota' }).click();
      await expect(page.getByText(/Nota salva na página/)).toBeVisible();
      await page.getByRole('button', { name: 'Nota da página' }).click();
      await page.getByRole('button', { name: 'Salvar nota' }).click();
      await expect(page.getByText(/Nota salva na página/).first()).toBeVisible();
      await expectNoAxeViolations(page);
    });

    test('CT-38 highlights two colors, lists them and keeps download', async ({ page }) => {
      await signIn(page);
      await page.goto('/library/books/book-pdf/read');
      const layer = page.locator('[data-page="1"] span').first();
      for (const color of ['ciano', 'verde']) {
        await layer.dblclick();
        await page.getByRole('button', { name: `Destacar em ${color}` }).click();
      }
      await expect(page.getByRole('link', { name: 'Baixar' })).toBeVisible();
      await closeReader(page);
      await page.getByRole('tab', { name: 'Destaques' }).click();
      await expect(page.getByRole('listitem')).toHaveCount(2);
      await expectNoAxeViolations(page);
    });
  });
}
