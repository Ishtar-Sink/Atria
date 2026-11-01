import { expect, test, type Page } from '@playwright/test';
import { api, setTheme, signIn } from '../../app/e2e-session';

// RF-36, CT-35 e CB-14: o fundo do cabeçalho fixo vai de ponta a ponta da área da página, no
// Chromium e no Firefox (o navegador do usuário, o Zen).

const BROWSERS = ['desktop', 'firefox'];

async function scrollArea(page: Page, top: number) {
  await page.locator('[data-scroll-area]').evaluate((node, value) => {
    node.scrollTo(0, value);
  }, top);
}

async function backdropOf(page: Page) {
  return page
    .locator('[data-sticky-header]:visible')
    .first()
    .evaluate((wrap) => {
      const before = getComputedStyle(wrap, '::before');
      const area = wrap.closest<HTMLElement>('[data-scroll-area]');
      if (!area) throw new Error('sem área de rolagem');
      return {
        opacity: before.opacity,
        backdropFilter: before.backdropFilter,
        backgroundImage: before.backgroundImage,
        width: parseFloat(before.width),
        left: parseFloat(before.left),
        transitionDuration: before.transitionDuration,
        wrap: wrap.getBoundingClientRect().toJSON() as { left: number; width: number },
        area: {
          left: area.getBoundingClientRect().left,
          clientWidth: area.clientWidth,
          scrollHeight: area.scrollHeight,
          clientHeight: area.clientHeight,
        },
      };
    });
}

async function expectFullWidthBackdrop(page: Page) {
  await expect.poll(async () => (await backdropOf(page)).opacity).toBe('1');
  const info = await backdropOf(page);
  expect(info.backdropFilter).toContain('blur');
  expect(info.backgroundImage).toContain('linear-gradient');
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
    await scrollArea(page, 240);
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
    const before = await backdropOf(page);
    expect(before.area.scrollHeight).toBeGreaterThan(before.area.clientHeight + 200);
    await scrollArea(page, 240);
    const after = await expectFullWidthBackdrop(page);
    expect(after.wrap.width).toBeLessThan(after.area.clientWidth);
  });

  test('sem transição com reduzir movimento', async ({ page }, info) => {
    test.skip(!BROWSERS.includes(info.project.name), 'roda no Chromium e no Firefox');
    await signIn(page);
    await page.setViewportSize({ width: 1280, height: 600 });
    await setTheme(page, 'light');
    await page.goto('/library/books/new');
    await scrollArea(page, 240);
    await expectFullWidthBackdrop(page);
    expect((await backdropOf(page)).transitionDuration).toBe('0s');
  });

  test('compacta o título depois de 48 px', async ({ page }, info) => {
    test.skip(!BROWSERS.includes(info.project.name), 'roda no Chromium e no Firefox');
    await signIn(page);
    await page.setViewportSize({ width: 1280, height: 600 });
    await setTheme(page, 'light');
    await page.goto('/library/books/new');
    await scrollArea(page, 240);
    const header = page.locator('[data-sticky-header]:visible header').first();
    await expect(header).toHaveAttribute('data-compact', '');
    await expect(header.getByRole('heading', { level: 1 })).toHaveCSS('font-size', '24px');
  });
});
