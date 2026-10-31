// Evidências visuais da TASK-32 (Paleta de comandos), sem passo manual: sobe o Vite numa porta livre
// com uma página virtual que carrega o harness da feature
// (src/features/command-palette/evidence/harness.tsx), simula a API no navegador (context.route),
// confere o estado no DOM antes de cada captura e monta as pranchas (PNG) em
// vostok/work/tasks/SPEC-001/evidence/TASK-32/.
// Uso: node apps/web/scripts/evidence-command-palette.mjs temas|estados
// Imprime "ok" ou "FALHA" por verificação, o caminho do PNG e a linha final "ok  N falha(s)";
// sai com código 1 se algo falhar.
import AxeBuilder from '@axe-core/playwright';
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = join(WEB, '..', '..');
const OUT = join(ROOT, 'vostok', 'work', 'tasks', 'SPEC-001', 'evidence', 'TASK-32');
const PAGE_PATH = '/__evidence/command-palette.html';
const HARNESS = '/src/features/command-palette/evidence/harness.tsx';

const THEMES = ['light', 'dark'];
const THEME_LABEL = { light: 'claro', dark: 'escuro' };
const SIZES = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 360, height: 760 },
};
const SIZE_LABEL = { desktop: 'desktop 1440', mobile: '360 px' };

let failures = 0;
function check(name, cond, extra) {
  if (!cond) failures += 1;
  console.log(`${cond ? 'ok    ' : 'FALHA '} ${name}${extra ? ` · ${extra}` : ''}`);
}

// ---------- servidor de desenvolvimento (API do Vite, sem processo filho) ----------

function evidencePage() {
  return {
    name: 'atria-evidence-page',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url?.split('?')[0] !== PAGE_PATH) return next();
        const html = `<!doctype html>
<html lang="pt-BR" data-theme="light">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light dark" />
    <title>Atria · evidência da paleta de comandos</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="${HARNESS}"></script>
  </body>
</html>`;
        res.setHeader('Content-Type', 'text/html');
        res.end(await server.transformIndexHtml(PAGE_PATH, html));
      });
    },
  };
}

async function startVite() {
  const server = await createServer({
    root: WEB,
    configFile: join(WEB, 'vite.config.ts'),
    logLevel: 'error',
    plugins: [evidencePage()],
    server: { host: '127.0.0.1', port: 0, strictPort: false, hmr: false },
  });
  await server.listen();
  const address = server.httpServer.address();
  return { url: `http://127.0.0.1:${address.port}`, stop: () => server.close() };
}

// ---------- API simulada ----------

const json = (body, status = 200) => ({
  status,
  contentType: status >= 400 ? 'application/problem+json' : 'application/json',
  body: JSON.stringify(body),
});

const hit = (n, entity_type, title, snippet) => ({
  entity_type,
  id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
  title,
  snippet,
});

const RESULT_GROUPS = [
  {
    context: 'tasks',
    items: [
      hit(1, 'task', 'Pagar o aluguel da casa', 'Vence dia 5'),
      hit(2, 'task', 'Comprar tinta para a casa', null),
    ],
  },
  { context: 'notes', items: [hit(3, 'note', 'Reforma da casa', 'Orçamento do pedreiro')] },
  { context: 'finance', items: [hit(4, 'transaction', 'Aluguel da casa', 'R$ 1.500,00')] },
];

/** Respostas por `MÉTODO /caminho`; `/search` muda conforme o texto buscado. */
function handlers(gate) {
  return {
    'GET /me': () => json({ id: 'u1', email: 'ana@exemplo.com', display_name: 'Ana Maria Souza' }),
    'GET /me/preferences': () =>
      json({
        currency: 'BRL',
        locale: 'pt-BR',
        time_zone: 'America/Sao_Paulo',
        palette_shortcut: 'mod+k',
        search_contexts: [],
      }),
    'GET /search': async (q) => {
      const text = q.get('q') ?? '';
      if (text === 'lento') {
        await gate;
        return json({ groups: [] });
      }
      if (text === 'nada') return json({ groups: [] });
      if (text === 'erro') return json({ code: 'internal_error', title: 'Erro interno' }, 500);
      return json({ groups: RESULT_GROUPS });
    },
  };
}

const RECENTS = [
  { id: '00000000-0000-4000-8000-000000000010', type: 'note', title: 'Ideias para a viagem' },
  { id: '00000000-0000-4000-8000-000000000011', type: 'task', title: 'Renovar o passaporte' },
  { id: '00000000-0000-4000-8000-000000000012', type: 'goal', title: 'Correr 5 km' },
];

// ---------- captura ----------

