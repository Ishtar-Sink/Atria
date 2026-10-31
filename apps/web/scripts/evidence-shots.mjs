// Evidências visuais da TASK-05, sem passo manual: sobe o Vite numa porta livre, abre o app e o
// protótipo no Chromium do Playwright, confere o estado no DOM antes de cada captura e monta as
// pranchas (PNG) em vostok/work/tasks/SPEC-001/evidence/TASK-05/.
// Uso: node apps/web/scripts/evidence-shots.mjs [layout|forms|prototipo ...]  (sem argumento, gera as três)
// Imprime "ok" ou "FALHA" por verificação e o caminho de cada PNG; sai com código 1 se algo falhar.
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = join(WEB, '..', '..');
const OUT = join(ROOT, 'vostok', 'work', 'tasks', 'SPEC-001', 'evidence', 'TASK-05');
const PROTOTYPE = pathToFileURL(join(ROOT, 'prototype', 'atria-prototype.html')).href;

const THEMES = ['light', 'dark'];
const SIZES = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 360, height: 760 },
};
const SIZE_LABEL = { desktop: 'desktop 1440', mobile: '360 px' };
const THEME_LABEL = { light: 'claro', dark: 'escuro' };

let failures = 0;
function check(name, cond, extra) {
  if (!cond) failures += 1;
  console.log(`${cond ? 'ok    ' : 'FALHA '} ${name}${extra ? ` · ${extra}` : ''}`);
}

// ---------- servidor de desenvolvimento ----------

function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

async function startVite() {
  const port = await freePort();
  const child = spawn(
    join(WEB, 'node_modules', '.bin', 'vite'),
    ['--port', String(port), '--strictPort', '--host', '127.0.0.1'],
    { cwd: WEB, stdio: ['ignore', 'pipe', 'pipe'], detached: true },
  );
  let log = '';
  child.stdout.on('data', (d) => (log += d));
  child.stderr.on('data', (d) => (log += d));
  let exited = false;
  child.on('exit', () => (exited = true));
  const url = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 150; i += 1) {
    if (exited) throw new Error(`o Vite terminou antes de ficar pronto:\n${log}`);
    try {
      if ((await fetch(`${url}/`)).ok) return { url, stop: () => stop(child) };
    } catch {
      /* ainda subindo */
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  stop(child);
  throw new Error(`o Vite não ficou pronto em 30 s:\n${log}`);
}

function stop(child) {
  try {
    process.kill(-child.pid, 'SIGTERM');
  } catch {
    /* já encerrado */
  }
}

// ---------- captura ----------

/** Abre uma página nova com o tema e o tamanho dados; /api falha de forma limpa (não há servidor). */
async function openPage(browser, { theme, size, key }) {
  const context = await browser.newContext({
    viewport: SIZES[size],
    reducedMotion: 'reduce',
    locale: 'pt-BR',
  });
  await context.addInitScript(
    ([k, t]) => {
      try {
        localStorage.setItem(k, t);
      } catch {
        /* sem armazenamento */
      }
    },
    [key, theme],
  );
  await context.route(
    (url) => url.pathname.startsWith('/api/'),
    (route) => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }),
  );
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  return { page, context, errors };
}

