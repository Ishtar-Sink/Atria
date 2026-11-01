import { mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import type { Schemas } from '@atria/contracts';
import { api, setTheme, signIn } from '../../app/e2e-session';

// RF-36, CT-35 e CB-14: o fundo do cabeçalho fixo vai de ponta a ponta da área da página, no
// Chromium e no Firefox (o navegador do usuário, o Zen).

const BROWSERS = ['desktop', 'firefox'];

async function scrollWindow(page: Page, top: number) {
  await page.evaluate((value) => {
    window.scrollTo(0, value);
  }, top);
}

interface Box {
  top: number;
  bottom: number;
  height: number;
}

/** Medidas da rolagem única (RF-23): janela, sidebar, topbar, área da página e rolagens internas. */
async function layoutOf(page: Page) {
  return page.evaluate(() => {
    const box = (node: Element | null): Box => {
      if (!node) throw new Error('elemento ausente');
      const r = node.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, height: r.height };
    };
    const sidebar = document.querySelector('aside');
    const main = document.querySelector<HTMLElement>('main[data-page-area]');
    const topbar = main?.parentElement?.querySelector(':scope > header') ?? null;
    const inner = [...document.querySelectorAll<HTMLElement>('body *')]
      .filter((node) => {
        if (sidebar?.querySelector('nav')?.contains(node)) return false;
        const overflow = getComputedStyle(node).overflowY;
        return (
          node.scrollHeight > node.clientHeight + 1 &&
          (overflow === 'auto' || overflow === 'scroll')
        );
      })
      .map((node) => node.tagName.toLowerCase());
    return {
      scrollY: window.scrollY,
      scrollHeight: document.documentElement.scrollHeight,
      innerHeight: window.innerHeight,
      sidebar: box(sidebar),
      topbar: box(topbar),
      main: box(main),
      mainOverflowY: main ? getComputedStyle(main).overflowY : '',
      inner,
    };
  });
}

async function seedExpenses(page: Page) {
  const accounts = await api<Schemas['AccountPage']>(page, 'GET', '/accounts');
  const account = accounts.items[0];
  if (!account) throw new Error('pessoa sem conta padrão');
  const today = new Date().toISOString().slice(0, 10);
  for (let i = 1; i <= 12; i += 1) {
    await api(page, 'POST', '/transactions', {
      account_id: account.id,
      kind: 'expense',
      description: `Despesa ${String(i)}`,
      expected_amount: 1000 * i,
      expected_date: today,
    });
  }
}

/** Marcador do cursor no vídeo: o Playwright não desenha o ponteiro. */
const CURSOR_MARKER = () => {
  const dot = document.createElement('div');
  dot.style.cssText =
    'position:fixed;z-index:2147483647;pointer-events:none;left:0;top:0;display:none;';
  dot.innerHTML =
    '<div style="width:12px;height:12px;border-radius:50%;background:#e11d48;border:2px solid #fff;box-shadow:0 0 0 1px #000"></div>';
  const place = (event: MouseEvent) => {
    dot.style.display = 'block';
    dot.style.transform = `translate(${String(event.clientX - 6)}px, ${String(event.clientY - 6)}px)`;
  };
  window.addEventListener('mousemove', place, true);
  document.addEventListener('DOMContentLoaded', () => {
    document.body.append(dot);
  });
};

async function backdropOf(page: Page) {
  return page
    .locator('[data-sticky-header]:visible')
    .first()
    .evaluate((wrap) => {
      const before = getComputedStyle(wrap, '::before');
      const area = wrap.closest<HTMLElement>('[data-page-area]');
      if (!area) throw new Error('sem área da página');
      return {
        opacity: before.opacity,
        backdropFilter: before.backdropFilter,
        backgroundColor: before.backgroundColor,
        borderBottomWidth: before.borderBottomWidth,
        width: parseFloat(before.width),
        left: parseFloat(before.left),
        transitionDuration: before.transitionDuration,
        wrap: wrap.getBoundingClientRect().toJSON() as { left: number; width: number },
        area: {
          left: area.getBoundingClientRect().left,
          clientWidth: area.clientWidth,
          scrollHeight: document.documentElement.scrollHeight,
          clientHeight: window.innerHeight,
        },
      };
    });
}

