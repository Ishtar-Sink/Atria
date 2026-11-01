// Evidências da cor HEX das categorias do Financeiro (TASK-13 da SPEC-003), sem passo manual:
// sobe o Vite numa porta livre com uma página virtual que carrega
// `src/features/finance/evidence/harness.tsx`, simula a API no navegador com fixtures em memória,
// confere o estado no DOM (e o axe) antes de cada captura e grava em $VOSTOK_EVIDENCE (padrão
// vostok/work/tasks/SPEC-003/TASK-13/evidencias):
// - telas: category-color.png (Configurações, detalhe, painel e o seletor de cor, nos dois temas
//   e larguras);
// - video: category-color.webm (criar e editar uma categoria no seletor de cor).
// Uso: node apps/web/scripts/evidence-category-color.mjs telas|video
// Imprime "ok" ou "FALHA" por verificação; sai com 1 se algo falhar e com 2 num modo desconhecido.
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createServer as createNetServer } from 'node:net';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import AxeBuilder from '@axe-core/playwright';
import { chromium } from '@playwright/test';
import { createServer } from 'vite';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = join(WEB, '..', '..');
const OUT =
  process.env.VOSTOK_EVIDENCE ??
  join(ROOT, 'vostok', 'work', 'tasks', 'SPEC-003', 'TASK-13', 'evidencias');
const HARNESS_PATH = '/__evidence/finance';
const HARNESS_ENTRY = '/src/features/finance/evidence/harness.tsx';
// Relógio fixo: quinta, 05/11/2026, meio-dia em São Paulo.
const NOW = new Date('2026-11-05T15:00:00Z');

const SIZES = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 360, height: 760 },
};
const SIZE_LABEL = { desktop: 'desktop 1440', mobile: '360 px' };
const THEME_LABEL = { light: 'claro', dark: 'escuro' };
const ALL = [
  ['light', 'desktop'],
  ['dark', 'desktop'],
  ['light', 'mobile'],
  ['dark', 'mobile'],
];
const PAIR = [
  ['light', 'desktop'],
  ['dark', 'mobile'],
];

let failures = 0;
function check(name, cond, extra) {
  if (!cond) failures += 1;
  console.log(`${cond ? 'ok    ' : 'FALHA '} ${name}${extra ? ` · ${extra}` : ''}`);
}

// ---------- fixtures ----------

const STAMP = { created_at: '2026-11-01T10:00:00Z', updated_at: '2026-11-02T10:00:00Z' };

function account(o) {
  return {
    balance_amount: 0,
    currency: 'BRL',
    is_default: false,
    owner_id: 'u1',
    visibility: 'personal',
    ...STAMP,
    ...o,
  };
}

function category(o) {
  return { kind: 'expense', owner_id: 'u1', visibility: 'personal', ...STAMP, ...o };
}

const CLARA = 'c3';
const NOITE = 'c4';

function seed() {
  return {
    accounts: [
      account({ id: 'a1', name: 'Conta principal', is_default: true, balance_amount: 700000 }),
    ],
    categories: [
      category({ id: 'c1', name: 'Mercado', color: '#92400e' }),
      category({ id: 'c2', name: 'Casa', color: '#0369a1' }),
      category({ id: CLARA, name: 'Clara', color: '#fef08a' }),
      category({ id: NOITE, name: 'Noite', color: '#1e1b4b' }),
      category({ id: 'c5', name: 'Salário', kind: 'income', color: '#047857' }),
    ],
    posts: [],
    patches: [],
  };
}

/** Resumo do painel: o "Para onde foi" sai das categorias de saída, com a cor atual de cada uma. */
function summary(state) {
  const expenses = state.categories.filter((c) => c.kind === 'expense');
  return {
    period: { from: '2026-11-01', to: '2026-11-30' },
    previous_period: { from: '2026-10-01', to: '2026-10-31' },
    totals: {
      income: { realized: 500000, forecast: 600000 },
      expense: { realized: 218000, forecast: 512000 },
      surplus: { realized: 282000, forecast: 88000 },
    },
    previous_totals: null,
    where_it_went: expenses.map((c, i) => ({
      group: 'category',
      category_id: c.id,
      name: c.name,
      color: c.color,
      amount: 90000 - i * 10000,
    })),
    expected_vs_settled: {
      income: { expected_amount: 600000, settled_amount: 500000 },
      expense: { expected_amount: 512000, settled_amount: 218000 },
    },
    savings_and_losses: { savings_amount: 2000, gains_amount: 0, losses_amount: 1500 },
    balance: {
      current: 700000,
      forecast_at_period_end: 662000,
      accounts: [{ id: 'a1', name: 'Conta principal', balance_amount: 700000 }],
    },
    upcoming_bills: [],
    monthly: [],
    currency: 'BRL',
  };
}

