// Evidências visuais da TASK-34 (telas de Relatórios), sem passo manual: sobe o Vite numa porta livre
// (createServer da API do Vite) com uma página virtual que carrega src/features/reports/evidence/
// harness.tsx, simula a API no Chromium do Playwright e fotografa os estados nos temas claro e
// escuro, em 1440 px e em 360 px, conferindo o DOM antes de cada captura.
// Uso: node apps/web/scripts/evidence-reports.mjs temas|estados   (sem argumento, gera as duas)
// Imprime "ok" ou "FALHA" por verificação e o caminho do PNG; sai com código 1 se algo falhar.
import AxeBuilder from '@axe-core/playwright';
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createServer as createNetServer } from 'node:net';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer as createViteServer } from 'vite';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = join(WEB, '..', '..');
const OUT = join(ROOT, 'vostok', 'work', 'tasks', 'SPEC-001', 'evidence', 'TASK-34');
const PAGE_PATH = '/__evidence-reports';
const HARNESS = '/src/features/reports/evidence/harness.tsx';

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
    const server = createNetServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

/** Plugin que serve a página HTML virtual carregando o harness, sem arquivo novo no app. */
function evidencePage() {
  return {
    name: 'atria-evidence-reports-page',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url || new URL(req.url, 'http://x').pathname !== PAGE_PATH) return next();
        const html = await server.transformIndexHtml(
          PAGE_PATH,
          `<!doctype html>
<html lang="pt-BR" data-theme="light">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light dark" />
    <title>Atria · evidência de Relatórios</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="${HARNESS}"></script>
  </body>
</html>`,
        );
        res.setHeader('Content-Type', 'text/html');
        res.end(html);
      });
    },
  };
}

async function startVite() {
  const port = await freePort();
  const server = await createViteServer({
    root: WEB,
    configFile: join(WEB, 'vite.config.ts'),
    logLevel: 'error',
    plugins: [evidencePage()],
    server: { port, strictPort: true, host: '127.0.0.1' },
  });
  await server.listen();
  return { url: `http://127.0.0.1:${port}`, stop: () => server.close() };
}

const NOW = new Date('2026-11-05T15:00:00Z');

// ---------- API simulada (fixtures em memória) ----------

const USER = {
  id: '00000000-0000-4000-8000-000000000001',
  email: 'ana@atria.test',
  display_name: 'Ana Souza',
};
const uuid = (n) => `00000000-0000-4000-8000-0000000003${String(n).padStart(2, '0')}`;
const CATEGORY_ID = uuid(1);

const named = (n, key, name) => ({ id: uuid(n), [key]: name, owner_id: USER.id });
const ACCOUNTS = [named(10, 'name', 'Conta corrente'), named(11, 'name', 'Cartão Roxinho')];
const CATEGORIES = [
  named(1, 'name', 'Mercado'),
  named(2, 'name', 'Moradia'),
  named(3, 'name', 'Transporte'),
];
const OPTIONS = {
  '/accounts': ACCOUNTS,
  '/categories': CATEGORIES,
  '/books': [named(20, 'title', 'Dom Casmurro')],
  '/goals': [named(30, 'title', 'Aprender violão')],
  '/projects': [named(40, 'name', 'Reforma')],
};

const FIN_CAT = {
  report: 'fin-cat',
  generated_on: '2026-11-05',
  filters: [],
  period: { from: '2026-11-01', to: '2026-11-30' },
  any_period: false,
  currency: 'BRL',
  total_expense: 485000,
  categories: [
    { category_id: uuid(2), name: 'Moradia', amount: 180000, percent: 37.1 },
    { category_id: uuid(1), name: 'Mercado', amount: 142500, percent: 29.4 },
    { category_id: uuid(3), name: 'Transporte', amount: 86000, percent: 17.7 },
    { category_id: null, name: 'Sem categoria', amount: 76500, percent: 15.8 },
  ],
};
const TASKS_DONE = {
  report: 'tasks-done',
  generated_on: '2026-11-05',
  filters: [],
  completed: 18,
  open: 7,
  overdue: 2,
  recurring_notice: 'As tarefas diárias ficam fora.',
};
const MODELS = { 'fin-cat': FIN_CAT, 'tasks-done': TASKS_DONE };