async function expectFullWidthBackdrop(page: Page) {
  await expect.poll(async () => (await backdropOf(page)).opacity).toBe('1');
  const info = await backdropOf(page);
  expect(info.backdropFilter).toContain('blur');
  // Fundo sólido da cor da página, que não depende do desfoque, com a linha embaixo.
  expect(info.backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
  expect(info.borderBottomWidth).toBe('1px');
  expect(Math.abs(info.width - info.area.clientWidth)).toBeLessThanOrEqual(1);
  expect(Math.abs(info.wrap.left + info.left - info.area.left)).toBeLessThanOrEqual(1);
  return info;
}

test.describe('cabeçalho fixo', { tag: '@firefox' }, () => {
  test('formulário: fundo tingido com desfoque na largura da área da página', async ({
    page,
  }, info) => {
    test.skip(!BROWSERS.includes(info.project.name), 'roda no Chromium e no Firefox');
    await signIn(page);
    await page.setViewportSize({ width: 1280, height: 600 });
    await setTheme(page, 'light');
    await page.goto('/library/books/new');
    const before = await backdropOf(page);
    expect(before.area.scrollHeight).toBeGreaterThan(before.area.clientHeight + 200);
    await scrollWindow(page, 240);
    const after = await expectFullWidthBackdrop(page);
    // O formulário tem 880 px: o cabeçalho é mais estreito que a área.
    expect(after.wrap.width).toBeLessThan(after.area.clientWidth);
    const shot = process.env['ATRIA_E2E_SHOT'];
    if (shot) await page.screenshot({ path: shot, animations: 'disabled' });
  });

  test('listagem larga: fundo de ponta a ponta além dos 1360 px', async ({ page }, info) => {
    test.skip(!BROWSERS.includes(info.project.name), 'roda no Chromium e no Firefox');
    await signIn(page);
    await page.setViewportSize({ width: 1680, height: 700 });
    await setTheme(page, 'light');
    for (let i = 1; i <= 30; i += 1) {
      await api(page, 'POST', '/notes', { title: `Nota ${String(i)}`, body: 'Texto.' });
    }
    await page.goto('/notes');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect
      .poll(async () => {
        const now = await backdropOf(page);
        return now.area.scrollHeight - now.area.clientHeight;
      })
      .toBeGreaterThan(200);
    await scrollWindow(page, 240);
    const after = await expectFullWidthBackdrop(page);
    expect(after.wrap.width).toBeLessThan(after.area.clientWidth);
  });

  test('sem transição com reduzir movimento', async ({ page }, info) => {
    test.skip(!BROWSERS.includes(info.project.name), 'roda no Chromium e no Firefox');
    await signIn(page);
    await page.setViewportSize({ width: 1280, height: 600 });
    await setTheme(page, 'light');
    await page.goto('/library/books/new');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await scrollWindow(page, 240);
    await expectFullWidthBackdrop(page);
    expect((await backdropOf(page)).transitionDuration).toBe('0s');
  });

  test('compacta o título depois de 48 px', async ({ page }, info) => {
    test.skip(!BROWSERS.includes(info.project.name), 'roda no Chromium e no Firefox');
    await signIn(page);
    await page.setViewportSize({ width: 1280, height: 600 });
    await setTheme(page, 'light');
    await page.goto('/library/books/new');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await scrollWindow(page, 240);
    const header = page.locator('[data-sticky-header]:visible header').first();
    await expect(header).toHaveAttribute('data-compact', '');
    await expect(header.getByRole('heading', { level: 1 })).toHaveCSS('font-size', '24px');
  });

  test('ct17 só a janela rola no painel, com a barra lateral e a topbar fixas', async ({
    page,
  }, info) => {
    test.skip(!BROWSERS.includes(info.project.name), 'roda no Chromium e no Firefox');
    await signIn(page);
    await page.setViewportSize({ width: 1280, height: 800 });
    await setTheme(page, 'light');
    await seedExpenses(page);
    await page.goto('/finance');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Despesa 5' })).toBeVisible();
    await expect
      .poll(async () => {
        const now = await layoutOf(page);
        return now.scrollHeight - now.innerHeight;
      })
      .toBeGreaterThan(200);
    const before = await layoutOf(page);
    expect(before.mainOverflowY).toBe('visible');
    expect(before.inner).toEqual([]);
    await scrollWindow(page, 100_000);
    await expect.poll(async () => (await layoutOf(page)).scrollY).toBeGreaterThan(0);
    const after = await layoutOf(page);
    expect(Math.abs(after.sidebar.top)).toBeLessThanOrEqual(1);
    expect(Math.abs(after.sidebar.height - after.innerHeight)).toBeLessThanOrEqual(1);
    expect(Math.abs(after.topbar.top)).toBeLessThanOrEqual(1);
    expect(Math.abs(after.main.bottom - after.innerHeight)).toBeLessThanOrEqual(1);
    const header = page.locator('[data-sticky-header]:visible header').first();
    await expect(header).toBeVisible();
    await expect(header).toHaveAttribute('data-stuck', '');
    await expect(header).toHaveAttribute('data-compact', '');
    const wrap = await page
      .locator('[data-sticky-header]:visible')
      .first()
      .evaluate((node) => node.getBoundingClientRect().top);
    expect(Math.abs(wrap - after.topbar.bottom)).toBeLessThanOrEqual(1);
    // As abas ficam presas sob o título, dentro do cabeçalho fixo.
    const tabs = page.locator('[data-sticky-header]:visible nav').first();
    await expect(tabs).toBeVisible();
    const tabs_top = await tabs.evaluate((node) => node.getBoundingClientRect().top);
    const header_bottom = await header.evaluate((node) => node.getBoundingClientRect().bottom);
    expect(tabs_top).toBeGreaterThanOrEqual(header_bottom - 1);
  });

  test('ct17 só a janela rola no formulário e o cabeçalho cola na topbar', async ({
    page,
  }, info) => {
    test.skip(!BROWSERS.includes(info.project.name), 'roda no Chromium e no Firefox');
    await signIn(page);
    await page.setViewportSize({ width: 1280, height: 800 });
    await setTheme(page, 'light');
    await page.goto('/library/books/new');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect
      .poll(async () => {
        const now = await layoutOf(page);
        return now.scrollHeight - now.innerHeight;
      })
      .toBeGreaterThan(200);
    const before = await layoutOf(page);
    expect(before.mainOverflowY).toBe('visible');
    expect(before.inner).toEqual([]);
    await scrollWindow(page, 240);
    const header = page.locator('[data-sticky-header]:visible header').first();
    await expect(header).toHaveAttribute('data-compact', '');
    const after = await layoutOf(page);
    const wrap = await page
      .locator('[data-sticky-header]:visible')
      .first()
      .evaluate((node) => node.getBoundingClientRect().top);
    expect(Math.abs(wrap - after.topbar.bottom)).toBeLessThanOrEqual(1);
    expect(Math.abs(after.sidebar.top)).toBeLessThanOrEqual(1);
    expect(Math.abs(after.topbar.top)).toBeLessThanOrEqual(1);
    expect(after.inner).toEqual([]);
  });

  test('cb11 página curta: sem rolagem e barra lateral na altura da tela', async ({
    page,
  }, info) => {
    test.skip(!BROWSERS.includes(info.project.name), 'roda no Chromium e no Firefox');
    await signIn(page);
    await page.setViewportSize({ width: 1280, height: 800 });
    await setTheme(page, 'light');
    await page.goto('/notes');
    await expect(page.getByText('Nenhuma nota ainda')).toBeVisible();
    const layout = await layoutOf(page);
    expect(layout.scrollHeight).toBeLessThanOrEqual(layout.innerHeight);
    expect(Math.abs(layout.sidebar.height - layout.innerHeight)).toBeLessThanOrEqual(1);
    expect(Math.abs(layout.main.bottom - layout.innerHeight)).toBeLessThanOrEqual(1);
    const shot = process.env['ATRIA_E2E_SHOT_SHORT_PAGE'];
    if (shot) await page.screenshot({ path: shot, animations: 'disabled' });
  });
});

test('ct17 vídeo da rolagem única', async ({ browser }, info) => {
  const target = process.env['ATRIA_E2E_VIDEO'];
  test.skip(info.project.name !== 'desktop' || !target, 'só grava com ATRIA_E2E_VIDEO');
  if (!target) return;
  const tmp = join(dirname(target), 'video-tmp');
  mkdirSync(tmp, { recursive: true });
  const size = { width: 1280, height: 800 };
  const context = await browser.newContext({
    ...(info.project.use.baseURL ? { baseURL: info.project.use.baseURL } : {}),
    viewport: size,
    colorScheme: 'light',
    recordVideo: { dir: tmp, size },
  });
  await context.addInitScript(CURSOR_MARKER);
  const page = await context.newPage();
  const video = page.video();
  try {
    await signIn(page);
    await seedExpenses(page);
    await page.evaluate(() => {
      document.documentElement.dataset['theme'] = 'light';
    });
    await page.goto('/finance');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await page.mouse.move(640, 400, { steps: 15 });
    await page.waitForTimeout(1000);
    for (let i = 0; i < 10; i += 1) {
      await page.mouse.wheel(0, 160);
      await page.waitForTimeout(200);
    }
    await page.waitForTimeout(1000);
    for (let i = 0; i < 10; i += 1) {
      await page.mouse.wheel(0, -160);
      await page.waitForTimeout(200);
    }
    await page.waitForTimeout(800);
    await page.goto('/library/books/new');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await page.mouse.move(640, 400, { steps: 15 });
    await page.waitForTimeout(800);
    for (let i = 0; i < 6; i += 1) {
      await page.mouse.wheel(0, 160);
      await page.waitForTimeout(200);
    }
    await page.waitForTimeout(1000);
    for (let i = 0; i < 6; i += 1) {
      await page.mouse.wheel(0, -160);
      await page.waitForTimeout(200);
    }
    await page.waitForTimeout(800);
  } finally {
    await context.close();
  }
  await video?.saveAs(target);
  rmSync(tmp, { recursive: true, force: true });
});