const problem = (status, code) => ({
  status,
  body: { type: 'about:blank', title: code, status, code },
});
const page = (items) => ({ body: { items, next_cursor: null } });

function matchPath(pattern, path) {
  const left = pattern.split('/');
  const right = path.split('/');
  if (left.length !== right.length) return null;
  const params = {};
  for (const [i, part] of left.entries()) {
    if (part.startsWith(':')) params[part.slice(1)] = decodeURIComponent(right[i]);
    else if (part !== right[i]) return null;
  }
  return params;
}

function routes(state) {
  const find = (id) => state.categories.find((c) => c.id === id);
  return {
    'GET /me': () => ({ body: { id: 'u1', email: 'ana@exemplo.com', display_name: 'Ana Souza' } }),
    'GET /me/preferences': () => ({ body: {} }),
    'GET /accounts': () => page(state.accounts),
    'GET /categories': (call) => {
      const kind = call.url.searchParams.get('kind');
      return page(state.categories.filter((c) => kind === null || c.kind === kind));
    },
    'GET /categories/:id': (_c, { id }) => {
      const found = find(id);
      return found ? { body: found } : problem(404, 'not_found');
    },
    'POST /categories': (call) => {
      state.posts.push(call.body);
      const created = category({ id: 'c9', ...call.body });
      state.categories.push(created);
      return { status: 201, body: created };
    },
    'PATCH /categories/:id': (call, { id }) => {
      state.patches.push(call.body);
      const found = find(id);
      if (!found) return problem(404, 'not_found');
      Object.assign(found, call.body);
      return { body: found };
    },
    'GET /transactions': () => page([]),
    'GET /financial-summaries': () => ({ body: summary(state) }),
  };
}

/** Intercepta `/api/**` no navegador: a API é simulada, sem servidor Rust (KNW-007). */
async function mockApi(context, state) {
  const table = routes(state);
  await context.route(
    (u) => u.pathname.startsWith('/api/'),
    async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const path = url.pathname.replace(/^\/api\/v1/, '');
      const method = request.method();
      let body;
      try {
        body = request.postDataJSON();
      } catch {
        body = undefined;
      }
      let reply = problem(404, 'not_found');
      for (const [key, handler] of Object.entries(table)) {
        const [m, pattern] = key.split(' ');
        if (m !== method) continue;
        const params = matchPath(pattern, path);
        if (params === null) continue;
        reply = handler({ method, path, url, body }, params);
        break;
      }
      const status = reply.status ?? 200;
      try {
        await route.fulfill({
          status,
          contentType: status >= 400 ? 'application/problem+json' : 'application/json',
          body: status === 204 || reply.body === undefined ? '' : JSON.stringify(reply.body),
        });
      } catch {
        /* página já fechada */
      }
    },
  );
}

// ---------- servidor de desenvolvimento ----------

const HTML = `<!doctype html>
<html lang="pt-BR" data-theme="light">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light dark" />
    <title>Atria · evidência da cor das categorias</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="${HARNESS_ENTRY}"></script>
  </body>
</html>`;

/** Página virtual do harness: só existe neste servidor, nunca no build de produção. */
function harnessPage() {
  return {
    name: 'atria-category-color-evidence',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith(HARNESS_PATH)) return next();
        try {
          const html = await server.transformIndexHtml(req.url, HTML);
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.end(html);
        } catch (e) {
          next(e);
        }
        return undefined;
      });
    },
  };
}

