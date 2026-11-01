// Evidências visuais da TASK-20 (emoções com ícone e linha do tempo do Diário), sem passo manual:
// sobe o Vite numa porta livre, serve uma página virtual que carrega
// `src/features/journal/evidence/harness.tsx`, simula a API no navegador, confere o estado no DOM
// antes de cada captura. A linha do tempo (sem interação) vira prancha (PNG); o seletor e a tela de
// Emoções viram vídeo (.webm, desktop 1280x800, tema claro, com o cursor visível), gravado num
// contexto à parte: as checagens dos dois temas e das duas larguras não gravam vídeo.
// Uso: node apps/web/scripts/evidence-emotion-icons.mjs <seletor|emocoes> <caminho.webm>
//      node apps/web/scripts/evidence-emotion-icons.mjs linha-do-tempo <caminho.png>
// Imprime "ok" ou "FALHA" por verificação, `png: <caminho> (N capturas)` ou `video: <caminho>` e a
// última linha `ok  0 falha(s)`; sai com código 1 se algo falhar.
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createServer as createNetServer } from 'node:net';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as axePackage from '@axe-core/playwright';
import { chromium } from '@playwright/test';
import { createServer } from 'vite';

const AxeBuilder = axePackage.default ?? axePackage.AxeBuilder;
const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');

const THEMES = ['light', 'dark'];
const SIZES = {
  desktop: { width: 1280, height: 900 },
  mobile: { width: 360, height: 760 },
};
const SIZE_LABEL = { desktop: 'desktop 1280', mobile: '360 px' };
const THEME_LABEL = { light: 'claro', dark: 'escuro' };
const NOW = new Date('2026-11-05T12:00:00-03:00');
const ZONE = 'America/Sao_Paulo';

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

const PAGE_HTML = `<!doctype html>
<html lang="pt-BR" data-theme="light">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light dark" />
    <title>Atria · evidência dos ícones de emoção</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/features/journal/evidence/harness.tsx"></script>
  </body>
</html>`;

/** Serve a página virtual `/__evidence`; o app em si não muda. */
const evidencePage = {
  name: 'atria-evidence-page',
  configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      if (!req.url?.startsWith('/__evidence')) return next();
      const html = await server.transformIndexHtml('/__evidence', PAGE_HTML);
      res.setHeader('content-type', 'text/html; charset=utf-8');
      res.end(html);
    });
  },
};

async function startVite() {
  const port = await freePort();
  const server = await createServer({
    root: WEB,
    configFile: join(WEB, 'vite.config.ts'),
    plugins: [evidencePage],
    logLevel: 'warn',
    clearScreen: false,
    server: { port, strictPort: true, host: '127.0.0.1', hmr: false },
  });
  await server.listen();
  return { url: `http://127.0.0.1:${port}`, stop: () => server.close() };
}

// ---------- API simulada ----------

const EMOTION_NAMES = [
  ['e0000001-0000-4000-8000-000000000001', 'joy'],
  ['e0000001-0000-4000-8000-000000000002', 'sadness'],
  ['e0000001-0000-4000-8000-000000000003', 'anger'],
  ['e0000001-0000-4000-8000-000000000004', 'fear'],
  ['e0000001-0000-4000-8000-000000000005', 'anxiety'],
  ['e0000001-0000-4000-8000-000000000006', 'calm'],
  ['e0000001-0000-4000-8000-000000000007', 'gratitude'],
];
const EMO = Object.fromEntries(EMOTION_NAMES.map(([id, key]) => [key, id]));
const SAUDADE = 'e0000001-0000-4000-8000-000000000008';
const LONG_NAME = 'Gratidão pelas pequenas coisas que aconteceram durante o dia inteiro';

function emotionFixtures(with_long) {
  const base = {
    owner_id: 'u1',
    visibility: 'personal',
    created_at: '2026-10-01T10:00:00Z',
    updated_at: '2026-10-01T10:00:00Z',
    icon: null,
  };
  return [
    ...EMOTION_NAMES.map(([id, key]) => ({ ...base, id, name: null, system_key: key })),
    { ...base, id: SAUDADE, name: 'Saudade', system_key: null },
    ...(with_long
      ? [
          {
            ...base,
            id: 'e0000001-0000-4000-8000-000000000009',
            name: LONG_NAME,
            system_key: null,
            icon: 'smile',
          },
        ]
      : []),
  ];
}

const link = (key, intensity) => ({
  emotion_id: EMO[key],
  deleted: false,
  name: null,
  system_key: key,
  ...(intensity ? { intensity } : {}),
});

