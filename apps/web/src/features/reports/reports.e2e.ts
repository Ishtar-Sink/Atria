import { expect, test, type Page } from '@playwright/test';
import {
  api,
  expectNoAxeViolations,
  expectNoHorizontalScroll,
  signIn,
} from '../../app/e2e-session';

// Fluxos ponta a ponta de CT-33 e CT-34. Rodam na TASK-35, com o servidor e as rotas de Relatórios
// registradas: a pessoa gera cada relatório com os seus filtros, abre a versão interativa, exporta o
// PDF e baixa todos os dados em JSON e CSV — em 360 px e em desktop, com o axe no fim.

const SIZES = [
  { name: '360', width: 360, height: 760 },
  { name: 'desktop', width: 1280, height: 800 },
];

const REPORTS = [
  { id: 'fin-flow', title: 'Entradas e saídas', period: true, filters: ['Conta'] },
  { id: 'fin-cat', title: 'Gastos por categoria', period: true, filters: ['Conta', 'Categoria'] },
  { id: 'fin-diff', title: 'Economias e perdas', period: true, filters: ['Conta'] },
  { id: 'read-pages', title: 'Páginas lidas', period: true, filters: ['Livro'] },
  { id: 'lib-status', title: 'Acervo por status', period: false, filters: ['Tipo'] },
  { id: 'journal-emo', title: 'Emoções do diário', period: true, filters: ['Emoção'] },
  {
    id: 'goals-progress',
    title: 'Progresso das metas',
    period: false,
    filters: ['Meta', 'Status'],
  },
  { id: 'tasks-done', title: 'Tarefas concluídas', period: false, filters: [] },
  { id: 'proj-cards', title: 'Cartões por projeto', period: false, filters: ['Projeto'] },
];

/**
 * O axe só com a tela parada: a transição de cor do botão (hover do ponteiro, ou a volta de
 * desabilitado) dava contraste falso no meio do caminho.
 */
async function expectAccessible(page: Page) {
  await page.mouse.move(0, 0);
  // "Gerar relatório" fica desabilitado enquanto o resultado carrega e volta com transição de cor.
  await page.waitForLoadState('networkidle');
  const generate = page.getByRole('button', { name: 'Gerar relatório' });
  if ((await generate.count()) > 0) await expect(generate).toBeEnabled();
  await expect.poll(() => page.evaluate(() => document.getAnimations().length)).toBe(0);
  await expectNoAxeViolations(page);
}

const PERIOD_REPORTS = REPORTS.filter((report) => report.period);

for (const size of SIZES) {
  test.describe(`relatorios em ${size.name}`, () => {
    test.use({ viewport: { width: size.width, height: size.height } });

    test('catalog lists the nine reports and each one has its filters', async ({ page }) => {
      await signIn(page);
      await page.goto('/reports');
      for (const report of REPORTS) {
        await expect(page.getByRole('link', { name: report.title })).toBeVisible();
      }
      for (const report of REPORTS) {
        await page.goto(`/reports/${report.id}`);
        await expect(page.getByRole('heading', { name: 'Filtros' })).toBeVisible();
        await expect(page.getByRole('button', { name: /Período/ })).toHaveCount(
          report.period ? 1 : 0,
        );
        for (const filter of report.filters) {
          await expect(page.getByRole('button', { name: new RegExp(`^${filter} `) })).toBeVisible();
        }
        await expect(page.getByText('Escolha os filtros')).toBeVisible();
      }
      await expectNoHorizontalScroll(page);
      await expectAccessible(page);
    });

    test('period reports generate in a custom range and export the pdf', async ({ page }) => {
      await signIn(page);
      for (const report of PERIOD_REPORTS) {
        await page.goto(`/reports/${report.id}`);
        await page.getByRole('button', { name: /Período/ }).click();
        // O intervalo personalizado fica no próprio diálogo, no calendário abaixo dos atalhos.
        const dialog = page.getByRole('dialog', { name: 'Escolher período' });
        await dialog.getByRole('button', { name: /^1 de/ }).first().click();
        await dialog
          .getByRole('button', { name: /^10 de/ })
          .first()
          .click();
        await dialog.getByRole('button', { name: 'Aplicar' }).click();
        await page.getByRole('button', { name: 'Gerar relatório' }).click();
        await expect(page).toHaveURL(/run=1/);
        await expect(page.getByText('Escolha os filtros')).toHaveCount(0);

        const popup = page.waitForEvent('popup');
        await page.getByRole('link', { name: 'Abrir em nova aba' }).click();
        expect((await popup).url()).toContain(`/api/v1/reports/${report.id}`);

        const download = page.waitForEvent('download');
        await page.getByRole('button', { name: 'Exportar PDF' }).click();
        expect((await download).suggestedFilename()).toMatch(/\.pdf$/);
      }
      await expectNoHorizontalScroll(page);
      await expectAccessible(page);
    });

    test('a period report generates in any period', async ({ page }) => {
      await signIn(page);
      await page.goto('/reports/fin-flow');
      await page.getByRole('button', { name: /Período/ }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Qualquer período' }).click();
      await page.getByRole('button', { name: 'Gerar relatório' }).click();
      await expect(page.getByText(/Qualquer período · /)).toBeVisible();
      await expectAccessible(page);
    });

    test('a link from an entity opens filtered, generated and in any period', async ({ page }) => {
      await signIn(page);
      // A pessoa nova não tem categoria: a do filtro é preparada pela API.
      const category = `Mercado ${String(Date.now())}`;
      await api(page, 'POST', '/categories', { name: category, kind: 'expense', color: 'primary' });
      await page.goto('/reports/fin-cat');
      await page.getByRole('button', { name: /^Categoria / }).click();
      await page.getByRole('option', { name: category }).click();
      await page.getByRole('button', { name: 'Gerar relatório' }).click();
      const entity_link = page.url().replace(/period=[^&]*&?/, '');
      await page.goto(entity_link);
      await expect(page.getByRole('button', { name: /Período/ })).toContainText('Qualquer período');
      await expect(page.getByText('Escolha os filtros')).toHaveCount(0);
      await expectAccessible(page);
    });

    test('exports all user data as json and csv', async ({ page }) => {
      await signIn(page);
      await page.goto('/reports/exports');
      const json = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Exportar JSON' }).click();
      const json_file = await json;
      expect(json_file.suggestedFilename()).toBe('atria-export.json');

      const csv = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Exportar CSV' }).click();
      expect((await csv).suggestedFilename()).toBe('atria-export-csv.zip');

      // Só os dados da própria pessoa: o arquivo não cita o dono de outra conta.
      const body = await json_file.createReadStream();
      const chunks: Buffer[] = [];
      for await (const chunk of body) chunks.push(Buffer.from(chunk as Uint8Array));
      expect(Buffer.concat(chunks).toString('utf8')).not.toContain('outra-pessoa@exemplo.test');
      await expectAccessible(page);
    });
  });
}
