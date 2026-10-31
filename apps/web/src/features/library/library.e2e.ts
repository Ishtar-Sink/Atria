import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

// Fluxos ponta a ponta de CT-28 e CT-29. Rodam na TASK-35, com o servidor e as rotas do Acervo
// registradas: livro de 200 páginas criado pelo diálogo de tipo, com capa; registros de 20 e 30
// páginas; edição do primeiro para 25; progresso de 27,5%; PDF anexado e baixado; nota no
// histórico; artigo com status e nota; vídeo do YouTube com miniatura. Em 360 px e em desktop,
// com o axe no fim.

const SIZES = [
  { name: '360', width: 360, height: 760 },
  { name: 'desktop', width: 1280, height: 800 },
];

// PNG de 1x1 px e PDF mínimo, montados em memória para o envio.
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);
const PDF_MIN = Buffer.from(
  '%PDF-1.1\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF',
);

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

async function registerSession(page: Page, pages: string) {
  await page.getByRole('tab', { name: 'Histórico de leitura' }).click();
  await page.getByRole('link', { name: 'Registrar sessão' }).click();
  await page.getByLabel('Páginas lidas').fill(pages);
  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByRole('tab', { name: 'Histórico de leitura' })).toBeVisible();
}

for (const size of SIZES) {
  test.describe(`acervo em ${size.name}`, () => {
    test.use({ viewport: { width: size.width, height: size.height } });

    test('ct28 book with sessions shows 27.5 percent on the shelf and on the page', async ({
      page,
    }) => {
      await signIn(page);
      await page.goto('/library');
      await page.getByRole('button', { name: 'Novo' }).click();
      await page.getByRole('link', { name: /Livro/ }).click();
      await page.getByLabel('Título').fill('Dom Casmurro');
      await page.getByLabel('Páginas').fill('200');
      await page
        .getByLabel('Capa do livro', { exact: true })
        .and(page.locator('input'))
        .setInputFiles({ name: 'capa.png', mimeType: 'image/png', buffer: PNG_1X1 });
      await page
        .getByLabel('PDF (opcional)')
        .setInputFiles({ name: 'livro.pdf', mimeType: 'application/pdf', buffer: PDF_MIN });
      await page.getByRole('button', { name: 'Salvar' }).click();
      await expect(page.getByRole('heading', { level: 1, name: 'Dom Casmurro' })).toBeVisible();

      await registerSession(page, '20');
      await registerSession(page, '30');
      // Salvar a sessão volta à visão geral do livro: a edição fica no histórico.
      await page.getByRole('tab', { name: 'Histórico de leitura' }).click();
      // O histórico vem do mais recente: a primeira sessão registrada é a de 20 páginas.
      await page
        .getByRole('listitem')
        .filter({ hasText: /^20 páginas · / })
        .getByRole('link', { name: /^Editar sessão de/ })
        .click();
      await page.getByLabel('Páginas lidas').fill('25');
      await page.getByRole('button', { name: 'Salvar' }).click();
      await page.getByRole('tab', { name: 'Histórico de leitura' }).click();
      await expect(page.getByText(/^25 páginas · /)).toBeVisible();

      await page.getByRole('tab', { name: 'Visão geral' }).click();
      await expect(page.getByRole('progressbar', { name: 'Progresso de leitura' })).toHaveAttribute(
        'aria-valuenow',
        '27.5',
      );
      await page.getByRole('button', { name: 'Mais ações' }).click();
      const download = page.waitForEvent('download');
      await page.getByRole('menuitem', { name: 'Baixar PDF' }).click();
      await download;

      await page.getByRole('tab', { name: 'Notas' }).click();
      await page.getByLabel('Comentário').fill('Capítulo 3 é o melhor');
      await page.getByRole('button', { name: 'Adicionar nota' }).click();
      await expect(page.getByText('Capítulo 3 é o melhor')).toBeVisible();

      await page.goto('/library');
      await expect(
        page.getByRole('progressbar', { name: 'Progresso de Dom Casmurro' }),
      ).toHaveAttribute('aria-valuenow', '27.5');
      await expectNoHorizontalScroll(page);
      await expectNoAxeViolations(page);
    });

    test('ct29 article with status and note, and video with thumbnail on the shelf', async ({
      page,
    }) => {
      await signIn(page);
      await page.goto('/library?tab=articles');
      await page.getByRole('button', { name: 'Novo' }).click();
      await page.getByRole('link', { name: /Artigo/ }).click();
      await page.getByLabel('Título').fill('Sobre a atenção');
      await page.getByRole('radio', { name: 'Lendo' }).check();
      await page.getByRole('button', { name: 'Salvar' }).click();
      await expect(page.getByRole('heading', { level: 1, name: 'Sobre a atenção' })).toBeVisible();
      await page.getByRole('tab', { name: 'Notas' }).click();
      await page.getByLabel('Comentário').fill('Voltar ao segundo parágrafo');
      await page.getByRole('button', { name: 'Adicionar nota' }).click();
      await expect(page.getByText('Voltar ao segundo parágrafo')).toBeVisible();
      await expect(page.getByRole('progressbar')).toHaveCount(0);

      await page.goto('/library?tab=videos');
      await page.getByRole('button', { name: 'Novo' }).click();
      await page.getByRole('link', { name: /Vídeo/ }).click();
      await page.getByLabel('Endereço').fill('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
      await page.getByRole('button', { name: 'Salvar' }).click();
      // Espera o vídeo gravado (a tela do vídeo) antes de sair para a estante.
      await expect(page).toHaveURL(/\/library\/videos\/(?!new)[^/?]+(\?.*)?$/);
      await page.goto('/library?tab=videos');
      await expect(page.locator('img[src^="/api/v1/files/"]').first()).toBeVisible();
      await expectNoHorizontalScroll(page);
      await expectNoAxeViolations(page);
    });
  });
}