function makeEntry(id, occurred_at, text, emotions) {
  return {
    id,
    owner_id: 'u1',
    occurred_at,
    text,
    emotions,
    visibility: 'personal',
    created_at: occurred_at,
    updated_at: occurred_at,
  };
}

function fixtures() {
  return [
    makeEntry(
      'a1000000-0000-4000-8000-000000000001',
      '2026-11-04T21:30:00-03:00',
      'Dia longo, mas terminei o relatório e jantei com calma.',
      [link('calm', 4), link('gratitude', 5)],
    ),
    makeEntry(
      'a1000000-0000-4000-8000-000000000002',
      '2026-11-04T08:10:00-03:00',
      'Acordei com a cabeça cheia, mas a caminhada ajudou.',
      [link('anxiety', 3)],
    ),
    makeEntry(
      'a1000000-0000-4000-8000-000000000003',
      '2026-11-02T19:00:00-03:00',
      'Almoço em família no domingo. Rimos muito.',
      [link('joy', 5)],
    ),
    makeEntry(
      'a1000000-0000-4000-8000-000000000004',
      '2026-10-28T22:15:00-03:00',
      'Saudade de casa hoje.',
      [{ emotion_id: SAUDADE, deleted: false, name: 'Saudade', system_key: null }],
    ),
  ];
}

/** Corpos de POST e PATCH de `/emotions` gravados em `writes`. */
async function installApi(context, writes, with_long) {
  const entries = fixtures();
  const emotions = emotionFixtures(with_long);
  await context.route(
    (url) => url.pathname.startsWith('/api/'),
    async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const path = url.pathname.replace('/api/v1', '');
      const method = request.method();
      const reply = (body, status = 200) =>
        route.fulfill({
          status,
          contentType: status >= 400 ? 'application/problem+json' : 'application/json',
          body: JSON.stringify(body),
        });
      if (path === '/me') {
        return reply({ id: 'u1', email: 'ana@exemplo.com', display_name: 'Ana Maria Souza' });
      }
      if (path === '/me/preferences') return reply({});
      if (path === '/search' && method === 'GET') {
        return reply({ groups: [{ context: 'journal', items: [] }] });
      }
      if (path === '/emotions' && method === 'GET') {
        return reply({ items: emotions, next_cursor: null });
      }
      if (path === '/emotions' && method === 'POST') {
        const body = JSON.parse(request.postData() ?? '{}');
        writes.push({ method, path, body });
        const created = { ...emotions[0], id: `em-${emotions.length}`, system_key: null, ...body };
        emotions.push(created);
        return reply(created, 201);
      }
      const one = path.match(/^\/emotions\/([^/]+)$/);
      if (one && method === 'PATCH') {
        const body = JSON.parse(request.postData() ?? '{}');
        writes.push({ method, path, body });
        const found = emotions.find((e) => e.id === one[1]);
        if (!found) return reply({ title: 'Não encontrada', code: 'not_found' }, 404);
        Object.assign(found, body);
        return reply(found);
      }
      if (path === '/journal-entries' && method === 'GET') {
        return reply({ items: entries, next_cursor: null });
      }
      return reply({ title: 'Não encontrada', code: 'not_found' }, 404);
    },
  );
}

// ---------- captura ----------

async function openPage(browser, { theme, size, with_long }) {
  const context = await browser.newContext({
    viewport: SIZES[size],
    reducedMotion: 'reduce',
    locale: 'pt-BR',
    timezoneId: ZONE,
  });
  await context.addInitScript(
    ([k, t]) => {
      try {
        localStorage.setItem(k, t);
      } catch {
        /* sem armazenamento */
      }
    },
    ['atria_theme', theme],
  );
  const writes = [];
  await installApi(context, writes, with_long);
  const page = await context.newPage();
  await page.clock.setFixedTime(NOW);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  return { page, context, errors, writes };
}