const noOverflow = (page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const inViewport = (page, locator) =>
  locator.evaluate((el) => {
    const r = el.getBoundingClientRect();
    window.__box = `l${Math.round(r.left)} t${Math.round(r.top)} r${Math.round(r.right)} b${Math.round(r.bottom)} / ${innerWidth}x${innerHeight}`;
    return r.left >= 0 && r.top >= 0 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 2;
  });
const themeOf = (page) => page.evaluate(() => document.documentElement.dataset.theme);

/** Verificações comuns a toda captura do app: tema aplicado, sem rolagem horizontal, sem erro de JS. */
async function baseChecks(page, errors, tag, theme) {
  check(`${tag}: tema ${THEME_LABEL[theme]} aplicado`, (await themeOf(page)) === theme);
  check(`${tag}: sem rolagem horizontal`, await noOverflow(page));
  check(`${tag}: sem erro de JavaScript`, errors.length === 0, errors.join(' | '));
}

async function gotoApp(page, base, path) {
  await page.goto(`${base}${path}`);
  await page.locator('h1').first().waitFor();
  await page.evaluate(() => document.fonts.ready);
}

/** Executa um cenário em todas as combinações tema x tamanho e devolve as imagens rotuladas. */
async function runApp(browser, base, scenarios, sizes) {
  const shots = [];
  for (const theme of THEMES) {
    for (const size of sizes) {
      for (const sc of scenarios) {
        if (sc.sizes && !sc.sizes.includes(size)) continue;
        const tag = `${sc.name} · ${SIZE_LABEL[size]} · ${THEME_LABEL[theme]}`;
        const { page, context, errors } = await openPage(browser, {
          theme,
          size,
          key: 'atria_theme',
        });
        try {
          await gotoApp(page, base, sc.path);
          await sc.run(page, tag, theme, size);
          await baseChecks(page, errors, tag, theme);
          shots.push({
            theme,
            size,
            label: `${sc.name} · ${SIZE_LABEL[size]} · ${THEME_LABEL[theme]}`,
            png: await page.screenshot(),
          });
        } catch (e) {
          check(`${tag}: cenário executou`, false, String(e.message).split('\n')[0]);
        } finally {
          await context.close();
        }
      }
    }
  }
  return shots;
}

// ---------- prancha ----------

/** Monta uma página HTML com as imagens e a fotografa; só as imagens e os rótulos, sem dependência. */
async function sheet(browser, { title, file, shots, scale }) {
  const figure = (s) => {
    const w = Math.round(SIZES[s.size].width * (scale[s.size] ?? 1));
    return `<figure style="width:${w}px"><img style="width:${w}px" src="data:image/png;base64,${s.png.toString('base64')}"><figcaption>${s.label}</figcaption></figure>`;
  };
  // Capturas com a mesma `row` ficam juntas, lado a lado, numa linha da prancha.
  const rows = [];
  for (const s of shots) {
    const last = rows[rows.length - 1];
    if (s.row !== undefined && last?.row === s.row) last.items.push(s);
    else rows.push({ row: s.row, items: [s] });
  }
  const figures = rows
    .map((r) =>
      r.row === undefined
        ? figure(r.items[0])
        : `<div class="row">${r.items.map(figure).join('')}</div>`,
    )
    .join('');
  const html = `<!doctype html><meta charset="utf-8"><style>
    body{margin:0;padding:24px;background:#1b1b20;color:#e8e8ee;font:13px/1.4 system-ui,sans-serif}
    h1{font-size:18px;margin:0 0 16px}
    main{display:flex;flex-wrap:wrap;gap:20px;align-items:flex-start}
    figure{margin:0}
    .row{display:flex;gap:20px;align-items:flex-start;width:100%}
    img{display:block;border:1px solid #444;border-radius:4px}
    figcaption{margin-top:6px;color:#b8b8c4}
  </style><h1>${title}</h1><main>${figures}</main>`;
  const context = await browser.newContext({ viewport: { width: 1640, height: 800 } });
  const page = await context.newPage();
  await page.setContent(html);
  await page.waitForFunction(() => [...document.images].every((i) => i.complete));
  mkdirSync(OUT, { recursive: true });
  const path = join(OUT, file);
  writeFileSync(path, await page.screenshot({ fullPage: true }));
  await context.close();
  console.log(`png: ${relative(ROOT, path)} (${shots.length} capturas)`);
}

// ---------- evidência: layout ----------

const layoutScenarios = [
  {
    name: '/qualquer-rota',
    path: '/qualquer-rota',
    run: async (page, tag, _theme, size) => {
      const h1 = page.getByRole('heading', { level: 1, name: 'Página não encontrada' });
      check(`${tag}: título "Página não encontrada" visível`, await h1.isVisible());
      const brand = page.locator('aside#sidebar').getByText('Atria', { exact: true });
      const search = page.locator('header button', { hasText: 'Buscar ou criar' });
      check(`${tag}: gatilho da busca visível`, await search.isVisible());
      const kbd = (await search.locator('kbd').textContent())?.trim() ?? '';
      check(`${tag}: dica do atalho`, /^(Ctrl K|⌘ K)$/.test(kbd), kbd);
      const account = page.locator('aside#sidebar button[aria-label="Menu da conta"]');
      check(`${tag}: perfil no rodapé do menu lateral`, (await account.count()) === 1);
      const nav = await page.locator('aside#sidebar nav[aria-label="Principal"]').count();
      check(`${tag}: navegação principal presente (vazia até a TASK-35)`, nav === 1);
      if (size === 'desktop') {
        check(`${tag}: sidebar visível com a marca`, await brand.isVisible());
        const width = await page.evaluate(() => {
          const area = document.querySelector('[data-scroll-area]');
          return Math.max(...[...area.children].map((c) => c.getBoundingClientRect().width));
        });
        check(`${tag}: conteúdo limitado a 1360 px`, width <= 1360, `${Math.round(width)} px`);
      } else {
        check(
          `${tag}: botão de menu visível e gaveta fechada`,
          (await page.locator('#menu-button').isVisible()) &&
            (await page.locator('#menu-button').getAttribute('aria-expanded')) === 'false',
        );
      }
    },
  },
  {
    name: 'gaveta aberta',
    path: '/qualquer-rota',
    sizes: ['mobile'],
    run: async (page, tag) => {
      await page.locator('#menu-button').click();
      await page.waitForFunction(
        () => document.querySelector('#menu-button')?.getAttribute('aria-expanded') === 'true',
      );
      const sidebar = page.locator('aside#sidebar');
      check(`${tag}: gaveta visível`, await sidebar.isVisible());
      check(`${tag}: gaveta dentro da janela`, await inViewport(page, sidebar));
      check(`${tag}: gaveta sem inert`, (await sidebar.getAttribute('inert')) === null);
      check(
        `${tag}: marca "Atria" na gaveta`,
        await sidebar.getByText('Atria', { exact: true }).isVisible(),
      );
      await page.waitForTimeout(300);
    },
  },
  {
    name: 'foco no gatilho da busca',
    path: '/qualquer-rota',
    sizes: ['desktop'],
    run: async (page, tag) => {
      const search = page.locator('header button', { hasText: 'Buscar ou criar' });
      for (let i = 0; i < 12; i += 1) {
        if (await search.evaluate((el) => el === document.activeElement)) break;
        await page.keyboard.press('Tab');
      }
      check(
        `${tag}: foco chegou ao gatilho pelo teclado`,
        await search.evaluate((el) => el === document.activeElement),
      );
      const outline = await search.evaluate((el) => {
        const s = getComputedStyle(el);
        return { style: s.outlineStyle, width: parseFloat(s.outlineWidth), color: s.outlineColor };
      });
      check(
        `${tag}: contorno de foco visível`,
        outline.style !== 'none' && outline.width >= 2,
        `${outline.style} ${outline.width}px ${outline.color}`,
      );
    },
  },
  {
    name: 'menu da conta aberto',
    path: '/qualquer-rota',
    sizes: ['desktop'],
    run: async (page, tag) => {
      await page.getByRole('button', { name: 'Menu da conta' }).click();
      const menu = page.getByRole('menu', { name: 'Conta' });
      await menu.waitFor();
      check(`${tag}: menu visível`, await menu.isVisible());
      check(`${tag}: menu dentro da janela`, await inViewport(page, menu));
      const items = (await menu.getByRole('menuitem').allTextContents()).map((t) => t.trim());
      check(
        `${tag}: itens Configurações, tema e Sair`,
        items.length === 3 && items[0] === 'Configurações' && items[2] === 'Sair',
        items.join(' | '),
      );
      const outside = await page.locator('aside#sidebar nav').getByText('Configurações').count();
      check(`${tag}: "Configurações" fora da navegação principal`, outside === 0);
    },
  },
  {
    name: '/dev/forms rolada (cabeçalho compacto)',
    path: '/dev/forms',
    run: async (page, tag) => {
      const area = page.locator('[data-scroll-area]');
      await area.evaluate((el) => el.scrollTo(0, 400));
      await page.waitForFunction(() => document.querySelector('header[data-stuck]') !== null);
      await page.waitForTimeout(400);
      const header = page.locator('header[data-stuck]');
      const size = await header
        .locator('h1')
        .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
      check(`${tag}: título compacto (24 px)`, size === 24, `${size}px`);
      check(
        `${tag}: subtítulo escondido no cabeçalho compacto`,
        (await header.getByText('Todos os campos do Atria').count()) === 0,
      );
      const gap = await header.evaluate((el) => {
        const area = document.querySelector('[data-scroll-area]');
        const pad = parseFloat(getComputedStyle(area).paddingTop);
        return (
          el.parentElement.getBoundingClientRect().top - area.getBoundingClientRect().top - pad
        );
      });
      check(
        `${tag}: cabeçalho preso no topo da área rolável`,
        Math.abs(gap) <= 1,
        `${Math.round(gap)} px`,
      );
    },
  },
];

// ---------- evidência: formulários ----------

/** Rola a área até o popover (como o usuário faria) e confere que ele cabe na janela. */
async function popoverBox(page, locator) {
  await locator.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(200);
  return inViewport(page, locator);
}

const formsScenarios = [
  {
    name: 'formulário (visão geral)',
    path: '/dev/forms',
    run: async (page, tag, _theme, size) => {
      const form = page.locator('form');
      const box = await form.evaluate((el) => el.getBoundingClientRect().width);
      check(`${tag}: formulário até 880 px`, box <= 880 + 1, `${Math.round(box)} px`);
      const grid = await page.evaluate(() => {
        const input = document.querySelector('form input');
        for (let el = input; el && el !== document.body; el = el.parentElement) {
          const s = getComputedStyle(el);
          if (s.display === 'grid') return s.gridTemplateColumns.split(' ').length;
        }
        return 0;
      });
      check(
        `${tag}: ${size === 'desktop' ? 'duas colunas' : 'uma coluna'}`,
        grid === (size === 'desktop' ? 2 : 1),
        `${grid} coluna(s)`,
      );
      check(`${tag}: nenhum select nativo`, (await page.locator('select').count()) === 0);
      const spin = await page.locator('input[type="number"]').evaluate((el) => {
        const s = getComputedStyle(el);
        return (
          s.appearance === 'textfield' || s.getPropertyValue('-moz-appearance') === 'textfield'
        );
      });
      check(`${tag}: campo numérico sem setas`, spin);
      check(
        `${tag}: botões muted e success`,
        (await page.getByRole('button', { name: 'Ver detalhes' }).isVisible()) &&
          (await page.getByRole('button', { name: 'Concluído' }).getAttribute('aria-pressed')) ===
            'true',
      );
      const save = page.getByRole('button', { name: 'Salvar' });
      const cancel = page.getByRole('button', { name: 'Cancelar' });
      const sb = await save.boundingBox();
      const cb = await cancel.boundingBox();
      check(
        `${tag}: "Cancelar" antes de "Salvar", à direita`,
        cb.x < sb.x && sb.x + sb.width > SIZES[size].width / 2,
      );
    },
  },
  {
    name: 'seletor próprio aberto',
    path: '/dev/forms',
    run: async (page, tag) => {
      const trigger = page.getByRole('button', { name: /Categoria/ });
      await trigger.evaluate((el) => el.scrollIntoView({ block: 'center' }));
      await page.waitForTimeout(200);
      await trigger.click();
      const list = page.getByRole('listbox');
      await list.waitFor();
      await list.getByRole('option').first().waitFor();
      await page.waitForTimeout(150);
      check(`${tag}: lista visível`, await list.isVisible());
      check(`${tag}: 5 opções`, (await list.getByRole('option').count()) === 5);
      check(`${tag}: lista dentro da janela`, await inViewport(page, list));
    },
  },
  {
    name: 'calendário aberto',
    path: '/dev/forms',
    run: async (page, tag) => {
      const trigger = page.getByRole('button', { name: /Vencimento/ });
      await trigger.evaluate((el) => el.scrollIntoView({ block: 'center' }));
      await page.waitForTimeout(200);
      await trigger.click();
      const dialog = page.getByRole('dialog', { name: 'Vencimento' });
      await dialog.waitFor();
      check(`${tag}: calendário visível`, await dialog.isVisible());
      check(
        `${tag}: calendário dentro da janela`,
        await popoverBox(page, dialog),
        await page.evaluate(() => window.__box),
      );
      check(
        `${tag}: botões "Hoje" e "Limpar"`,
        (await dialog.getByRole('button', { name: 'Hoje', exact: true }).isVisible()) &&
          (await dialog.getByRole('button', { name: 'Limpar', exact: true }).isVisible()),
      );
      const month = await dialog
        .getByText(/^[a-zç]+ de \d{4}$/i)
        .first()
        .textContent();
      check(`${tag}: mês exibido por extenso`, !!month, month ?? '');
    },
  },
  {
    name: 'hora "930" vira "09:30"',
    path: '/dev/forms',
    run: async (page, tag) => {
      const time = page.getByLabel(/hora \(24 horas\)/);
      await time.scrollIntoViewIfNeeded();
      await time.fill('930');
      await time.blur();
      await page.waitForTimeout(100);
      const value = await time.inputValue();
      check(`${tag}: campo de hora normalizou "930"`, value === '09:30', `valor "${value}"`);
    },
  },
  {
    name: 'seletor de cor aberto',
    path: '/dev/forms',
    run: async (page, tag) => {
      const trigger = page.getByRole('button', { name: /Cor/ });
      await trigger.evaluate((el) => el.scrollIntoView({ block: 'center' }));
      await page.waitForTimeout(200);
      await trigger.click();
      const dialog = page.locator('dialog[open]');
      await dialog.waitFor();
      check(`${tag}: diálogo de cor visível`, await dialog.isVisible());
      check(`${tag}: diálogo dentro da janela`, await popoverBox(page, dialog));
      const fields = await dialog.locator('input').count();
      check(`${tag}: campos HEX, RGB e HSL`, fields >= 7, `${fields} campos`);
      const values = await dialog.locator('input').evaluateAll((els) => els.map((e) => e.value));
      const hex = values.find((v) => /^#?[0-9a-f]{6}$/i.test(v)) ?? values.join(',');
      check(`${tag}: HEX inicial #7C3AED`, hex.replace('#', '').toUpperCase() === '7C3AED', hex);
      check(
        `${tag}: roda de cor presente`,
        (await dialog.locator('canvas, [role="slider"]').count()) > 0,
      );
    },
  },
  {
    name: 'seletor de período aberto',
    path: '/dev/forms',
    run: async (page, tag) => {
      const trigger = page.getByRole('button', { name: /Período/ });
      await trigger.evaluate((el) => el.scrollIntoView({ block: 'center' }));
      await page.waitForTimeout(200);
      await trigger.click();
      const dialog = page.getByRole('dialog', { name: 'Escolher período' });
      await dialog.waitFor();
      await page.waitForTimeout(250);
      check(`${tag}: popover do período visível`, await dialog.isVisible());
      check(
        `${tag}: popover dentro da janela`,
        await popoverBox(page, dialog),
        await page.evaluate(() => window.__box),
      );
      const pressed = await dialog.locator('[aria-pressed="true"]').first().textContent();
      check(`${tag}: preset "Este mês" marcado`, /Este mês/.test(pressed ?? ''), pressed ?? '');
    },
  },
  {
    name: 'erro de campo obrigatório',
    path: '/dev/forms',
    run: async (page, tag) => {
      const save = page.getByRole('button', { name: 'Salvar' });
      await save.scrollIntoViewIfNeeded();
      await save.click();
      const alert = page.getByRole('alert').filter({ hasText: 'Campo obrigatório' }).first();
      await alert.waitFor();
      check(`${tag}: erro "Campo obrigatório" visível`, await alert.isVisible());
      const invalid = await page.locator('[aria-invalid="true"]').count();
      check(`${tag}: campo marcado como inválido`, invalid >= 1, `${invalid} campo(s)`);
      await page.locator('[aria-invalid="true"]').first().scrollIntoViewIfNeeded();
    },
  },
  {
    name: '"Mais ações" aberto',
    path: '/dev/forms',
    run: async (page, tag) => {
      await page.getByRole('button', { name: 'Mais ações' }).first().click();
      const menu = page.getByRole('menu', { name: 'Mais ações' });
      await menu.waitFor();
      check(`${tag}: menu visível`, await menu.isVisible());
      check(`${tag}: menu dentro da janela`, await popoverBox(page, menu));
      const del = menu.getByRole('menuitem', { name: 'Excluir' });
      check(`${tag}: item "Excluir" visível`, await del.isVisible());
    },
  },
];

// ---------- evidência: app x protótipo ----------

const METRICS = `(() => {
  const q = (s) => document.querySelector(s);
  const px = (v) => Math.round(parseFloat(v) * 10) / 10;
  const side = q('aside#sidebar');
  const bar = q('header.topbar') || q('#root header:not([data-stuck])') || q('header');
  const h1 = q('h1');
  const form = q('form');
  const link = q('a[href]');
  const gs = (el) => (el ? getComputedStyle(el) : null);
  const brand = [...document.querySelectorAll('aside#sidebar *')].find((e) => e.children.length === 0 && e.textContent.trim() === 'Atria');
  return {
    primary: getComputedStyle(document.documentElement).getPropertyValue('--primary').trim().toUpperCase(),
    bodyBg: gs(document.body).backgroundColor,
    bodyFont: gs(document.body).fontFamily.split(',')[0].replace(/"/g, '').trim(),
    sidebarWidth: side ? px(side.getBoundingClientRect().width) : null,
    sidebarBg: side ? gs(side).backgroundColor : null,
    brandHasPath: !!q('aside#sidebar svg path[d="M3 20L12 4l9 16"]'),
    brandClip: brand ? gs(brand).backgroundClip || gs(brand).webkitBackgroundClip : null,
    brandSize: brand ? px(gs(brand).fontSize) : null,
    topbarHeight: bar ? px(bar.getBoundingClientRect().height) : null,
    h1Size: h1 ? px(gs(h1).fontSize) : null,
    h1Weight: h1 ? gs(h1).fontWeight : null,
    h1Font: h1 ? gs(h1).fontFamily.split(',')[0].replace(/"/g, '').trim() : null,
    formWidth: form ? px(form.getBoundingClientRect().width) : null,
    formBg: form ? gs(form).backgroundColor : null,
    linkDecoration: link ? gs(link).textDecorationLine : null,
  };
})()`;

/** Compara só as grandezas que o protótipo define; a lista diz o que é igual e o que difere. */
function compareMetrics(tag, app, proto, size) {
  const same = (name, a, b, tol = 1) =>
    check(
      `${tag}: ${name} igual ao protótipo`,
      typeof a === 'number' && typeof b === 'number' ? Math.abs(a - b) <= tol : a === b,
      `app ${a} · protótipo ${b}`,
    );
  same('cor primária (--primary)', app.primary, proto.primary);
  same('fundo da página', app.bodyBg, proto.bodyBg);
  same('fonte do texto', app.bodyFont, proto.bodyFont);
  same('fonte do título', app.h1Font, proto.h1Font);
  same('tamanho do título', app.h1Size, proto.h1Size);
  same('peso do título', app.h1Weight, proto.h1Weight);
  check(`${tag}: marca em traço "M3 20L12 4l9 16" no app`, app.brandHasPath === true);
  check(
    `${tag}: nome "Atria" com texto em gradiente no app`,
    app.brandClip === 'text',
    String(app.brandClip),
  );
  same('tamanho do nome da marca', app.brandSize, proto.brandSize);
  if (size === 'desktop') {
    same('largura da sidebar', app.sidebarWidth, proto.sidebarWidth);
    same('fundo da sidebar', app.sidebarBg, proto.sidebarBg);
  }
  if (size === 'desktop') same('altura da topbar', app.topbarHeight, proto.topbarHeight);
  else
    check(
      `${tag}: topbar do app não maior que a do protótipo (a busca do protótipo quebra em 2 linhas)`,
      app.topbarHeight <= proto.topbarHeight,
      `app ${app.topbarHeight} · protótipo ${proto.topbarHeight}`,
    );
  same('links sem sublinhado', app.linkDecoration, proto.linkDecoration);
}

async function runPrototype(browser, base) {
  const shots = [];
  for (const theme of THEMES) {
    for (const size of ['desktop', 'mobile']) {
      const tag = `app x protótipo · ${SIZE_LABEL[size]} · ${THEME_LABEL[theme]}`;
      const app = await openPage(browser, { theme, size, key: 'atria_theme' });
      const proto = await openPage(browser, { theme, size, key: 'atria-theme' });
      try {
        await gotoApp(app.page, base, '/dev/forms');
        await proto.page.goto(`${PROTOTYPE}#/journal/new`);
        await proto.page.locator('[data-module="journal"] form').waitFor();
        await proto.page.waitForTimeout(700);
        await proto.page.evaluate(() => document.fonts.ready);
        check(`${tag}: protótipo aberto por file://`, proto.page.url().startsWith('file://'));
        const a = await app.page.evaluate(METRICS);
        const p = await proto.page.evaluate(
          METRICS.replace(`q('form')`, `q('[data-module="journal"] form')`).replace(
            `q('h1')`,
            `q('[data-module="journal"] h1')`,
          ),
        );
        compareMetrics(tag, a, p, size);
        await baseChecks(app.page, app.errors, `${tag} (app)`, theme);
        check(`${tag} (protótipo): sem rolagem horizontal`, await noOverflow(proto.page));
        shots.push(
          {
            size,
            row: `${theme}-${size}`,
            label: `app · /dev/forms · ${SIZE_LABEL[size]} · ${THEME_LABEL[theme]}`,
            png: await app.page.screenshot(),
          },
          {
            size,
            row: `${theme}-${size}`,
            label: `protótipo · #/journal/new · ${SIZE_LABEL[size]} · ${THEME_LABEL[theme]}`,
            png: await proto.page.screenshot(),
          },
        );
      } catch (e) {
        check(`${tag}: cenário executou`, false, String(e.message).split('\n')[0]);
      } finally {
        await app.context.close();
        await proto.context.close();
      }
    }
  }
  return shots;
}

// ---------- principal ----------

const EVIDENCES = {
  layout: async (browser, base) => {
    const shots = await runApp(browser, base, layoutScenarios, ['desktop', 'mobile']);
    await sheet(browser, {
      title: 'TASK-05 · layout do app (CT-11, RNF-08, RNF-10, PD-18, PD-20, PD-23)',
      file: 'layout-telas.png',
      shots,
      scale: { desktop: 0.5, mobile: 0.62 },
    });
  },
  forms: async (browser, base) => {
    const shots = await runApp(browser, base, formsScenarios, ['desktop', 'mobile']);
    await sheet(browser, {
      title:
        'TASK-05 · componentes de formulário em /dev/forms (PD-02, PD-03, PD-11, PD-12, PD-14, PD-57, PD-62)',
      file: 'form-componentes.png',
      shots,
      scale: { desktop: 0.5, mobile: 0.62 },
    });
  },
  prototipo: async (browser, base) => {
    const shots = await runPrototype(browser, base);
    await sheet(browser, {
      title: 'TASK-05 · app x protótipo lado a lado (fidelidade visual)',
      file: 'app-x-prototipo.png',
      shots,
      scale: { desktop: 0.5, mobile: 0.75 },
    });
  },
};

const wanted = process.argv.slice(2);
const names = wanted.length > 0 ? wanted : Object.keys(EVIDENCES);
const unknown = names.filter((n) => !(n in EVIDENCES));
if (unknown.length > 0) {
  console.error(`Evidência desconhecida: ${unknown.join(', ')}. Use layout, forms ou prototipo.`);
  process.exit(2);
}

let vite;
let browser;
try {
  vite = await startVite();
  console.log(`vite: ${vite.url} (porta livre, encerrado ao final)`);
  browser = await chromium.launch();
  for (const name of names) {
    console.log(`\n== ${name} ==`);
    await EVIDENCES[name](browser, vite.url);
  }
} catch (e) {
  failures += 1;
  console.log(`FALHA  execução: ${e.message}`);
} finally {
  await browser?.close();
  if (vite) vite.stop();
}
console.log(`\n${failures === 0 ? 'ok' : 'FALHA'}  ${failures} falha(s)`);
process.exit(failures === 0 ? 0 : 1);