async function openPage(browser, { theme, size, recents, gate }) {
  const context = await browser.newContext({
    viewport: SIZES[size],
    reducedMotion: 'reduce',
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
  });
  await context.addInitScript(
    ([t, items]) => {
      try {
        localStorage.setItem('atria_theme', t);
        if (items) localStorage.setItem('atria.command_palette.recent', JSON.stringify(items));
      } catch {
        /* sem armazenamento */
      }
    },
    [theme, recents ?? null],
  );
  const table = handlers(gate);
  await context.route(
    (url) => url.pathname.startsWith('/api/'),
    async (route) => {
      const url = new URL(route.request().url());
      const key = `${route.request().method()} ${url.pathname.replace('/api/v1', '')}`;
      const handler = table[key];
      if (!handler) return route.fulfill(json({ code: 'not_found', title: 'não achado' }, 404));
      return route.fulfill(await handler(url.searchParams));
    },
  );
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  return { page, context, errors };
}

const noOverflow = (page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

/** DEC-010: dias de fora do mês do calendário ([data-outside]) ficam fora do color-contrast. */
function dropOutside(result) {
  for (const v of result.violations) {
    if (v.id === 'color-contrast')
      v.nodes = v.nodes.filter((n) => !n.html.includes('data-outside'));
  }
  result.violations = result.violations.filter((v) => v.nodes.length > 0);
}

async function baseChecks(page, errors, tag, theme) {
  const applied = await page.evaluate(() => document.documentElement.dataset.theme);
  check(`${tag}: tema ${THEME_LABEL[theme]} aplicado`, applied === theme);
  check(`${tag}: sem rolagem horizontal`, await noOverflow(page));
  check(`${tag}: sem erro de JavaScript`, errors.length === 0, errors.join(' | '));
  const axe = await new AxeBuilder({ page }).analyze();
  dropOutside(axe);
  check(
    `${tag}: axe sem violações (inclui color-contrast; dias de fora do mês fora do contraste, DEC-010)`,
    axe.violations.length === 0,
    axe.violations
      .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' ; ')}`)
      .join(', '),
  );
}

const dialogOf = (page) => page.getByRole('dialog', { name: 'Paleta de comandos' });
const inputOf = (page) => page.getByRole('combobox', { name: 'Buscar ou criar' });
const triggerOf = (page) => page.locator('.command-palette-trigger');

async function gotoHarness(page, base) {
  await page.goto(`${base}${PAGE_PATH}`);
  await page.getByRole('heading', { level: 1, name: 'Início' }).waitFor();
  await page.evaluate(() => document.fonts.ready);
}

/** Executa cenários em todas as combinações tema x tamanho e devolve as imagens rotuladas. */
async function run(browser, base, scenarios) {
  const shots = [];
  for (const theme of THEMES) {
    for (const sc of scenarios) {
      for (const size of sc.sizes) {
        const tag = `${sc.name} · ${SIZE_LABEL[size]} · ${THEME_LABEL[theme]}`;
        let release;
        const gate = new Promise((resolve) => (release = resolve));
        const { page, context, errors } = await openPage(browser, {
          theme,
          size,
          recents: sc.recents,
          gate,
        });
        try {
          await gotoHarness(page, base);
          await sc.run(page, tag, size, theme);
          await baseChecks(page, errors, tag, theme);
          shots.push({
            scenario: sc.name,
            theme,
            size,
            label: tag,
            png: await page.screenshot(),
            viewport: page.viewportSize(),
          });
        } catch (e) {
          check(`${tag}: cenário executou`, false, String(e.message).split('\n')[0]);
        } finally {
          release();
          await context.close();
        }
      }
    }
  }
  return shots;
}

// ---------- prancha ----------

async function sheet(browser, { title, file, shots }) {
  const scale = { desktop: 0.5, mobile: 0.6 };
  const figure = (s) => {
    const w = Math.round(s.viewport.width * scale[s.size]);
    return `<figure style="width:${w}px"><img style="width:${w}px" src="data:image/png;base64,${s.png.toString('base64')}"><figcaption>${s.label}</figcaption></figure>`;
  };
  // Uma linha por cenário; a coluna da esquerda é o tema claro e a da direita, o escuro.
  const cells = new Map();
  for (const s of shots) {
    const key = `${s.scenario}|${s.theme}`;
    cells.set(key, [...(cells.get(key) ?? []), s]);
  }
  const names = [...new Set(shots.map((s) => s.scenario))];
  const cell = (n, theme) =>
    `<div class="row">${(cells.get(`${n}|${theme}`) ?? []).map(figure).join('')}</div>`;
  const figures = names
    .map((n) => `<h2>${n}</h2><div class="pair">${cell(n, 'light')}${cell(n, 'dark')}</div>`)
    .join('');
  const html = `<!doctype html><meta charset="utf-8"><style>
    body{margin:0;padding:24px;background:#1b1b20;color:#e8e8ee;font:13px/1.4 system-ui,sans-serif}
    h1{font-size:18px;margin:0 0 16px}
    h2{font-size:15px;margin:28px 0 8px;color:#d0d0dc}
    .pair{display:flex;gap:48px;align-items:flex-start}
    figure{margin:0}
    .row{display:flex;gap:20px;align-items:flex-start}
    img{display:block;border:1px solid #444;border-radius:4px}
    figcaption{margin-top:6px;color:#b8b8c4}
  </style><h1>${title}</h1>${figures}`;
  const context = await browser.newContext({ viewport: { width: 2900, height: 800 } });
  const page = await context.newPage();
  await page.setContent(html);
  await page.waitForFunction(() => [...document.images].every((i) => i.complete));
  mkdirSync(OUT, { recursive: true });
  const path = join(OUT, file);
  writeFileSync(path, await page.screenshot({ fullPage: true }));
  await context.close();
  console.log(`png: ${relative(ROOT, path)} (${shots.length} capturas)`);
}

// ---------- verificações ----------

const inViewport = (locator) =>
  locator.evaluate((el) => {
    const r = el.getBoundingClientRect();
    window.__box = `l${Math.round(r.left)} t${Math.round(r.top)} r${Math.round(r.right)} b${Math.round(r.bottom)} / ${innerWidth}x${innerHeight}`;
    return r.left >= 0 && r.top >= 0 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 2;
  });

const visible = async (loc) => (await loc.count()) > 0 && (await loc.first().isVisible());

/** Fundo da paleta: desfoque quando o navegador suporta; senão, o fundo opaco do fallback. */
async function backdropOk(page) {
  return page.evaluate(() => {
    const o = document.querySelector('.command-palette-overlay');
    const s = getComputedStyle(o);
    const blur = /blur\(/.test(s.backdropFilter || s.webkitBackdropFilter || '');
    return { blur, filter: s.backdropFilter, bg: s.backgroundColor };
  });
}

async function openByTrigger(page) {
  await triggerOf(page).click();
  await dialogOf(page).waitFor();
  await inputOf(page).waitFor();
}

/** Digita e espera a lista de resultados ou o estado pedido. */
async function typeQuery(page, text) {
  await inputOf(page).fill(text);
}

const waitOptions = (page) => page.getByRole('option').first().waitFor();

const themesScenarios = [
  {
    name: 'paleta aberta com resultados',
    sizes: ['desktop', 'mobile'],
    run: async (page, tag, size) => {
      const trigger = triggerOf(page);
      const kbd = (await trigger.locator('kbd').textContent())?.trim() ?? '';
      check(`${tag}: dica do atalho no gatilho`, /^(Ctrl K|⌘ K)$/.test(kbd), kbd);

      // Ctrl + K com o foco num campo de texto abre a paleta (CB-13); Esc devolve o foco ao campo.
      const field = page.locator('.harness-input');
      await field.focus();
      await page.keyboard.press('Control+k');
      await dialogOf(page).waitFor();
      check(`${tag}: Ctrl + K abre com o foco num campo`, await dialogOf(page).isVisible());
      await page.keyboard.press('Escape');
      await dialogOf(page).waitFor({ state: 'detached' });
      check(
        `${tag}: Esc fecha e o foco volta ao campo`,
        await field.evaluate((el) => el === document.activeElement),
      );

      await openByTrigger(page);
      const dialog = dialogOf(page);
      check(
        `${tag}: diálogo aberto (role="dialog", aria-modal)`,
        (await dialog.getAttribute('aria-modal')) === 'true',
      );
      const bd = await backdropOk(page);
      check(
        `${tag}: fundo com backdrop-filter blur`,
        bd.blur,
        bd.blur ? bd.filter : `fallback opaco ${bd.bg}`,
      );
      await typeQuery(page, 'casa');
      await waitOptions(page);
      await page.waitForTimeout(200);
      const groups = await page.locator('.command-palette-group').allTextContents();
      check(
        `${tag}: resultados agrupados por contexto`,
        ['Tarefas', 'Notas', 'Finanças'].every((g) => groups.includes(g)),
        groups.join(' | '),
      );
      check(
        `${tag}: diálogo inteiro dentro da janela`,
        await inViewport(dialog),
        await page.evaluate(() => window.__box),
      );
      check(
        `${tag}: campo de busca com o foco`,
        await inputOf(page).evaluate((el) => el === document.activeElement),
      );
      if (size === 'mobile') {
        const box = await dialog.boundingBox();
        check(
          `${tag}: layout funcional em 360 px`,
          box.width >= 300,
          `${Math.round(box.width)} px`,
        );
      }
    },
  },
];

const full = ['desktop'];

/** Cor do fundo de uma opção, para provar o destaque do item ativo. */
const optionBg = (loc) => loc.evaluate((el) => getComputedStyle(el).backgroundColor);

const statesScenarios = [
  {
    name: 'paleta vazia (recentes e ações)',
    sizes: full,
    recents: RECENTS,
    run: async (page, tag) => {
      await openByTrigger(page);
      await page.getByRole('option').first().waitFor();
      const groups = await page.locator('.command-palette-group').allTextContents();
      check(
        `${tag}: paleta vazia com recentes e ações de criar`,
        groups.includes('Recentes') && groups.includes('Criar'),
        groups.join(' | '),
      );
      const opts = await page.getByRole('option').allTextContents();
      check(
        `${tag}: recentes e "Criar nota" listados`,
        opts.some((o) => o.includes('Renovar o passaporte')) &&
          opts.some((o) => o.includes('Criar nota')),
      );
    },
  },
  {
    name: 'carregando',
    sizes: full,
    run: async (page, tag) => {
      await openByTrigger(page);
      await typeQuery(page, 'lento');
      const loading = page.getByText('Buscando…');
      await loading.waitFor();
      check(`${tag}: indicador de carregamento visível`, await loading.isVisible());
    },
  },
  {
    name: 'sem resultados',
    sizes: full,
    run: async (page, tag) => {
      await openByTrigger(page);
      await typeQuery(page, 'nada');
      const empty = page.getByText('Nada encontrado');
      await empty.waitFor();
      check(`${tag}: texto de sem resultados visível`, await empty.isVisible());
    },
  },
  {
    name: 'erro na busca',
    sizes: full,
    run: async (page, tag) => {
      await openByTrigger(page);
      await typeQuery(page, 'erro');
      const alert = page.getByRole('alert').filter({ hasText: 'Não foi possível buscar agora' });
      await alert.waitFor();
      check(`${tag}: mensagem de erro visível`, await alert.isVisible());
    },
  },
  {
    name: 'item ativo pelas setas',
    sizes: full,
    run: async (page, tag) => {
      await openByTrigger(page);
      await typeQuery(page, 'casa');
      await waitOptions(page);
      await page.waitForTimeout(200);
      const input = inputOf(page);
      const first = (await input.getAttribute('aria-activedescendant')) ?? '';
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('ArrowDown');
      const activeId = (await input.getAttribute('aria-activedescendant')) ?? '';
      const options = page.getByRole('option');
      const selected = page.locator('[role="option"][aria-selected="true"]');
      const third = options.nth(2);
      check(
        `${tag}: item ativo depois das setas (aria-activedescendant)`,
        activeId !== '' && activeId !== first && (await third.getAttribute('id')) === activeId,
        `${first} -> ${activeId}`,
      );
      check(`${tag}: um único item marcado como selecionado`, (await selected.count()) === 1);
      const activeBg = await optionBg(third);
      const otherBg = await optionBg(options.nth(0));
      check(
        `${tag}: destaque visível no item ativo`,
        activeBg !== otherBg && activeBg !== 'rgba(0, 0, 0, 0)',
        `ativo ${activeBg} · demais ${otherBg}`,
      );
      check(
        `${tag}: foco continua no campo`,
        await input.evaluate((el) => el === document.activeElement),
      );
    },
  },
];

// ---------- principal ----------

const EVIDENCES = {
  temas: async (browser, base) => {
    const shots = await run(browser, base, themesScenarios);
    await sheet(browser, {
      title:
        'TASK-32 · paleta de comandos nos temas claro e escuro, 1440 e 360 px (RF-15, RNF-08, RNF-10)',
      file: 'command-palette-themes-widths.png',
      shots,
    });
  },
  estados: async (browser, base) => {
    const shots = await run(browser, base, statesScenarios);
    await sheet(browser, {
      title: 'TASK-32 · estados da paleta e item ativo pelas setas (decisões 36 e 37, RNF-06)',
      file: 'command-palette-states-focus.png',
      shots,
    });
  },
};

const wanted = process.argv.slice(2);
const names = wanted.length > 0 ? wanted : Object.keys(EVIDENCES);
const unknown = names.filter((n) => !(n in EVIDENCES));
if (unknown.length > 0) {
  console.error(`Evidência desconhecida: ${unknown.join(', ')}. Use temas ou estados.`);
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
