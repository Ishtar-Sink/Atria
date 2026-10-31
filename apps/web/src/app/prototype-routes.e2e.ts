import { expect, test } from '@playwright/test';
import { api, createSampleEntities, expectNoAxeViolations, signIn } from './e2e-session';

// DEC-002: as rotas novas das decisões do protótipo, de ponta a ponta (PD-23, PD-36, PD-46,
// PD-61). Rodam em todos os projetos do `playwright.config.ts` (360 px a desktop).

// PNG de 1 × 1 px, para a capa.
const PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

test('PD-46 adicionar cartão abre o formulário do cartão na raia', async ({ page }) => {
  await signIn(page);
  const project = await api<{ id: string }>(page, 'POST', '/projects', { name: 'Reforma' });
  await page.goto(`/projects/${project.id}?tab=board`);
  await page
    .getByRole('button', { name: /adicionar cartão/i })
    .first()
    .click();
  await expect(page).toHaveURL(new RegExp(`/projects/${project.id}/cards/new\\?lane=`));
  await page.getByLabel('Título').fill('Pintar a sala');
  await page.getByRole('button', { name: /^Salvar/ }).click();
  await expect(page).toHaveURL(new RegExp(`/projects/${project.id}(\\?.*)?$`));
  await page.getByRole('link', { name: 'Pintar a sala' }).click();
  await expect(page).toHaveURL(new RegExp(`/projects/${project.id}/cards/[^/?]+$`));
  await expectNoAxeViolations(page);
});

test('PD-61 relatório emitido pelo módulo volta ao módulo', async ({ page }) => {
  await signIn(page);
  await page.goto('/goals');
  await page.getByRole('button', { name: 'Relatórios' }).click();
  await page.getByRole('menuitem').first().click();
  await expect(page).toHaveURL(/\/reports\/goals-progress\?from_module=goals/);
  await page.getByRole('link', { name: 'Voltar' }).click();
  await expect(page).toHaveURL(/\/goals$/);
  await expectNoAxeViolations(page);
});

test('PD-61 relatório emitido pela entidade abre filtrado e gerado', async ({ page }) => {
  await signIn(page);
  const samples = await createSampleEntities(page);
  const cases = [
    { type: 'goal', report: 'goals-progress', param: 'goal_id' },
    { type: 'account', report: 'fin-flow', param: 'account_id' },
    { type: 'book', report: 'read-pages', param: 'book_id' },
    { type: 'project', report: 'proj-cards', param: 'project_id' },
  ];
  for (const item of cases) {
    const sample = samples.find((entry) => entry.entity_type === item.type);
    if (!sample) throw new Error(item.type);
    await page.goto(sample.url);
    await page.getByRole('button', { name: 'Mais ações' }).click();
    await page
      .getByRole('menuitem', { name: /relatório|fluxo|progresso|páginas|cartões/i })
      .first()
      .click();
    await expect(page).toHaveURL(
      new RegExp(`/reports/${item.report}\\?.*${item.param}=${sample.id}.*run=1`),
    );
    await expect(page.getByRole('heading', { level: 3 }).first()).toBeVisible();
  }
  await expectNoAxeViolations(page);
});

test('PD-36 capa enviada aparece na estante e na visão geral', async ({ page }) => {
  await signIn(page);
  for (const kind of ['books', 'articles'] as const) {
    const item = await api<{ id: string }>(page, 'POST', `/${kind}`, { title: `Capa ${kind}` });
    await page.goto(`/library/${kind}/${item.id}/edit`);
    // Na edição a capa sobe assim que é escolhida; salvar no meio do envio deixava a tela da
    // entidade sem a capa até a próxima consulta.
    const uploaded = page.waitForResponse(
      (response) =>
        response.request().method() !== 'GET' && response.url().endsWith(`/${item.id}/cover`),
    );
    await page.locator('input[type="file"][accept*="image"]').setInputFiles({
      name: 'capa.png',
      mimeType: 'image/png',
      buffer: PIXEL,
    });
    expect((await uploaded).ok()).toBe(true);
    await page.getByRole('button', { name: /^Salvar/ }).click();
    await expect(page.locator('img[src^="/api/v1/files/"]').first()).toBeVisible();
    await page.goto(`/library?tab=${kind}`);
    await expect(page.locator('img[src^="/api/v1/files/"]').first()).toBeVisible();
    await page.goto(`/library/${kind}/${item.id}/edit`);
    await page.getByRole('button', { name: 'Remover', exact: true }).click();
    await page.getByRole('button', { name: /^Salvar/ }).click();
    await expect(page.locator('img[src^="/api/v1/files/"]')).toHaveCount(0);
  }
  await expectNoAxeViolations(page);
});

test('PD-23 Configurações abre pelo menu do perfil', async ({ page }) => {
  await signIn(page);
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: 'Principal' });
  await expect(nav.getByRole('link', { name: 'Configurações' })).toHaveCount(0);
  const width = page.viewportSize()?.width ?? 1280;
  if (width <= 720) await page.getByRole('button', { name: 'Abrir menu' }).click();
  await page.locator('#sidebar').getByRole('button').last().click();
  await page.getByRole('menuitem', { name: 'Configurações' }).click();
  await expect(page).toHaveURL(/\/settings$/);
  await expectNoAxeViolations(page);
});