const json = (route, body, status = 200, contentType = 'application/json') =>
  route.fulfill({ status, contentType, body: JSON.stringify(body) });
const problem = (route, status, code, title) =>
  json(route, { title, code, status }, status, 'application/problem+json');

/**
 * Instala a API simulada. `mode`: "normal" | "pdf-slow" | "pdf-error" | "filter-refused" |
 * "exports-slow". Nos modos "-slow" o arquivo só responde quando `release()` é chamada.
 */
async function installApi(context, mode, unknown) {
  let release = () => {};
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  await context.route(
    (url) => url.pathname.startsWith('/api/'),
    async (route) => {
      const url = new URL(route.request().url());
      const method = route.request().method();
      const path = url.pathname.replace('/api/v1', '');
      if (method !== 'GET') {
        unknown.push(`${method} ${path}`);
        return problem(route, 404, 'not_found', 'Não simulada');
      }
      if (path === '/me') return json(route, USER);
      if (path in OPTIONS) {
        const items =
          path === '/categories' && url.searchParams.get('kind') !== 'expense' ? [] : OPTIONS[path];
        return json(route, { items, next_cursor: null });
      }
      if (path === '/emotions') return json(route, { items: [] });
      if (path === '/exports') {
        if (mode === 'exports-slow') await gate;
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: { 'Content-Disposition': 'attachment; filename="atria-export.json"' },
          body: '{}',
        });
      }
      const report = path.match(/^\/reports\/([^/]+)$/);
      if (report) {
        const format = url.searchParams.get('format');
        if (format === 'pdf') {
          if (mode === 'pdf-slow') await gate;
          if (mode === 'pdf-error') return problem(route, 500, 'internal_error', 'Erro interno');
          return route.fulfill({
            status: 200,
            contentType: 'application/pdf',
            headers: { 'Content-Disposition': `attachment; filename="atria-${report[1]}.pdf"` },
            body: '%PDF-1.4',
          });
        }
        if (mode === 'filter-refused' && url.searchParams.has('category_id')) {
          return problem(route, 422, 'report_filter_invalid', 'Filtro inválido');
        }
        const model = MODELS[report[1]];
        if (model) return json(route, model);
      }
      unknown.push(`${method} ${path}`);
      return problem(route, 404, 'not_found', 'Não simulada');
    },
  );
  return { release };
}

// ---------- captura ----------

async function openPage(browser, { theme, size, mode }) {
  const context = await browser.newContext({
    viewport: SIZES[size],
    reducedMotion: 'reduce',
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    acceptDownloads: true,
  });
  await context.clock.setFixedTime(NOW);
  await context.addInitScript((t) => {
    try {
      localStorage.setItem('atria_theme', t);
    } catch {
      /* sem armazenamento */
    }
  }, theme);
  context.setDefaultTimeout(10000);
  const unknown = [];
  const api = await installApi(context, mode, unknown);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  return { page, context, errors, unknown, api };
}