function freePort() {
  return new Promise((resolve, reject) => {
    const probe = createNetServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

async function startVite() {
  const port = await freePort();
  const server = await createServer({
    root: WEB,
    configFile: join(WEB, 'vite.config.ts'),
    logLevel: 'error',
    clearScreen: false,
    plugins: [harnessPage()],
    server: { host: '127.0.0.1', port, strictPort: true, proxy: {}, hmr: false },
  });
  await server.listen();
  return { url: `http://127.0.0.1:${String(port)}`, stop: () => server.close() };
}

// ---------- captura ----------

async function themed(context, theme) {
  await context.clock.setFixedTime(NOW);
  await context.addInitScript((t) => {
    try {
      localStorage.setItem('atria_theme', t);
    } catch {
      /* sem armazenamento */
    }
  }, theme);
  context.setDefaultTimeout(10000);
}

async function openPage(browser, { theme, size }) {
  const context = await browser.newContext({
    viewport: SIZES[size],
    reducedMotion: 'reduce',
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
  });
  await themed(context, theme);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  return { page, context, errors };
}

async function axeCheck(page, tag) {
  const result = await new AxeBuilder({ page }).analyze();
  const list = result.violations.map(
    (v) => `${v.id}(${String(v.nodes.length)}): ${v.nodes[0]?.target.join(' ') ?? ''}`,
  );
  const contrast =
    result.passes.some((p) => p.id === 'color-contrast') ||
    result.violations.some((v) => v.id === 'color-contrast') ||
    result.incomplete.some((v) => v.id === 'color-contrast');
  check(
    `${tag}: axe sem violações (inclusive color-contrast)`,
    result.violations.length === 0 && contrast,
    list.join(' | '),
  );
}

async function baseChecks(page, errors, tag, theme) {
  const applied = await page.evaluate(() => document.documentElement.dataset.theme);
  check(`${tag}: tema ${THEME_LABEL[theme]} aplicado`, applied === theme);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );
  check(`${tag}: sem rolagem horizontal`, !overflow);
  check(`${tag}: sem erro de JS`, errors.length === 0, errors.join(' | '));
  await axeCheck(page, tag);
}

async function gotoHarness(page, base, path) {
  await page.goto(`${base}${HARNESS_PATH}?path=${encodeURIComponent(path)}`);
  await page.locator('h1').first().waitFor({ timeout: 20000 });
  await page.evaluate(() => document.fonts.ready);
}

/** `#rrggbb` como o navegador devolve na cor calculada: `rgb(r, g, b)`. */
function rgb(hex) {
  const [r, g, b] = [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16));
  return `rgb(${String(r)}, ${String(g)}, ${String(b)})`;
}

const background = (locator) => locator.evaluate((el) => getComputedStyle(el).backgroundColor);

/** Preenchimento da barra de `label` no "Para onde foi". */
function barFill(page, label) {
  return page
    .getByRole('figure', { name: 'Saídas por categoria' })
    .locator('li')
    .filter({ hasText: label })
    .locator('[class*="barFill"]');
}

// ---------- cenários ----------

const scenarios = [
  {
    name: 'Configurações',
    path: '/finance/settings',
    combos: ALL,
    run: async (page, tag) => {
      await page.getByRole('link', { name: 'Mercado' }).waitFor();
      const state = seed();
      const rows = [];
      for (const c of state.categories) {
        const row = page.locator('li').filter({ has: page.getByRole('link', { name: c.name }) });
        const dot = row.locator('[class*="dot"]').first();
        const ok =
          (await background(dot)) === rgb(c.color) && (await row.innerText()).includes(c.color);
        if (!ok) rows.push(c.name);
      }
      check(`${tag}: ponto com o HEX da categoria`, rows.length === 0, rows.join(', '));
    },
  },
  ...[
    [CLARA, 'Clara', '#fef08a', 'rgb(26, 18, 48)'],
    [NOITE, 'Noite', '#1e1b4b', 'rgb(255, 255, 255)'],
  ].map(([id, name, hex, ink]) => ({
    name: `detalhe de ${name}`,
    path: `/finance/categories/${id}`,
    combos: ALL,
    run: async (page, tag) => {
      await page.getByRole('heading', { level: 1, name }).waitFor();
      const sample = page.locator('[data-color-sample]');
      const color = await sample.evaluate((el) => getComputedStyle(el).color);
      check(
        `${tag}: amostra legível em ${name}`,
        (await background(sample)) === rgb(hex) && color === ink,
        `${await background(sample)} / ${color}`,
      );
    },
  })),
  {
    name: 'painel',
    path: '/finance',
    combos: ALL,
    run: async (page, tag) => {
      await page.getByRole('figure', { name: 'Saídas por categoria' }).waitFor();
      const wrong = [];
      for (const c of seed().categories.filter((x) => x.kind === 'expense')) {
        if ((await background(barFill(page, c.name))) !== rgb(c.color)) wrong.push(c.name);
      }
      check(`${tag}: barras na cor da categoria`, wrong.length === 0, wrong.join(', '));
    },
  },
  {
    name: 'nova categoria, seletor de cor',
    path: '/finance/categories/new',
    combos: PAIR,
    run: async (page, tag) => {
      await page.getByRole('heading', { level: 1, name: 'Nova categoria' }).waitFor();
      await page.getByRole('button', { name: /^Cor/ }).click();
      const dialog = page.getByRole('dialog', { name: 'Escolher cor' });
      await dialog.waitFor();
      check(`${tag}: diálogo Escolher cor aberto`, await dialog.isVisible());
    },
  },
];

async function runScenarios(browser, base) {
  const shots = [];
  for (const sc of scenarios) {
    for (const [theme, size] of sc.combos) {
      const tag = `${sc.name} · ${SIZE_LABEL[size]} · ${THEME_LABEL[theme]}`;
      const { page, context, errors } = await openPage(browser, { theme, size });
      try {
        await mockApi(context, seed());
        await gotoHarness(page, base, sc.path);
        await sc.run(page, tag);
        await page.waitForTimeout(250);
        await baseChecks(page, errors, tag, theme);
        shots.push({ size, label: tag, png: await page.screenshot() });
      } catch (e) {
        check(`${tag}: cenário executou`, false, String(e.message).split('\n')[0]);
      } finally {
        await context.close();
      }
    }
  }
  return shots;
}

async function sheet(browser, { title, file, shots, scale }) {
  const figure = (s) => {
    const w = Math.round(SIZES[s.size].width * scale[s.size]);
    return `<figure style="width:${w}px"><img style="width:${w}px" src="data:image/png;base64,${s.png.toString('base64')}"><figcaption>${s.label}</figcaption></figure>`;
  };
  const html = `<!doctype html><meta charset="utf-8"><style>
    body{margin:0;padding:24px;background:#1b1b20;color:#e8e8ee;font:13px/1.4 system-ui,sans-serif}
    h1{font-size:18px;margin:0 0 16px}
    main{display:flex;flex-wrap:wrap;gap:20px;align-items:flex-start}
    figure{margin:0}
    img{display:block;border:1px solid #444;border-radius:4px}
    figcaption{margin-top:6px;color:#b8b8c4}
  </style><h1>${title}</h1><main>${shots.map(figure).join('')}</main>`;
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

// ---------- vídeo ----------

/** Marcador do cursor no vídeo: o Playwright não desenha o ponteiro. */
const CURSOR_MARKER = () => {
  const dot = document.createElement('div');
  dot.style.cssText =
    'position:fixed;z-index:2147483647;pointer-events:none;left:0;top:0;display:none;';
  dot.innerHTML =
    '<div style="width:12px;height:12px;border-radius:50%;background:#e11d48;border:2px solid #fff;box-shadow:0 0 0 1px #000"></div>' +
    '<div data-label style="margin:4px 0 0 14px;padding:2px 6px;border-radius:4px;background:#111;color:#fff;font:600 12px system-ui;white-space:nowrap"></div>';
  const label = dot.querySelector('[data-label]');
  const place = (event) => {
    dot.style.display = 'block';
    dot.style.transform = `translate(${event.clientX - 6}px, ${event.clientY - 6}px)`;
    requestAnimationFrame(() => {
      const under = document.elementFromPoint(event.clientX, event.clientY);
      label.textContent = `cursor: ${under ? getComputedStyle(under).cursor : 'default'}`;
    });
  };
  window.addEventListener('mousemove', place, true);
  window.addEventListener('mousedown', place, true);
  window.addEventListener('mouseup', place, true);
  document.addEventListener('DOMContentLoaded', () => document.body.append(dot));
};

async function recordVideo(browser, base) {
  mkdirSync(OUT, { recursive: true });
  const size = { width: 1280, height: 800 };
  const context = await browser.newContext({
    viewport: size,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    recordVideo: { dir: join(OUT, 'video-tmp'), size },
  });
  await themed(context, 'light');
  await context.addInitScript(CURSOR_MARKER);
  const page = await context.newPage();
  const video = page.video();
  const pause = (ms) => page.waitForTimeout(ms);
  const clickAt = async (locator) => {
    const box = await locator.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 20 });
    await pause(400);
    await page.mouse.down();
    await page.mouse.up();
    await pause(500);
  };
  const pickHex = async (hex) => {
    await clickAt(page.getByRole('button', { name: /^Cor/ }));
    const dialog = page.getByRole('dialog', { name: 'Escolher cor' });
    await dialog.waitFor();
    await pause(1000);
    const field = dialog.getByLabel('HEX');
    await clickAt(field);
    await field.fill('');
    await page.keyboard.type(hex, { delay: 160 });
    await pause(800);
    await clickAt(dialog.getByRole('button', { name: 'Aplicar' }));
    await pause(900);
  };
  const state = seed();
  try {
    await mockApi(context, state);
    await gotoHarness(page, base, '/finance/categories/new?kind=expense');
    await page.getByRole('heading', { level: 1, name: 'Nova categoria' }).waitFor();
    await page.mouse.move(640, 760);
    await pause(1200);

    // 1. Nome e cor livre no seletor, e salvar.
    await clickAt(page.getByRole('textbox', { name: 'Nome' }));
    await page.keyboard.type('Viagens', { delay: 140 });
    await pause(600);
    await pickHex('#0EA5E9');
    await clickAt(page.getByRole('button', { name: 'Salvar' }));
    await page.getByRole('heading', { level: 1, name: 'Viagens' }).waitFor();
    await pause(1200);
    check(
      'vídeo: POST com color #0ea5e9',
      state.posts[0]?.color === '#0ea5e9',
      JSON.stringify(state.posts[0] ?? null),
    );
    const sample = page.locator('[data-color-sample]');
    check('vídeo: amostra #0ea5e9 no detalhe', (await sample.innerText()).trim() === '#0ea5e9');

    // 2. Editar e trocar a cor.
    await clickAt(page.getByRole('button', { name: 'Editar' }));
    await page.getByRole('heading', { level: 1, name: 'Editar categoria' }).waitFor();
    await pause(900);
    await pickHex('#F59E0B');
    await clickAt(page.getByRole('button', { name: 'Salvar' }));
    await page.getByRole('heading', { level: 1, name: 'Viagens' }).waitFor();
    await pause(1200);
    check(
      'vídeo: PATCH com color #f59e0b',
      state.patches[0]?.color === '#f59e0b',
      JSON.stringify(state.patches[0] ?? null),
    );

    // 3. A nova cor no "Para onde foi".
    await gotoHarness(page, base, '/finance');
    const fill = barFill(page, 'Viagens');
    await fill.waitFor();
    await fill.scrollIntoViewIfNeeded();
    await pause(1500);
    check(
      'vídeo: barra de Viagens na nova cor',
      (await background(fill)) === 'rgb(245, 158, 11)',
      await background(fill),
    );
    await pause(2500);
  } catch (e) {
    check('vídeo: cenário executou', false, String(e.message).split('\n').slice(0, 3).join(' / '));
  } finally {
    await context.close();
  }
  const path = join(OUT, 'category-color.webm');
  await video.saveAs(path);
  rmSync(join(OUT, 'video-tmp'), { recursive: true, force: true });
  console.log(`video: ${relative(ROOT, path)}`);
}

// ---------- principal ----------

const MODES = {
  telas: async (browser, base) => {
    const shots = await runScenarios(browser, base);
    await sheet(browser, {
      title:
        'TASK-13 · cor HEX das categorias (RF-18, RN-09, CT-12, CB-09) · API simulada, relógio em 05/11/2026',
      file: 'category-color.png',
      shots,
      scale: { desktop: 0.5, mobile: 0.62 },
    });
  },
  video: recordVideo,
};

const wanted = process.argv.slice(2);
const names = wanted.length > 0 ? wanted : Object.keys(MODES);
const unknown = names.filter((n) => !(n in MODES));
if (unknown.length > 0) {
  console.error(`Modo desconhecido: ${unknown.join(', ')}. Use telas ou video.`);
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
    await MODES[name](browser, vite.url);
  }
} catch (e) {
  failures += 1;
  console.log(`FALHA  execução: ${e.message}`);
} finally {
  await browser?.close();
  await vite?.stop();
}
console.log(`\n${failures === 0 ? 'ok' : 'FALHA'}  ${failures} falha(s)`);
process.exit(failures === 0 ? 0 : 1);
