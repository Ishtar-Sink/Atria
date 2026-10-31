import { expect, test } from '@playwright/test';
import { createSampleEntities, linkAll, signIn } from './e2e-session';

// Navegação integrada (RF-20, RF-21): sidebar, aba Conexões, links de Conexões, "abrir para
// completar" da paleta, paleta e lembretes montados, modo leitura e teclado.

// Itens da sidebar na ordem do protótipo; o teste do registro confere a mesma ordem em NAV_ITEMS.
const NAV_PATHS = [
  '/',
  '/finance',
  '/goals',
  '/tasks',
  '/reminders',
  '/notes',
  '/journal',
  '/library',
  '/projects',
  '/reports',
  '/admin/users',
];

const notFound = (page: import('@playwright/test').Page) =>
  page.getByRole('heading', { name: /não encontrad/i });

test('sidebar abre todas as telas', async ({ page }) => {
  await signIn(page, 'admin');
  const nav = page.getByRole('navigation', { name: 'Principal' });
  const menu = page.getByRole('button', { name: 'Abrir menu' });
  for (const path of NAV_PATHS) {
    // Até 720 px a sidebar é uma gaveta: abre pelo botão do menu antes do clique.
    if (await menu.isVisible()) await menu.click();
    await nav.locator(`a[href="${path}"]`).click();
    await expect(page).toHaveURL(new RegExp(`${path === '/' ? '/' : path}(\\?.*)?$`));
    await expect(nav.locator(`a[href="${path}"]`)).toHaveAttribute('aria-current', 'page');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(notFound(page)).toHaveCount(0);
  }
});

test('toda tela de entidade tem a aba Conexões', async ({ page }) => {
  await signIn(page);
  const samples = await createSampleEntities(page);
  for (const sample of samples.filter((item) => item.entity_type !== 'project_card')) {
    await page.goto(sample.url);
    await page.getByRole('tab', { name: 'Conexões' }).click();
    await expect(page).toHaveURL(/[?&]tab=connections/);
    await expect(page.getByRole('tabpanel')).toBeVisible();
  }
});

test('livro e artigo têm as abas Conexões e Destaques', async ({ page }) => {
  await signIn(page);
  const samples = await createSampleEntities(page);
  for (const sample of samples.filter((item) => ['book', 'article'].includes(item.entity_type))) {
    await page.goto(sample.url);
    await expect(page.getByRole('tab', { name: 'Destaques' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Conexões' })).toBeVisible();
  }
});

test('links da aba Conexões abrem as telas de ENTITY_CATEGORIES', async ({ page }) => {
  await signIn(page);
  const samples = await createSampleEntities(page);
  const note = samples.find((item) => item.entity_type === 'note');
  if (!note) throw new Error('sem nota');
  const others = samples.filter((item) => item !== note);
  await linkAll(page, note, others);
  await page.goto(`${note.url}?tab=connections`);
  const panel = page.getByRole('tabpanel');
  // O link de cada item aparece quando o título dele carrega.
  for (const other of others) {
    await expect(panel.locator(`a[href^="${other.url}"]`).first(), other.url).toBeVisible();
  }
  for (const other of others) {
    await page.goto(`${note.url}?tab=connections`);
    await page.locator(`a[href^="${other.url}"]`).first().click();
    await expect(page).toHaveURL(new RegExp(other.url));
    await expect(notFound(page)).toHaveCount(0);
  }
});

test('abrir para completar da paleta abre a tela de edição', async ({ page }) => {
  await signIn(page);
  for (const kind of ['nota', 'tarefa', 'meta', 'projeto', 'entrada do diário']) {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await page
      .getByRole('banner')
      .getByRole('button', { name: /^Buscar ou criar/ })
      .click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('option', { name: `Criar ${kind}` }).click();
    await dialog.getByLabel('Título').fill(`Item rápido ${kind}`);
    await dialog.getByRole('button', { name: 'Salvar' }).click();
    await dialog.getByRole('button', { name: 'Abrir para completar' }).click();
    await expect(page).toHaveURL(/\/edit(\?.*)?$/);
    await expect(notFound(page)).toHaveCount(0);
  }
});

test('paleta abre pelo PaletteTrigger e por Ctrl + K', async ({ page }) => {
  await signIn(page);
  await page.goto('/');
  await page
    .getByRole('banner')
    .getByRole('button', { name: /buscar/i })
    .click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.keyboard.press('Control+K');
  await expect(page.getByRole('dialog')).toBeVisible();
});

test('modo leitura abre sem sidebar nem topbar', async ({ page }) => {
  await signIn(page);
  const samples = await createSampleEntities(page);
  const book = samples.find((item) => item.entity_type === 'book');
  await page.goto(`${book?.url ?? ''}/read`);
  await expect(page.getByRole('navigation', { name: 'Principal' })).toHaveCount(0);
  await expect(page.getByRole('banner')).toHaveCount(0);
});

test('navegação por teclado com foco visível', async ({ page }) => {
  await signIn(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  // A troca de rota leva o foco ao título; o corpo focado põe o início do Tab no topo.
  await page.evaluate(() => {
    document.body.tabIndex = -1;
    document.body.focus();
    document.body.removeAttribute('tabindex');
  });
  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: /pular para o conteúdo/i });
  await expect(skip).toBeFocused();
  const width = page.viewportSize()?.width ?? 1280;
  if (width > 720) {
    for (let step = 0; step < 4; step += 1) await page.keyboard.press('Tab');
    const outline = await page.evaluate(() => {
      const active = document.activeElement;
      return active ? getComputedStyle(active).outlineStyle : 'none';
    });
    expect(outline).not.toBe('none');
  }
});