const noOverflow = (page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const inWindow = (locator) =>
  locator.evaluate((el) => {
    const r = el.getBoundingClientRect();
    el.dataset.box = `l${Math.round(r.left)} t${Math.round(r.top)} r${Math.round(r.right)} b${Math.round(r.bottom)} / ${innerWidth}x${innerHeight}`;
    return r.left >= 0 && r.right <= innerWidth + 1;
  });
const routerHref = (page) => page.evaluate(() => window.__evidence.href());
const text = (page) => page.evaluate(() => document.body.innerText);
const plain = (s) => (s ?? '').replace(/[  ]/g, ' ').trim();

async function goto(page, base, path) {
  await page.goto(`${base}${PAGE_PATH}?path=${encodeURIComponent(path)}`);
  await page.locator('h1').first().waitFor();
  await page.evaluate(() => document.fonts.ready);
}

/** Verificações comuns a toda captura: tema, rolagem, erro de JS, `<select>` e axe (inclui color-contrast). */
async function baseChecks(page, errors, unknown, tag, theme) {
  const applied = await page.evaluate(() => document.documentElement.dataset.theme);
  check(`${tag}: tema ${THEME_LABEL[theme]} aplicado`, applied === theme);
  check(`${tag}: sem rolagem horizontal`, await noOverflow(page));
  check(`${tag}: sem erro de JS`, errors.length === 0, errors.join(' | '));
  check(`${tag}: só chamadas simuladas à API`, unknown.length === 0, unknown.join(' | '));
  const natives = await page.locator('select, input[type="date"], input[type="number"]').count();
  check(`${tag}: sem <select> nativo`, natives === 0, String(natives));
  const axe = await new AxeBuilder({ page }).analyze();
  // Dias de fora do mês fora do contraste (DEC-010): só os nós [data-outside], só na regra color-contrast.
  let skipped = 0;
  const violations = axe.violations
    .map((v) => {
      if (v.id !== 'color-contrast') return v;
      const kept = v.nodes.filter((n) => !/data-outside/.test(n.html));
      skipped += v.nodes.length - kept.length;
      return { ...v, nodes: kept };
    })
    .filter((v) => v.nodes.length > 0);
  if (skipped > 0)
    console.log(
      `nota   ${tag}: dias de fora do mês fora do contraste (DEC-010) · ${skipped} nó(s)`,
    );
  const bad = violations.map(
    (v) =>
      `${v.id}(${v.nodes.length}) ${v.nodes
        .slice(0, 2)
        .map((n) => n.target.join(' '))
        .join(' ; ')}`,
  );
  check(`${tag}: axe sem violações (inclui color-contrast)`, bad.length === 0, bad.join(', '));
}

async function runScenarios(browser, base, scenarios) {
  const shots = [];
  for (const theme of THEMES) {
    for (const size of ['desktop', 'mobile']) {
      for (const sc of scenarios) {
        if (sc.sizes && !sc.sizes.includes(size)) continue;
        const tag = `${sc.name} · ${SIZE_LABEL[size]} · ${THEME_LABEL[theme]}`;
        const { page, context, errors, unknown, api } = await openPage(browser, {
          theme,
          size,
          mode: sc.mode ?? 'normal',
        });
        try {
          await goto(page, base, sc.path);
          await sc.run(page, tag, { theme, size, api });
          await baseChecks(page, errors, unknown, tag, theme);
          if (process.env.EVIDENCE_DUMP) {
            mkdirSync(process.env.EVIDENCE_DUMP, { recursive: true });
            writeFileSync(
              join(
                process.env.EVIDENCE_DUMP,
                `${theme}-${size}-${sc.name.replace(/\W+/g, '_')}.png`,
              ),
              await page.screenshot(),
            );
          }
          shots.push({
            size,
            label: tag,
            png: await page.screenshot(),
          });
        } catch (e) {
          check(`${tag}: cenário executou`, false, String(e.message).split('\n')[0]);
        } finally {
          api.release();
          await context.close();
        }
      }
    }
  }
  return shots;
}

// ---------- prancha ----------

async function sheet(browser, { title, file, shots, scale }) {
  const figure = (s) => {
    const w = Math.round(SIZES[s.size].width * (scale[s.size] ?? 1));
    return `<figure style="width:${w}px"><img style="width:${w}px" src="data:image/png;base64,${s.png.toString('base64')}"><figcaption>${s.label}</figcaption></figure>`;
  };
  const figures = shots.map(figure).join('');
  const html = `<!doctype html><meta charset="utf-8"><style>
    body{margin:0;padding:24px;background:#1b1b20;color:#e8e8ee;font:13px/1.4 system-ui,sans-serif}
    h1{font-size:18px;margin:0 0 16px}
    main{display:flex;flex-wrap:wrap;gap:20px;align-items:flex-start}
    figure{margin:0}
    img{display:block;border:1px solid #444;border-radius:4px}
    figcaption{margin-top:6px;color:#b8b8c4}
  </style><h1>${title}</h1><main>${figures}</main>`;
  const context = await browser.newContext({ viewport: { width: 1480, height: 800 } });
  const page = await context.newPage();
  await page.setContent(html);
  await page.waitForFunction(() => [...document.images].every((i) => i.complete));
  mkdirSync(OUT, { recursive: true });
  const path = join(OUT, file);
  writeFileSync(path, await page.screenshot({ fullPage: true }));
  await context.close();
  console.log(`png: ${relative(ROOT, path)} (${shots.length} capturas)`);
}

// ---------- cenários ----------

const GENERATED = '/reports/fin-cat?period=custom&from=2026-11-01&to=2026-11-30&run=1';

const filtersCard = (page) =>
  page.locator('section').filter({ has: page.getByRole('heading', { level: 2, name: 'Filtros' }) });

const outlineOf = (page) =>
  page.evaluate(() => {
    const el = document.activeElement;
    const s = getComputedStyle(el);
    return {
      style: s.outlineStyle,
      width: parseFloat(s.outlineWidth),
      day: el.dataset?.day,
      name: el.getAttribute('aria-label') ?? el.textContent?.trim().slice(0, 30),
    };
  });

const temas = [
  {
    name: 'catálogo',
    path: '/reports',
    run: async (page, tag) => {
      await page.getByRole('heading', { level: 2, name: 'Financeiro' }).waitFor();
      const modules = (await page.locator('main h2').allTextContents()).map(plain);
      const links = await page
        .locator('main a[href^="/reports/"]')
        .evaluateAll((els) => els.map((e) => e.getAttribute('href')));
      const ids = links.filter((h) => h !== '/reports/exports');
      check(
        `${tag}: catálogo com um cartão por módulo e os nove relatórios`,
        ['Financeiro', 'Acervo', 'Diário', 'Metas', 'Tarefas', 'Projetos'].every(
          (m, i) => modules[i] === m,
        ) && ids.length === 9,
        `${modules.join(', ')} · ${ids.length} relatório(s)`,
      );
      check(
        `${tag}: link "Exportar meus dados"`,
        await page.getByRole('link', { name: 'Exportar meus dados' }).isVisible(),
      );
    },
  },
  {
    name: 'período aberto com intervalo',
    path: '/reports/fin-cat',
    run: async (page, tag) => {
      const card = filtersCard(page);
      await card.waitFor();
      const labels = (await card.locator('label, [id$="-label"]').allTextContents()).map(plain);
      check(
        `${tag}: cartão "Filtros" com o período, a conta e a categoria`,
        (await card.getByRole('button', { name: /Período/ }).isVisible()) &&
          (await card.getByRole('button', { name: /Conta/ }).isVisible()) &&
          (await card.getByRole('button', { name: /Categoria/ }).isVisible()),
        labels.join(', '),
      );
      check(
        `${tag}: "Escolha os filtros" antes de gerar, sem resultado`,
        (await page.getByText('Escolha os filtros').isVisible()) &&
          (await page.getByRole('link', { name: 'Abrir em nova aba' }).count()) === 0,
      );
      await card.getByRole('button', { name: /Período/ }).click();
      const dialog = page.getByRole('dialog', { name: 'Escolher período' });
      await dialog.waitFor();
      const presets = (await dialog.locator('[aria-pressed]').allTextContents()).map(plain);
      check(
        `${tag}: presets inclusive "Qualquer período"`,
        ['Este mês', 'Mês passado', 'Qualquer período'].every((w) => presets.includes(w)),
        presets.filter((p) => !/^\d+$/.test(p)).join(', '),
      );
      await dialog.locator('[data-day="2026-11-09"]').click();
      await dialog.locator('[data-day="2026-11-20"]').click();
      const info = await dialog.evaluate((root) => {
        const days = [...root.querySelectorAll('[data-day]')];
        const base = days.find((d) => d.dataset.day === '2026-11-25');
        const baseBg = base ? getComputedStyle(base).backgroundColor : '';
        const between = days.filter(
          (d) => d.dataset.day > '2026-11-09' && d.dataset.day < '2026-11-20',
        );
        const marked = between.filter(
          (d) => /inRange/.test(d.className) && getComputedStyle(d).backgroundColor !== baseBg,
        );
        const edges = days
          .filter((d) => d.getAttribute('aria-pressed') === 'true')
          .map((d) => d.dataset.day);
        return { between: between.length, marked: marked.length, edges };
      });
      check(
        `${tag}: seletor de período aberto e intervalo marcado no calendário`,
        info.between === 10 && info.marked === 10 && info.edges.join() === '2026-11-09,2026-11-20',
        `${info.marked}/${info.between} dias entre · pontas ${info.edges.join(' e ')}`,
      );
      check(
        `${tag}: popover dentro da janela`,
        await inWindow(dialog),
        await dialog.getAttribute('data-box'),
      );
    },
  },
  {
    name: 'relatório sem período',
    path: '/reports/tasks-done',
    run: async (page, tag) => {
      const card = filtersCard(page);
      await card.waitFor();
      check(
        `${tag}: "Este relatório não tem filtros." e sem período`,
        (await card.getByText('Este relatório não tem filtros.').isVisible()) &&
          (await card.getByRole('button', { name: /Período/ }).count()) === 0,
      );
      check(
        `${tag}: "Escolha os filtros" antes de gerar`,
        (await page.getByText('Escolha os filtros').isVisible()) &&
          (await page.getByRole('button', { name: 'Gerar relatório' }).isVisible()),
      );
    },
  },
  {
    name: 'resultado gerado',
    path: GENERATED,
    run: async (page, tag) => {
      await page.getByText('Moradia').first().waitFor();
      const open = page.getByRole('link', { name: 'Abrir em nova aba' });
      const href = (await open.getAttribute('href')) ?? '';
      check(
        `${tag}: resultado gerado com "Exportar PDF" e "Abrir em nova aba"`,
        (await page.getByRole('button', { name: /Exportar PDF/ }).isVisible()) &&
          (await open.isVisible()) &&
          (await open.getAttribute('target')) === '_blank' &&
          href.includes('format=html') &&
          href.includes('from=2026-11-01') &&
          href.includes('to=2026-11-30'),
        href,
      );
      check(
        `${tag}: resultado com as categorias e sem "Escolha os filtros"`,
        (await text(page)).includes('Mercado') &&
          (await page.getByText('Escolha os filtros').count()) === 0,
      );
    },
  },
];

const estados = [
  {
    name: 'exportação em PDF carregando',
    path: GENERATED,
    mode: 'pdf-slow',
    run: async (page, tag) => {
      await page.getByText('Moradia').first().waitFor();
      await page.getByRole('button', { name: /Exportar PDF/ }).click();
      const busy = page.getByRole('button', { name: /Exportando/ });
      await busy.waitFor();
      check(`${tag}: exportação em PDF: indicador de andamento visível`, await busy.isVisible());
    },
  },
  {
    name: 'exportação em PDF com erro',
    path: GENERATED,
    mode: 'pdf-error',
    run: async (page, tag) => {
      await page.getByText('Moradia').first().waitFor();
      await page.getByRole('button', { name: /Exportar PDF/ }).click();
      const alert = page.getByRole('alert').filter({ hasText: 'Não foi possível exportar' });
      await alert.waitFor();
      check(
        `${tag}: exportação em PDF: erro em role="alert" na página`,
        await alert.isVisible(),
        plain(await alert.textContent()),
      );
    },
  },
  {
    name: 'filtro recusado',
    path: `/reports/fin-cat?period=all&category_id=${CATEGORY_ID}&run=1`,
    mode: 'filter-refused',
    run: async (page, tag) => {
      const alert = filtersCard(page).getByRole('alert');
      await alert.waitFor();
      check(
        `${tag}: filtro recusado: erro em role="alert" dentro do cartão "Filtros"`,
        (await alert.isVisible()) && plain(await alert.textContent()).includes('filtro'),
        plain(await alert.textContent()),
      );
    },
  },
  {
    name: 'exportação de dados carregando',
    path: '/reports/exports',
    mode: 'exports-slow',
    run: async (page, tag) => {
      await page.getByRole('button', { name: 'Exportar JSON' }).click();
      const busy = page.getByRole('button', { name: /Preparando o arquivo/ });
      await busy.waitFor();
      check(`${tag}: exportação de dados: indicador de andamento visível`, await busy.isVisible());
    },
  },
  {
    name: 'foco pelo teclado',
    path: '/reports/fin-cat',
    run: async (page, tag) => {
      await filtersCard(page).waitFor();
      let reached = false;
      for (let i = 0; i < 40 && !reached; i += 1) {
        await page.keyboard.press('Tab');
        reached = await page.evaluate(
          () =>
            document.activeElement?.getAttribute('aria-haspopup') === 'dialog' &&
            /Período/.test(document.activeElement.textContent ?? '') ===
              /Período/.test(document.activeElement.textContent ?? ''),
        );
      }
      const control = await outlineOf(page);
      check(
        `${tag}: foco visível depois de Tab, no controle do período`,
        reached && control.style !== 'none' && control.width >= 2,
        `${control.name} · ${control.style} ${control.width}px`,
      );
      await page.keyboard.press('Enter');
      const dialog = page.getByRole('dialog', { name: 'Escolher período' });
      await dialog.waitFor();
      let onDay = false;
      for (let i = 0; i < 30 && !onDay; i += 1) {
        await page.keyboard.press('Tab');
        onDay = await page.evaluate(
          () => document.activeElement?.hasAttribute('data-day') ?? false,
        );
      }
      const day = await outlineOf(page);
      check(
        `${tag}: foco visível depois de Tab, inclusive num dia do calendário`,
        onDay,
        day.day ?? 'fora do calendário',
      );
      check(
        `${tag}: contorno de foco visível · ≥ 2px`,
        onDay && day.style !== 'none' && day.width >= 2,
        `${day.day ?? '-'} · ${day.style} ${day.width}px`,
      );
    },
  },
];

// ---------- principal ----------

const EVIDENCES = {
  temas: async (browser, base) => {
    const shots = await runScenarios(browser, base, temas);
    await sheet(browser, {
      title:
        'TASK-34 · Relatórios nos temas claro e escuro, 1440 px e 360 px (RF-61, RF-62, RNF-08, RNF-10, PD-55, PD-57, PD-61, DEC-004)',
      file: 'reports-themes-widths.png',
      shots,
      scale: { desktop: 0.45, mobile: 0.62 },
    });
  },
  estados: async (browser, base) => {
    const shots = await runScenarios(browser, base, estados);
    await sheet(browser, {
      title:
        'TASK-34 · estados de Relatórios: carregando, erro e foco por teclado (RF-62, RF-63, RNF-06, [project/frontend-10])',
      file: 'reports-states-focus.png',
      shots,
      scale: { desktop: 0.45, mobile: 0.62 },
    });
  },
};

const wanted = process.argv.slice(2);
const names = wanted.length > 0 ? wanted : Object.keys(EVIDENCES);
const unknownNames = names.filter((n) => !(n in EVIDENCES));
if (unknownNames.length > 0) {
  console.error(`Evidência desconhecida: ${unknownNames.join(', ')}. Use temas ou estados.`);
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
  if (vite) await vite.stop();
}
console.log(`\n${failures === 0 ? 'ok' : 'FALHA'}  ${failures} falha(s)`);
process.exit(failures === 0 ? 0 : 1);
