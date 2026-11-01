import { mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
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
          // A categoria é o autocomplete (combobox); os demais filtros seguem como botão.
          const field =
            filter === 'Categoria'
              ? page.getByRole('combobox', { name: 'Categoria' })
              : page.getByRole('button', { name: new RegExp(`^${filter} `) });
          await expect(field).toBeVisible();
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
      await api(page, 'POST', '/categories', { name: category, kind: 'expense', color: '#6d28d9' });
      await page.goto('/reports/fin-cat');
      const field = page.getByRole('combobox', { name: 'Categoria' });
      await field.click();
      await field.pressSequentially(category);
      await page.keyboard.press('Enter');
      await page.getByRole('button', { name: 'Gerar relatório' }).click();
      const entity_link = page.url().replace(/period=[^&]*&?/, '');
      await page.goto(entity_link);
      await expect(page.getByRole('button', { name: /Período/ })).toContainText('Qualquer período');
      await expect(page.getByText('Escolha os filtros')).toHaveCount(0);
      await expectAccessible(page);
    });

    test('ct15 filters the category by typing and picks it with the keyboard', async ({ page }) => {
      await signIn(page);
      await page.goto('/finance/expenses');
      const field = page.getByRole('combobox', { name: 'Categoria' });
      await field.click();
      await field.pressSequentially('m');
      const list = page.getByRole('listbox');
      await expect(list.getByRole('option')).toHaveText(['Mercado', 'Moradia']);
      const shot = process.env['ATRIA_E2E_SHOT'];
      if (size.name === 'desktop' && shot) {
        await page.screenshot({ path: shot, animations: 'disabled' });
      }
      await expectNoHorizontalScroll(page);
      const box = await list.boundingBox();
      expect(box).not.toBeNull();
      if (box) {
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(size.width);
      }
      // A primeira opção já nasce ativa: desce até Moradia e volta para Mercado.
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('ArrowUp');
      await page.keyboard.press('Enter');
      await expect(page).toHaveURL(/category_id=/);
      await expect(field).toHaveValue('Mercado');
      const filtered = page.url();
      await field.click();
      await field.pressSequentially('xyz');
      await expect(
        page.getByRole('status').filter({ hasText: 'Nenhuma categoria encontrada' }),
      ).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(field).toHaveValue('Mercado');
      expect(page.url()).toBe(filtered);

      await page.goto('/reports/fin-cat');
      const report = page.getByRole('combobox', { name: 'Categoria' });
      await report.click();
      await report.pressSequentially('sa');
      await expect(page.getByRole('listbox').getByRole('option')).toHaveText(['Saúde']);
      await page.keyboard.press('Enter');
      await page.getByRole('button', { name: 'Gerar relatório' }).click();
      await expect(page).toHaveURL(/run=1/);
      await expect(page).toHaveURL(/category_id=/);
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

/** Marcador do cursor no vídeo: o Playwright não desenha o ponteiro. */
function cursorMarker() {
  const dot = document.createElement('div');
  dot.style.cssText =
    'position:fixed;z-index:2147483647;pointer-events:none;left:0;top:0;display:none;';
  dot.innerHTML =
    '<div style="width:12px;height:12px;border-radius:50%;background:#e11d48;border:2px solid #fff;box-shadow:0 0 0 1px #000"></div>' +
    '<div data-label style="margin:4px 0 0 14px;padding:2px 6px;border-radius:4px;background:#111;color:#fff;font:600 12px system-ui;white-space:nowrap"></div>';
  const label = dot.querySelector('[data-label]');
  const place = (event: MouseEvent) => {
    dot.style.display = 'block';
    dot.style.transform = `translate(${String(event.clientX - 6)}px, ${String(event.clientY - 6)}px)`;
    requestAnimationFrame(() => {
      const under = document.elementFromPoint(event.clientX, event.clientY);
      if (label)
        label.textContent = `cursor: ${under ? getComputedStyle(under).cursor : 'default'}`;
    });
  };
  window.addEventListener('mousemove', place, true);
  window.addEventListener('mousedown', place, true);
  window.addEventListener('mouseup', place, true);
  document.addEventListener('DOMContentLoaded', () => {
    document.body.append(dot);
  });
}

test('ct15 records the category filter video', async ({ browser }) => {
  const target = process.env['ATRIA_E2E_VIDEO'];
  test.skip(!target, 'só grava com ATRIA_E2E_VIDEO');
  if (!target) return;
  test.setTimeout(120_000);
  const tmp = join(dirname(target), 'video-tmp');
  mkdirSync(tmp, { recursive: true });
  const size = { width: 1280, height: 800 };
  const context = await browser.newContext({
    viewport: size,
    colorScheme: 'light',
    recordVideo: { dir: tmp, size },
  });
  await context.addInitScript(cursorMarker);
  const page = await context.newPage();
  const pause = (ms: number) => page.waitForTimeout(ms);
  const moveTo = async (selector: ReturnType<Page['getByRole']>) => {
    const box = await selector.boundingBox();
    if (box) await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 15 });
    await pause(700);
  };
  try {
    await signIn(page);
    await page.goto('/finance/expenses');
    await page.evaluate(() => {
      document.documentElement.dataset['theme'] = 'light';
    });
    await pause(1000);

    // Saídas: digitar, escolher pelo teclado, buscar sem resultado e voltar com Esc.
    const field = page.getByRole('combobox', { name: 'Categoria' });
    await moveTo(field);
    await field.click();
    await field.pressSequentially('m', { delay: 180 });
    await pause(1200);
    await page.keyboard.press('ArrowDown');
    await pause(800);
    await page.keyboard.press('ArrowUp');
    await pause(800);
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/category_id=/);
    await pause(1200);
    await field.click();
    await field.pressSequentially('xyz', { delay: 180 });
    await expect(
      page.getByRole('status').filter({ hasText: 'Nenhuma categoria encontrada' }),
    ).toBeVisible();
    await pause(1200);
    await page.keyboard.press('Escape');
    await expect(field).toHaveValue('Mercado');
    await pause(1200);

    // Relatório Gastos por categoria: digitar, Enter e gerar.
    await page.goto('/reports/fin-cat');
    await page.evaluate(() => {
      document.documentElement.dataset['theme'] = 'light';
    });
    const report = page.getByRole('combobox', { name: 'Categoria' });
    await moveTo(report);
    await report.click();
    await report.pressSequentially('sa', { delay: 180 });
    await pause(1000);
    await page.keyboard.press('Enter');
    await pause(800);
    const generate = page.getByRole('button', { name: 'Gerar relatório' });
    await moveTo(generate);
    await generate.click();
    await expect(page).toHaveURL(/run=1/);
    await expect(page.getByText('Escolha os filtros')).toHaveCount(0);
    await pause(2000);
  } finally {
    await context.close();
    await page.video()?.saveAs(target);
    rmSync(tmp, { recursive: true, force: true });
  }
});