const noOverflow = (page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

async function baseChecks(page, errors, tag, theme) {
  const current = await page.evaluate(() => document.documentElement.dataset.theme);
  check(`${tag}: tema ${THEME_LABEL[theme]} aplicado`, current === theme);
  check(`${tag}: sem rolagem horizontal`, await noOverflow(page));
  check(`${tag}: sem erro de JS`, errors.length === 0, errors.join(' | '));
  const result = await new AxeBuilder({ page }).analyze();
  const summary = result.violations
    .map(
      (v) =>
        `${v.id} (${v.nodes
          .slice(0, 2)
          .map((n) => `${n.target.join(' ')} ${(n.any[0]?.message ?? '').slice(0, 160)}`)
          .join('; ')})`,
    )
    .join(' | ');
  check(
    `${tag}: axe sem violações (inclui color-contrast)`,
    result.violations.length === 0,
    summary,
  );
}

async function gotoApp(page, base, path) {
  await page.goto(`${base}/__evidence?path=${encodeURIComponent(path)}`);
  await page.locator('main#conteudo').waitFor();
  await page.evaluate(() => document.fonts.ready);
}

async function runScenario(browser, base, sc) {
  const shots = [];
  for (const size of ['desktop', 'mobile']) {
    for (const theme of THEMES) {
      const tag = `${sc.name} · ${SIZE_LABEL[size]} · ${THEME_LABEL[theme]}`;
      const { page, context, errors, writes } = await openPage(browser, {
        theme,
        size,
        with_long: sc.with_long ?? false,
      });
      try {
        await gotoApp(page, base, sc.path);
        await sc.run(page, tag, writes);
        await baseChecks(page, errors, tag, theme);
        shots.push({ size, row: `${sc.name}-${size}`, label: tag, png: await page.screenshot() });
      } catch (e) {
        check(`${tag}: cenário executou`, false, String(e.message).split('\n')[0]);
      } finally {
        await context.close();
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
  const rows = [];
  for (const s of shots) {
    const last = rows[rows.length - 1];
    if (last?.row === s.row) last.items.push(s);
    else rows.push({ row: s.row, items: [s] });
  }
  const figures = rows
    .map((r) => `<div class="row">${r.items.map(figure).join('')}</div>`)
    .join('');
  const html = `<!doctype html><meta charset="utf-8"><style>
    body{margin:0;padding:24px;background:#1b1b20;color:#e8e8ee;font:13px/1.4 system-ui,sans-serif}
    h1{font-size:18px;margin:0 0 16px}
    main{display:flex;flex-direction:column;gap:24px}
    figure{margin:0}
    .row{display:flex;gap:20px;align-items:flex-start}
    img{display:block;border:1px solid #444;border-radius:4px}
    figcaption{margin-top:6px;color:#b8b8c4}
  </style><h1>${title}</h1><main>${figures}</main>`;
  const context = await browser.newContext({ viewport: { width: 1520, height: 800 } });
  const page = await context.newPage();
  await page.setContent(html);
  await page.waitForFunction(() => [...document.images].every((i) => i.complete));
  mkdirSync(dirname(file), { recursive: true });
  const path = file;
  writeFileSync(path, await page.screenshot({ fullPage: true }));
  await context.close();
  console.log(`png: ${path} (${shots.length} capturas)`);
}

// ---------- vídeo ----------

/** Marcador do cursor no vídeo: o Playwright não desenha o ponteiro, então mostramos o `cursor` computado. */
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

/** Grava `sc.video` num contexto à parte (desktop 1280x800, tema claro, movimento normal). */
async function recordVideo(browser, base, sc, target) {
  const file = resolve(target);
  const tmp = join(dirname(file), 'video-tmp');
  mkdirSync(tmp, { recursive: true });
  const size = { width: 1280, height: 800 };
  const context = await browser.newContext({
    viewport: size,
    locale: 'pt-BR',
    timezoneId: ZONE,
    recordVideo: { dir: tmp, size },
  });
  await context.addInitScript(
    ([k, t]) => {
      try {
        localStorage.setItem(k, t);
      } catch {
        /* sem armazenamento */
      }
    },
    ['atria_theme', 'light'],
  );
  await context.addInitScript(CURSOR_MARKER);
  const writes = [];
  await installApi(context, writes, sc.with_long ?? false);
  const page = await context.newPage();
  await page.clock.setFixedTime(NOW);
  const video = page.video();
  const pause = (ms) => page.waitForTimeout(ms);
  try {
    await gotoApp(page, base, sc.path);
    await pause(1000);
    await sc.video(page, pause, writes);
    await pause(1200);
  } catch (e) {
    check(`vídeo ${sc.name}: cenário executou`, false, String(e.message).split('\n')[0]);
  } finally {
    await context.close();
  }
  await video.saveAs(file);
  rmSync(tmp, { recursive: true, force: true });
  console.log(`video: ${relative(process.cwd(), file)}`);
}

/** Move o mouse até o centro do elemento, em passos, para o cursor aparecer no vídeo. */
async function moveTo(page, locator, pause) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 25 });
  await pause(500);
}

// ---------- cenários ----------

const main = (page) => page.locator('main#conteudo');

const SELETOR = {
  name: 'seletor do formulário',
  path: '/journal/new',
  with_long: true,
  run: async (page, tag) => {
    const group = page.getByRole('group', { name: 'Emoções' });
    await group.waitFor();
    const ansiedade = group.getByRole('button', { name: 'Ansiedade' });
    await ansiedade.click();
    await page.getByRole('radio', { name: '3 de 5' }).check({ force: true });
    check(`${tag}: botão marcado`, (await ansiedade.getAttribute('aria-pressed')) === 'true');
    const groups = await group.getByRole('radiogroup').count();
    const inside = await group
      .locator('li[data-on="true"]')
      .evaluateAll((items) => items.map((li) => li.querySelectorAll('[role="radiogroup"]').length));
    check(
      `${tag}: intensidade só na emoção marcada`,
      groups === 1 && inside.length === 1 && inside[0] === 1,
      `${groups} grupos`,
    );
    const filled = await group.locator('[data-filled="true"]').count();
    check(`${tag}: 3 pontos cheios`, filled === 3, String(filled));
    const icons = await group
      .locator('button[aria-pressed]')
      .evaluateAll((buttons) => buttons.map((b) => b.querySelectorAll('svg[data-icon]').length));
    check(`${tag}: um ícone em cada botão`, icons.length >= 9 && icons.every((n) => n === 1));
    const overlap = await group.locator('li').evaluateAll((items) => {
      const bad = [];
      const rect = (el) => el.getBoundingClientRect();
      const hit = (a, b) =>
        a.left < b.right - 0.5 &&
        b.left < a.right - 0.5 &&
        a.top < b.bottom - 0.5 &&
        b.top < a.bottom - 0.5;
      items.forEach((li, i) => {
        const button = li.querySelector('button');
        const name = li.querySelector('button span');
        const dots = li.querySelector('[role="radiogroup"]');
        const b = rect(button);
        const n = rect(name);
        if (n.left < b.left - 0.5 || n.right > b.right + 0.5 || n.bottom > b.bottom + 0.5) {
          bad.push(`nome fora do botão: ${name.textContent}`);
        }
        if (name.scrollWidth > name.clientWidth + 1) bad.push(`nome cortado: ${name.textContent}`);
        if (dots && hit(n, rect(dots))) bad.push(`nome sobre os pontos: ${name.textContent}`);
        items.forEach((other, j) => {
          if (j > i && hit(rect(li), rect(other))) bad.push(`itens sobrepostos: ${i}/${j}`);
        });
      });
      return bad;
    });
    check(`${tag}: nomes sem sobreposição`, overlap.length === 0, overlap.join(' | '));
  },
  video: async (page, pause) => {
    const group = page.getByRole('group', { name: 'Emoções' });
    await group.waitFor();
    await page.mouse.move(640, 700);
    await pause(800);
    // 1. Marca a emoção: a intensidade ainda não existe.
    const ansiedade = group.getByRole('button', { name: 'Ansiedade' });
    check(
      'vídeo: sem intensidade antes de marcar',
      (await group.getByRole('radiogroup').count()) === 0,
    );
    await moveTo(page, ansiedade, pause);
    await page.mouse.down();
    await pause(150);
    await page.mouse.up();
    await pause(1500);
    check(
      'vídeo: Ansiedade marcada',
      (await ansiedade.getAttribute('aria-pressed')) === 'true' &&
        (await group.getByRole('radiogroup').count()) === 1,
    );
    // 2. A intensidade aparece e o mouse escolhe "3 de 5".
    const dot = group.getByRole('radio', { name: '3 de 5' });
    await moveTo(page, dot.locator('xpath=..'), pause);
    await page.mouse.down();
    await pause(150);
    await page.mouse.up();
    await pause(1800);
    check('vídeo: 3 pontos cheios', (await group.locator('[data-filled="true"]').count()) === 3);
  },
};

const TIMELINE = {
  name: 'linha do tempo',
  path: '/journal?view=timeline',
  run: async (page, tag) => {
    await page.getByRole('link', { name: /Dia longo/ }).waitFor();
    const cards = await main(page)
      .locator('li[data-card="true"]')
      .evaluateAll((items) =>
        items.map((li) => {
          const s = getComputedStyle(li);
          return {
            border: parseFloat(s.borderTopWidth),
            bg: s.backgroundColor,
            view: li.closest('[data-view]')?.getAttribute('data-view'),
          };
        }),
      );
    check(
      `${tag}: entrada em cartão`,
      cards.length === 4 &&
        cards.every((c) => c.view === 'timeline' && c.border >= 1 && c.bg !== 'rgba(0, 0, 0, 0)'),
      JSON.stringify(cards[0]),
    );
    const emotions = await main(page)
      .locator('li[data-card="true"] ul[aria-label] > li')
      .evaluateAll((items) => items.map((li) => li.querySelectorAll('svg[data-icon]').length));
    check(`${tag}: ícone por emoção`, emotions.length === 5 && emotions.every((n) => n === 1));
    const text = await main(page).innerText();
    const hidden = await main(page).getByText('Ansiedade, intensidade 3 de 5').count();
    check(`${tag}: intensidade 3 de 5`, hidden === 1 && !text.includes('undefined'));
    await main(page).locator('li[data-card="true"]').first().scrollIntoViewIfNeeded();
    await page.getByRole('region', { name: '4 de nov. de 2026' }).scrollIntoViewIfNeeded();
    await page
      .getByRole('link', { name: /Dia longo/ })
      .evaluate((el) => el.scrollIntoView({ block: 'center' }));
  },
};

const EMOCOES = {
  name: 'tela de Emoções',
  path: '/journal/emotions',
  run: async (page, tag, writes) => {
    const list = page.getByRole('list', { name: 'Lista de emoções' });
    await list.waitFor();
    const row = list.locator('li', { hasText: 'Saudade' });
    check(
      `${tag}: ícone neutro em Saudade`,
      (await row.locator('svg[data-icon="neutral"]').count()) === 1,
    );
    check(
      `${tag}: padrão sem Trocar ícone`,
      (await page.getByRole('button', { name: /^Trocar ícone de/ }).count()) === 1 &&
        (await page.getByRole('button', { name: 'Trocar ícone de Alegria' }).count()) === 0,
    );
    await row.getByRole('button', { name: 'Trocar ícone de Saudade' }).click();
    await row.getByRole('radio', { name: 'Estrela' }).check({ force: true });
    await row.getByRole('button', { name: 'Usar este ícone' }).click();
    await row.locator('svg[data-icon="star"]').waitFor();
    const patch = writes.find((w) => w.method === 'PATCH');
    check(`${tag}: PATCH com icon star`, JSON.stringify(patch?.body) === '{"icon":"star"}');
    check(
      `${tag}: ícone estrela na linha`,
      (await row.locator('svg[data-icon="star"]').count()) === 1,
    );
  },
  video: async (page, pause, writes) => {
    const list = page.getByRole('list', { name: 'Lista de emoções' });
    await list.waitFor();
    const row = list.locator('li', { hasText: 'Saudade' });
    await page.mouse.move(640, 700);
    await pause(800);
    const click = async () => {
      await page.mouse.down();
      await pause(150);
      await page.mouse.up();
      await pause(1200);
    };
    // 1. Troca o ícone da emoção personalizada: do neutro para a estrela.
    await moveTo(page, row.getByRole('button', { name: 'Trocar ícone de Saudade' }), pause);
    await click();
    await moveTo(page, row.getByRole('radio', { name: 'Estrela' }).locator('xpath=..'), pause);
    await click();
    await moveTo(page, row.getByRole('button', { name: 'Usar este ícone' }), pause);
    await click();
    await row.locator('svg[data-icon="star"]').waitFor();
    await pause(1500);
    const patch = writes.find((w) => w.method === 'PATCH');
    check('vídeo: PATCH com icon star', JSON.stringify(patch?.body) === '{"icon":"star"}');
    check(
      'vídeo: ícone estrela na linha',
      (await row.locator('svg[data-icon="star"]').count()) === 1,
    );
  },
};

const EVIDENCES = { seletor: SELETOR, 'linha-do-tempo': TIMELINE, emocoes: EMOCOES };

const [name, target] = process.argv.slice(2);
const scenario = EVIDENCES[name];
if (!scenario || !target) {
  console.error(
    'Uso: node evidence-emotion-icons.mjs <seletor|emocoes> <caminho.webm> | linha-do-tempo <caminho.png>',
  );
  process.exit(2);
}

let vite;
let browser;
try {
  vite = await startVite();
  console.log(`vite: ${vite.url} (porta livre, encerrado ao final)`);
  browser = await chromium.launch();
  const shots = await runScenario(browser, vite.url, scenario);
  if (scenario.video) {
    await recordVideo(browser, vite.url, scenario, target);
  } else {
    await sheet(browser, {
      title: `Atria · ${scenario.name}`,
      file: resolve(target),
      shots,
      scale: { desktop: 0.5, mobile: 1 },
    });
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
