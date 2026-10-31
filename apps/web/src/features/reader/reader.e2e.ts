import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

// Fluxos ponta a ponta dos CT-35 a CT-38. Rodam na TASK-35, com o servidor, as rotas do leitor
// registradas e um livro e um artigo com PDF de 64 páginas com texto, enviados pela API para a
// pessoa de cada teste (a instância é compartilhada: nada de ids fixos).

const SIZES = [
  { name: '360', width: 360, height: 760 },
  { name: 'desktop', width: 1280, height: 800 },
];

const PDF_PAGES = 64;

/** PDF com uma linha de texto por página, para a camada de texto (destaques) existir. */
function buildPdf(pages: number): Buffer {
  const objects: string[] = [];
  const page_ids = Array.from({ length: pages }, (_, index) => 4 + index * 2);
  objects[1] = '<</Type/Catalog/Pages 2 0 R>>';
  objects[2] = `<</Type/Pages/Kids[${page_ids.map((id) => `${String(id)} 0 R`).join(' ')}]/Count ${String(pages)}>>`;
  objects[3] = '<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>';
  page_ids.forEach((id, index) => {
    const text = `BT /F1 18 Tf 24 340 Td (Pagina ${String(index + 1)} do livro de teste) Tj ET`;
    objects[id] =
      `<</Type/Page/Parent 2 0 R/MediaBox[0 0 400 400]/Resources<</Font<</F1 3 0 R>>>>/Contents ${String(id + 1)} 0 R>>`;
    objects[id + 1] = `<</Length ${String(text.length)}>>stream\n${text}\nendstream`;
  });
  let body = '%PDF-1.4\n';
  const offsets: number[] = [];
  for (let id = 1; id < objects.length; id += 1) {
    offsets[id] = body.length;
    body += `${String(id)} 0 obj\n${objects[id] ?? ''}\nendobj\n`;
  }
  const xref = body.length;
  body += `xref\n0 ${String(objects.length)}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id += 1) {
    body += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
  }
  body += `trailer\n<</Size ${String(objects.length)}/Root 1 0 R>>\nstartxref\n${String(xref)}\n%%EOF\n`;
  return Buffer.from(body, 'latin1');
}

const PDF = buildPdf(PDF_PAGES);

interface Fixture {
  book: string;
  article: string;
}

async function csrf(page: Page): Promise<Record<string, string>> {
  const cookies = await page.context().cookies();
  const token = cookies.find((cookie) => cookie.name === 'atria_csrf')?.value;
  return token ? { 'X-CSRF-Token': token } : {};
}

async function createWithPdf(page: Page, kind: 'books' | 'articles', body: unknown) {
  const headers = await csrf(page);
  const created = await page.request.post(`/api/v1/${kind}`, { data: body, headers });
  expect(created.ok(), await created.text()).toBe(true);
  const { id } = (await created.json()) as { id: string };
  const upload = await page.request.put(`/api/v1/${kind}/${id}/pdf`, {
    data: PDF,
    headers: { ...headers, 'Content-Type': 'application/octet-stream' },
  });
  expect(upload.ok(), await upload.text()).toBe(true);
  return id;
}

/** Pessoa nova com um livro e um artigo com PDF, criados pela API (a tela de cadastro é do Acervo). */
async function signIn(page: Page): Promise<Fixture> {
  await page.goto('/__test__/sign-in?role=user');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  const book = await createWithPdf(page, 'books', {
    title: 'Livro com PDF',
    page_count: PDF_PAGES,
  });
  const article = await createWithPdf(page, 'articles', { title: 'Artigo com PDF' });
  return { book, article };
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

/** Texto da camada de texto da página 1 (as marcas de destaque também são `span`). */
function passage(page: Page) {
  return page
    .getByRole('region', { name: 'Página 1', exact: true })
    .getByText('Pagina 1 do livro de teste');
}

/** Fecha e espera o fim do fechamento: a página de saída gravada (aviso) ou a oferta de sessão. */
async function closeReader(page: Page) {
  await page.getByRole('button', { name: /Fechar leitor/ }).click();
  await expect(
    page
      .getByRole('dialog')
      .or(page.getByText(/^Página \d+ guardada\.$/))
      .first(),
  ).toBeVisible();
}

for (const size of SIZES) {
  test.describe(`leitor em ${size.name}`, () => {
    test.use({ viewport: { width: size.width, height: size.height } });

    test('CT-35 opens book and article, zooms, navigates, switches theme and resumes', async ({
      page,
    }) => {
      const { book, article } = await signIn(page);
      await page.goto(`/library/books/${book}/read`);
      await expect(page.getByRole('toolbar', { name: 'Barra do leitor' })).toBeVisible();
      await expect(page.getByRole('navigation')).toHaveCount(0);
      await page.getByRole('button', { name: 'Aumentar zoom' }).click();
      await expect(page.getByRole('button', { name: /^Zoom 125%/ })).toBeVisible();
      await page.getByRole('button', { name: 'Usar tema escuro no leitor' }).click();
      await expect(page.locator('[data-theme="dark"]').first()).toBeVisible();
      await goToPage(page, 12);
      await closeReader(page);
      await page.goto(`/library/books/${book}/read`);
      await expect(page.getByLabel('Página atual')).toHaveValue('12');

      await page.goto(`/library/articles/${article}/read`);
      await expect(page.getByRole('toolbar', { name: 'Barra do leitor' })).toBeVisible();
      await expectNoAxeViolations(page);
    });

    test('CT-36 offers the session with the pages read and keeps the resume page', async ({
      page,
    }) => {
      const { book } = await signIn(page);
      for (const choice of ['confirm', 'correct', 'skip'] as const) {
        await page.goto(`/library/books/${book}/read`);
        await goToPage(page, 40);
        await closeReader(page);
        await page.goto(`/library/books/${book}/read`);
        await goToPage(page, 62);
        await closeReader(page);
        const dialog = page.getByRole('dialog');
        await expect(dialog).toContainText('da página 40 até a 62');
        await expect(dialog.getByLabel('Páginas lidas')).toHaveValue('22');
        if (choice === 'correct') await dialog.getByLabel('Páginas lidas').fill('30');
        if (choice === 'skip') await dialog.getByRole('button', { name: 'Agora não' }).click();
        else await dialog.getByRole('button', { name: 'Registrar sessão' }).click();
        if (choice === 'confirm') await expect(page.getByText('22 páginas')).toBeVisible();
        await page.goto(`/library/books/${book}/read`);
        await expect(page.getByLabel('Página atual')).toHaveValue('62');
      }
      await expectNoAxeViolations(page);
    });

    test('CT-37 creates passage notes with and without comment', async ({ page }) => {
      const { book } = await signIn(page);
      await page.goto(`/library/books/${book}/read`);
      // CT-37: a nota nasce de um trecho selecionado; o comentário é opcional (RN-24).
      for (const comment of ['Figura importante', undefined]) {
        await passage(page).dblclick();
        await page
          .getByRole('toolbar', { name: 'Ações do trecho selecionado' })
          .getByRole('button', { name: 'Criar nota' })
          .click();
        if (comment) await page.getByLabel(/^Comentário/).fill(comment);
        const saved = page.waitForResponse(
          (response) =>
            response.request().method() === 'POST' && response.url().endsWith('/book-notes'),
        );
        await page.getByRole('button', { name: 'Salvar nota' }).click();
        const response = await saved;
        expect(response.status()).toBe(201);
        const note = (await response.json()) as {
          quote: string | null;
          page: number;
          comment: string | null;
        };
        expect(note.quote).toBeTruthy();
        expect(note.page).toBe(1);
        expect(note.comment).toBe(comment ?? null);
        await expect(page.getByText(/Nota salva na página 1/).first()).toBeVisible();
      }
      await expectNoAxeViolations(page);
    });

    test('CT-38 highlights two colors, lists them and keeps download', async ({ page }) => {
      const { book } = await signIn(page);
      await page.goto(`/library/books/${book}/read`);
      for (const color of ['ciano', 'verde']) {
        await passage(page).dblclick();
        await page.getByRole('button', { name: `Destacar em ${color}` }).click();
      }
      await expect(page.getByRole('link', { name: 'Baixar' })).toBeVisible();
      await closeReader(page);
      await page.getByRole('tab', { name: 'Destaques' }).click();
      // A trilha (breadcrumb) também é lista: conta só os itens da lista de destaques.
      await expect(
        page.getByRole('list', { name: 'Destaques do item' }).getByRole('listitem'),
      ).toHaveCount(2);
      await expectNoAxeViolations(page);
    });
  });
}
