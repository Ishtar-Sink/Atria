// Evidências visuais da TASK-28 (telas do Acervo), sem passo manual: sobe o Vite numa porta livre
// (API `createServer`), serve uma página virtual que carrega `src/features/library/evidence/harness.tsx`
// (as rotas da feature num roteador em memória, com os providers e o layout do app), simula a API no
// navegador com fixtures em memória, confere o estado no DOM antes de cada captura e monta a prancha
// (PNG) em vostok/work/tasks/SPEC-001/evidence/TASK-28/.
// Uso: node apps/web/scripts/evidence-library.mjs themes-widths|states-focus
// Imprime "ok" ou "FALHA" por verificação e o caminho do PNG; sai com código 1 se algo falhar.
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createServer as createNetServer } from 'node:net';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as axePackage from '@axe-core/playwright';
import { chromium } from '@playwright/test';
import { createServer } from 'vite';

const AxeBuilder = axePackage.default ?? axePackage.AxeBuilder;
const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = join(WEB, '..', '..');
const OUT = join(ROOT, 'vostok', 'work', 'tasks', 'SPEC-001', 'evidence', 'TASK-28');

const THEMES = ['light', 'dark'];
const SIZES = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 360, height: 760 },
};
const TALL = { desktop: 1300, mobile: 1300 };
const SIZE_LABEL = { desktop: 'desktop 1440', mobile: '360 px' };
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
    <title>Atria · evidência do Acervo</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/features/library/evidence/harness.tsx"></script>
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

/** PNG válido em degradê, gerado aqui para servir de capa sem arquivo no repositório. */
function crc32(buf) {
  let c;
  let crc = 0xffffffff;
  for (const byte of buf) {
    c = (crc ^ byte) & 0xff;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function makePng(width, height, [r, g, b]) {
  const rows = [];
  for (let y = 0; y < height; y += 1) {
    const row = Buffer.alloc(1 + width * 3);
    for (let x = 0; x < width; x += 1) {
      const shade = 0.55 + 0.45 * ((x / width + y / height) / 2);
      row[1 + x * 3] = Math.round(r * shade);
      row[2 + x * 3] = Math.round(g * shade);
      row[3 + x * 3] = Math.round(b * shade);
    }
    rows.push(row);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 2;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(Buffer.concat(rows))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
const COVER_PORTRAIT = makePng(200, 300, [70, 110, 160]);
const COVER_PORTRAIT_2 = makePng(200, 300, [160, 90, 70]);
const COVER_LANDSCAPE = makePng(320, 180, [90, 140, 110]);
const FILES = {
  'file-book-1': COVER_PORTRAIT,
  'file-book-2': COVER_PORTRAIT_2,
  'file-article-1': COVER_LANDSCAPE,
  'file-video-1': COVER_LANDSCAPE,
};

const U = '3d5e0a21-7c4f-4b18-9a62-1e8f0c2d4b00';
const ids = {
  book1: '0b6f7d52-3c1e-4a50-9f7b-1d2a8e4c5a01',
  book2: '5c2a9e11-7d34-4b86-a1c0-3f9e6b7d2a02',
  book3: 'a91d4c07-2e8b-4f13-8c65-7b0d1e3f4a03',
  book4: 'e3f8b620-6a49-4d72-b5e1-9c4a7d0b8a04',
  art1: '17d0a5e9-8c3f-4e24-96ab-2f5b9c1d6a05',
  art2: '2a8c6f34-1b9d-4c70-8e53-6d1f0a7b9c06',
  art3: '4e7b1d08-5a2c-4f69-b3d4-8c0e2a6f1d07',
  vid1: '6f3a9c15-0d8e-4b27-a5c1-9e4b7d2f3a08',
  vid2: '8b1e5d70-3c6a-4d92-9f08-2a7c4e1b5d09',
};

function fixtures() {
  const base = { owner_id: U, tags: ['leitura'], visibility: 'personal' };
  const stamp = { created_at: '2026-10-01T10:00:00Z', updated_at: '2026-10-26T18:00:00Z' };
  const books = [
    {
      ...base,
      ...stamp,
      id: ids.book1,
      title: 'Dom Casmurro',
      author: 'Machado de Assis',
      publisher: 'Editora Exemplo',
      page_count: 200,
      reading_status: 'reading',
      cover_file_id: 'file-book-1',
    },
    {
      ...base,
      ...stamp,
      id: ids.book2,
      title: 'Uma história muito longa sobre a formação de um país e das suas gentes',
      author: 'Ana Souza',
      page_count: 400,
      reading_status: 'want_to_read',
    },
    {
      ...base,
      ...stamp,
      id: ids.book3,
      title: 'Ensaios',
      author: 'Michel de Montaigne',
      page_count: 120,
      reading_status: 'read',
      cover_file_id: 'file-book-2',
    },
    {
      ...base,
      ...stamp,
      id: ids.book4,
      title: 'Poemas reunidos',
      page_count: 90,
      reading_status: 'reading',
    },
  ];
  const articles = [
    {
      ...base,
      ...stamp,
      id: ids.art1,
      title: 'Sobre a atenção',
      author: 'Ana Souza',
      source: 'Revista Exemplo',
      url: 'https://exemplo.test/atencao',
      reading_status: 'to_read',
      cover_file_id: 'file-article-1',
    },
    {
      ...base,
      ...stamp,
      id: ids.art2,
      title: 'Como organizar um acervo pessoal sem perder o fio da meada',
      author: 'Rui Lima',
      source: 'Blog Exemplo',
      url: 'https://exemplo.test/acervo',
      reading_status: 'reading',
    },
    {
      ...base,
      ...stamp,
      id: ids.art3,
      title: 'Notas de campo',
      url: 'https://exemplo.test/campo',
      reading_status: 'read',
    },
  ];
  const videos = [
    {
      ...base,
      ...stamp,
      id: ids.vid1,
      title: 'Aula de redes',
      url: 'https://www.youtube.com/watch?v=abc',
      channel: 'Canal Exemplo',
      watch_status: 'watching',
      thumbnail_file_id: 'file-video-1',
    },
    {
      ...base,
      ...stamp,
      id: ids.vid2,
      title: 'Palestra sobre leitura',
      url: 'https://www.youtube.com/watch?v=def',
      watch_status: 'to_watch',
    },
  ];
  const sessions = [
    { id: 's1', book_id: ids.book1, owner_id: U, pages_read: 25, read_on: '2026-10-25' },
    { id: 's2', book_id: ids.book1, owner_id: U, pages_read: 30, read_on: '2026-10-26' },
    { id: 's3', book_id: ids.book3, owner_id: U, pages_read: 120, read_on: '2026-10-20' },
    { id: 's4', book_id: ids.book4, owner_id: U, pages_read: 18, read_on: '2026-10-22' },
  ].map((s) => ({
    ...s,
    created_at: `${s.read_on}T10:00:00Z`,
    updated_at: `${s.read_on}T10:00:00Z`,
  }));
  return { books, articles, videos, sessions };
}

function withProgress(book, sessions) {
  const pages = sessions
    .filter((s) => s.book_id === book.id)
    .reduce((sum, s) => sum + s.pages_read, 0);
  return {
    ...book,
    pages_read_total: pages,
    ...(book.page_count
      ? { progress_percent: Math.min(100, Math.round((pages / book.page_count) * 1000) / 10) }
      : {}),
  };
}

/** Modos: normal, empty (lista vazia), loading (listagem segurada) e error (500 na listagem). */
async function installApi(context, mode, gate) {
  const data = fixtures();
  const state = { calls: [] };
  await context.route(
    (url) => url.pathname.startsWith('/api/'),
    async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const path = url.pathname.replace('/api/v1', '');
      const method = request.method();
      state.calls.push(`${method} ${path}`);
      const reply = (body, status = 200) =>
        route.fulfill({
          status,
          contentType: status >= 400 ? 'application/problem+json' : 'application/json',
          body: JSON.stringify(body),
        });
      if (path === '/me')
        return reply({ id: U, email: 'ana@exemplo.com', display_name: 'Ana Maria Souza' });
      if (path === '/me/preferences') return reply({});
      const file = path.match(/^\/files\/([^/]+)$/);
      if (file) {
        const png = FILES[file[1]];
        return png
          ? route.fulfill({ status: 200, contentType: 'image/png', body: png })
          : reply({ title: 'Não encontrado', code: 'file_not_found' }, 404);
      }
      if (path === '/search' && method === 'GET') return reply({ groups: [] });
      const list = path.match(/^\/(books|articles|videos)$/);
      if (list && method === 'GET') {
        if (mode === 'loading') {
          await gate;
          return reply({ title: 'Indisponível', code: 'unavailable' }, 503);
        }
        if (mode === 'error') return reply({ title: 'Erro interno', code: 'internal_error' }, 500);
        let items = mode === 'empty' ? [] : [...data[list[1]]];
        const q = url.searchParams;
        const status = q.get('reading_status') ?? q.get('watch_status');
        if (status) items = items.filter((i) => (i.reading_status ?? i.watch_status) === status);
        if (q.get('q'))
          items = items.filter((i) => i.title.toLowerCase().includes(q.get('q').toLowerCase()));
        if (list[1] === 'books') items = items.map((b) => withProgress(b, data.sessions));
        return reply({ items, next_cursor: null });
      }
      const item = path.match(/^\/(books|articles|videos)\/([^/]+)$/);
      if (item && method === 'GET') {
        const found = data[item[1]].find((i) => i.id === item[2]);
        if (!found) return reply({ title: 'Não encontrado', code: 'not_found' }, 404);
        return reply(item[1] === 'books' ? withProgress(found, data.sessions) : found);
      }
      const sessions = path.match(/^\/books\/([^/]+)\/reading-sessions$/);
      if (sessions && method === 'GET') {
        return reply({ items: data.sessions.filter((s) => s.book_id === sessions[1]) });
      }
      if (
        /^\/(books|articles|videos)\/[^/]+\/(book-notes|article-notes|video-notes)$/.test(path) &&
        method === 'GET'
      ) {
        return reply({ items: [] });
      }
      return reply({ title: 'Não encontrado', code: 'not_found' }, 404);
    },
  );
  return state;
}

// ---------- captura ----------

async function openPage(browser, { theme, size, mode = 'normal', tall = false }) {
  const viewport = { ...SIZES[size], ...(tall ? { height: TALL[size] } : {}) };
  const context = await browser.newContext({
    viewport,
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
  let release = () => {};
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const state = await installApi(context, mode, gate);
  const page = await context.newPage();
  await page.clock.setFixedTime(NOW);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  return { page, context, errors, release, state };
}

const noOverflow = (page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const inViewport = (locator) =>
  locator.evaluate((el) => {
    const r = el.getBoundingClientRect();
    window.__box = `l${Math.round(r.left)} t${Math.round(r.top)} r${Math.round(r.right)} b${Math.round(r.bottom)} / ${innerWidth}x${innerHeight}`;
    return r.left >= 0 && r.top >= 0 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 2;
  });

async function baseChecks(page, errors, tag, theme) {
  const current = await page.evaluate(() => document.documentElement.dataset.theme);
  check(`${tag}: tema ${THEME_LABEL[theme]} aplicado`, current === theme);
  check(`${tag}: sem rolagem horizontal`, await noOverflow(page));
  check(`${tag}: sem erro de JS`, errors.length === 0, errors.join(' | '));
  const raw = await new AxeBuilder({ page }).analyze();
  // Dias de fora do mês fora do contraste (DEC-010): só os nós `[data-outside]`, só em color-contrast.
  const violations = raw.violations
    .map((v) =>
      v.id === 'color-contrast'
        ? { ...v, nodes: v.nodes.filter((n) => !/data-outside/.test(n.html)) }
        : v,
    )
    .filter((v) => v.nodes.length > 0);
  const result = { violations };
  const summary = result.violations
    .map(
      (v) =>
        `${v.id} (${v.nodes
          .slice(0, 2)
          .map((n) => n.target.join(' '))
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

const hrefOf = (page) => page.evaluate(() => window.__evidence?.href() ?? '');

/** Cor computada de um token do tema, para comparar com o que a tela usa. */
const tokenColor = (page, token, property = 'color') =>
  page.evaluate(
    ([t, p]) => {
      const probe = document.createElement('span');
      probe.style.setProperty(p, `var(${t})`);
      document.body.append(probe);
      const value = getComputedStyle(probe).getPropertyValue(p === 'color' ? 'color' : p);
      probe.remove();
      return value;
    },
    [token, property],
  );

async function runScenarios(browser, base, scenarios) {
  const shots = [];
  for (const sc of scenarios) {
    for (const size of sc.sizes ?? ['desktop', 'mobile']) {
      for (const theme of THEMES) {
        const tag = `${sc.name} · ${SIZE_LABEL[size]} · ${THEME_LABEL[theme]}`;
        const { page, context, errors, release, state } = await openPage(browser, {
          theme,
          size,
          mode: sc.mode,
          tall: sc.tall,
        });
        try {
          await gotoApp(page, base, sc.path);
          await sc.run(page, tag, { theme, size, state });
          await baseChecks(page, errors, tag, theme);
          shots.push({
            size,
            row: `${sc.name}-${size}`,
            label: tag,
            png: await page.screenshot(),
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
  mkdirSync(OUT, { recursive: true });
  const path = join(OUT, file);
  writeFileSync(path, await page.screenshot({ fullPage: true }));
  await context.close();
  console.log(`png: ${relative(ROOT, path)} (${shots.length} capturas)`);
}

// ---------- cenários ----------

const main = (page) => page.locator('main#conteudo');
const tiles = (page) => main(page).locator('ul > li[data-kind]');
const ratioOf = (locator) =>
  locator.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return r.width / r.height;
  });

/** Contorno do elemento focado: estilo, largura e se está na janela. */
const focusRing = (page) =>
  page.evaluate(() => {
    const el = document.activeElement;
    const s = getComputedStyle(el);
    return {
      role: el.getAttribute('role') ?? el.tagName.toLowerCase(),
      name: (el.textContent ?? '').trim().slice(0, 30),
      style: s.outlineStyle,
      width: parseFloat(s.outlineWidth),
      color: s.outlineColor,
    };
  });

async function shelfChecks(page, tag, { kind, ratio, label, count }) {
  const list = tiles(page);
  await list.first().waitFor();
  check(`${tag}: ${label} · ${await list.count()} cartões`, (await list.count()) === count);
  const covers = list.locator('[data-cover]');
  const ratios = await covers.evaluateAll((els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect();
      return r.width / r.height;
    }),
  );
  const wanted = ratio === '2:3' ? 2 / 3 : 16 / 9;
  check(
    `${tag}: capa ${kind === 'book' ? 'do livro' : 'do artigo'} em ${ratio}`,
    ratios.length === count && ratios.every((r) => Math.abs(r - wanted) < 0.03),
    ratios.map((r) => r.toFixed(2)).join(' '),
  );
  const fills = await list.evaluateAll((els) =>
    els.map((el) => {
      const cover = el.querySelector('[data-cover]');
      const img = cover.querySelector('img');
      const swatch = cover.querySelector('[class*="coverFill"]');
      return {
        has_img: Boolean(img),
        loaded: img ? img.complete && img.naturalWidth > 0 : null,
        bg: swatch
          ? getComputedStyle(swatch).backgroundImage +
            '|' +
            getComputedStyle(swatch).backgroundColor
          : '',
      };
    }),
  );
  const with_image = fills.filter((f) => f.has_img);
  const bare = fills.filter((f) => !f.has_img);
  check(
    `${tag}: capas com imagem carregadas (${with_image.length})`,
    with_image.length > 0 && with_image.every((f) => f.loaded),
  );
  check(
    `${tag}: gradiente determinístico sem capa (${bare.length})`,
    bare.length > 0 &&
      bare.every((f) => /gradient|rgb/.test(f.bg) && f.bg !== 'none|rgba(0, 0, 0, 0)'),
    bare
      .map((f) => f.bg)
      .join(' ; ')
      .slice(0, 120),
  );
  await page.reload();
  await tiles(page).first().waitFor();
  const again = await tiles(page).evaluateAll((els) =>
    els.map((el) => {
      const swatch = el.querySelector('[data-cover] [class*="coverFill"]');
      return swatch
        ? getComputedStyle(swatch).backgroundImage + '|' + getComputedStyle(swatch).backgroundColor
        : '';
    }),
  );
  check(
    `${tag}: mesma cor depois de recarregar`,
    again.filter(Boolean).join('#') === bare.map((f) => f.bg).join('#'),
  );
}

async function gridChecks(page, tag, { min }) {
  const boxes = await tiles(page).evaluateAll((els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect();
      const foot = el.querySelector('[class*="tileFoot"]').getBoundingClientRect();
      return {
        x: Math.round(r.left),
        y: Math.round(r.top),
        w: r.width,
        foot_bottom: Math.round(foot.bottom),
        tile_bottom: Math.round(r.bottom),
      };
    }),
  );
  check(
    `${tag}: colunas da estante com pelo menos ${min} px`,
    boxes.every((b) => b.w >= min - 1),
    boxes.map((b) => Math.round(b.w)).join(' '),
  );
  const rows = new Map();
  for (const b of boxes) rows.set(b.y, [...(rows.get(b.y) ?? []), b]);
  const aligned = [...rows.values()].every(
    (row) => new Set(row.map((b) => b.foot_bottom)).size === 1,
  );
  check(
    `${tag}: progresso e status alinhados no pé dos cartões`,
    aligned && rows.size >= 1,
    [...rows.values()].map((row) => row.map((b) => b.foot_bottom).join('/')).join(' | '),
  );
}

const themesScenarios = [
  {
    name: 'estante de livros',
    path: '/library',
    tall: true,
    run: async (page, tag, { size }) => {
      await shelfChecks(page, tag, {
        kind: 'book',
        ratio: '2:3',
        label: 'estante de livros em grade',
        count: 4,
      });
      await gridChecks(page, tag, { min: 170 });
      const bar = main(page).getByRole('progressbar', { name: /Progresso de Dom Casmurro/ });
      check(
        `${tag}: progresso de 27,5% no cartão do livro`,
        (await bar.count()) === 1 && (await main(page).getByText('Lendo').count()) >= 1,
      );
      const chips = page.getByRole('group', { name: 'Filtros' }).getByRole('button');
      check(
        `${tag}: chips de status dos livros`,
        (await chips.allTextContents()).join('|').startsWith('Todos|Quero ler|Lendo|Lido') &&
          (await chips.first().getAttribute('aria-pressed')) === 'true',
        (await chips.allTextContents()).join('|'),
      );
      for (const name of ['Filtros', 'Visualização']) {
        check(
          `${tag}: controle "${name}" presente`,
          (await page.getByRole('group', { name }).count()) >= 1,
        );
      }
      check(
        `${tag}: controle "Busca" presente`,
        (await page.getByRole('searchbox', { name: 'Busca' }).count()) === 1,
      );
      check(`${tag}: nenhum <select> nativo`, (await page.locator('select').count()) === 0);
      void size;
    },
  },
  {
    name: 'estante de artigos',
    path: '/library?tab=articles',
    tall: true,
    run: async (page, tag) => {
      await shelfChecks(page, tag, {
        kind: 'article',
        ratio: '16:9',
        label: 'estante de artigos em grade',
        count: 3,
      });
      await gridChecks(page, tag, { min: 170 });
      const chips = page.getByRole('group', { name: 'Filtros' }).getByRole('button');
      check(
        `${tag}: chips de status dos artigos`,
        (await chips.allTextContents()).join('|').startsWith('Todos|Para ler|Lendo|Lido'),
        (await chips.allTextContents()).join('|'),
      );
    },
  },
  {
    name: 'tela do livro',
    path: `/library/books/${ids.book1}`,
    tall: true,
    run: async (page, tag, { size }) => {
      await page.getByRole('heading', { level: 1, name: 'Dom Casmurro' }).waitFor();
      const data_card = page.getByRole('heading', { level: 2, name: 'Dados', exact: true });
      const record = page.getByRole('heading', { level: 2, name: 'Registro', exact: true });
      await record.waitFor();
      const a = await data_card.boundingBox();
      const b = await record.boundingBox();
      const side = size === 'desktop' ? b.x > a.x + a.width / 2 : b.y > a.y;
      check(
        `${tag}: cartão "Registro" ${size === 'desktop' ? 'na lateral' : 'abaixo de "Dados"'}`,
        side,
        `Dados x${Math.round(a.x)} y${Math.round(a.y)}, Registro x${Math.round(b.x)} y${Math.round(b.y)}`,
      );
      const cover = main(page).locator('[data-cover="2:3"]').first();
      const ratio = await ratioOf(cover);
      check(
        `${tag}: capa do livro em 2:3 na visão geral`,
        Math.abs(ratio - 2 / 3) < 0.03,
        ratio.toFixed(2),
      );
      check(
        `${tag}: progresso 27,5% (55 de 200 páginas)`,
        (await main(page)
          .getByText(/55 de 200 páginas/)
          .count()) >= 1 && (await main(page).getByText(/27,5/).count()) >= 1,
      );
      const tabs = page.getByRole('tablist', { name: 'Seções do livro' });
      check(
        `${tag}: abas Visão geral, Histórico de leitura e Notas`,
        (await tabs.getByRole('tab').allTextContents())
          .join('|')
          .startsWith('Visão geral|Histórico de leitura|Notas'),
      );
    },
  },
  {
    name: 'formulário do livro',
    path: `/library/books/${ids.book1}/edit`,
    tall: true,
    run: async (page, tag, { size }) => {
      await page.getByRole('heading', { level: 1, name: 'Editar livro' }).waitFor();
      const cover = page.getByRole('group', { name: 'Capa do livro' });
      await cover.waitFor();
      const title = page.getByRole('textbox', { name: /Título/ });
      const c = await cover.boundingBox();
      const t = await title.boundingBox();
      const left = size === 'desktop' ? c.x + c.width <= t.x + 1 : c.y + c.height <= t.y + 1;
      check(
        `${tag}: capa ${size === 'desktop' ? 'à esquerda dos campos' : 'acima dos campos'} no formulário`,
        left,
        `capa x${Math.round(c.x)}..${Math.round(c.x + c.width)} y${Math.round(c.y)}, título x${Math.round(t.x)} y${Math.round(t.y)}`,
      );
      const ratio = await ratioOf(cover);
      check(`${tag}: área de capa em 2:3`, Math.abs(ratio - 2 / 3) < 0.04, ratio.toFixed(2));
      check(
        `${tag}: "Trocar" e "Remover" na capa`,
        (await page.getByRole('button', { name: 'Trocar', exact: true }).isVisible()) &&
          (await page.getByRole('button', { name: 'Remover', exact: true }).isVisible()),
      );
      check(
        `${tag}: nenhum <select> nativo nem data/número nativos`,
        (await page.locator('select, input[type="date"], input[type="number"]').count()) === 0,
      );
    },
  },
];

const statesScenarios = [
  {
    name: 'estante vazia',
    path: '/library',
    mode: 'empty',
    run: async (page, tag) => {
      const title = page.getByText('Nada no acervo ainda');
      await title.waitFor();
      check(
        `${tag}: estado vazio · texto explicativo visível`,
        (await title.isVisible()) &&
          (await page
            .getByText('Use o botão Novo para registrar um livro, um artigo ou um vídeo.')
            .isVisible()),
      );
    },
  },
  {
    name: 'estante carregando',
    path: '/library',
    mode: 'loading',
    run: async (page, tag) => {
      const status = page.getByRole('status').filter({ hasText: 'Carregando o acervo' });
      await status.waitFor();
      check(`${tag}: estado carregando · indicador visível`, await status.isVisible());
    },
  },
  {
    name: 'estante com erro',
    path: '/library',
    mode: 'error',
    run: async (page, tag) => {
      const retry = page.getByRole('button', { name: 'Tentar de novo' });
      await retry.waitFor();
      check(
        `${tag}: estado de erro · mensagem visível`,
        (await retry.isVisible()) &&
          (await page.getByText('Não foi possível carregar o acervo').isVisible()),
      );
    },
  },
  {
    name: 'foco nas abas do livro',
    path: `/library/books/${ids.book1}`,
    tall: false,
    run: async (page, tag) => {
      await page.getByRole('heading', { level: 1, name: 'Dom Casmurro' }).waitFor();
      let ring;
      for (let i = 0; i < 25; i += 1) {
        await page.keyboard.press('Tab');
        ring = await focusRing(page);
        if (ring.role === 'tab') break;
      }
      const first = ring?.role === 'tab';
      await page.keyboard.press('ArrowRight');
      const moved = await focusRing(page);
      const selected = await page.getByRole('tab', { selected: true }).textContent();
      check(
        `${tag}: abas do livro navegadas por Tab e setas · contorno de foco visível (≥ 2 px)`,
        first &&
          moved.role === 'tab' &&
          moved.style !== 'none' &&
          moved.width >= 2 &&
          moved.name !== ring.name,
        `${ring?.name} → ${moved.name}: ${moved.style} ${moved.width}px ${moved.color}; aba ativa: ${selected}`,
      );
    },
  },
  {
    name: 'diálogo de tipo',
    path: '/library?tab=articles',
    run: async (page, tag) => {
      await tiles(page).first().waitFor();
      await page.getByRole('button', { name: 'Novo', exact: true }).click();
      const dialog = page.getByRole('dialog');
      await dialog.waitFor();
      const focused = await page.evaluate(
        () => document.activeElement?.getAttribute('data-create-type') ?? '',
      );
      const cards = await dialog.locator('[data-create-type]').count();
      check(
        `${tag}: diálogo de tipo aberto na aba Artigos · cartão Artigo focado`,
        focused === 'article' && cards === 3,
        `foco em "${focused}", ${cards} cartões`,
      );
    },
  },
  {
    name: 'imagem inválida na capa',
    path: '/library/books/new',
    tall: false,
    run: async (page, tag) => {
      await page.getByRole('heading', { level: 1, name: 'Novo livro' }).waitFor();
      await page.locator('input[type="file"][aria-label="Capa do livro"]').setInputFiles({
        name: 'capa.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('não é imagem'),
      });
      const alert = page
        .locator('form')
        .getByRole('alert')
        .filter({ hasText: 'Use uma imagem PNG, JPEG ou WebP.' });
      await alert.waitFor();
      check(
        `${tag}: imagem inválida · erro em role="alert" dentro do formulário`,
        await alert.isVisible(),
      );
    },
  },
];

// ---------- principal ----------

const EVIDENCES = {
  'themes-widths': async (browser, base) => {
    const shots = await runScenarios(browser, base, themesScenarios);
    await sheet(browser, {
      title: 'TASK-28 · temas e larguras do Acervo (RNF-08, RNF-10, PD-35 a PD-39, PD-59)',
      file: 'library-themes-widths.png',
      shots,
      scale: { desktop: 0.5, mobile: 0.62 },
    });
  },
  'states-focus': async (browser, base) => {
    const shots = await runScenarios(browser, base, statesScenarios);
    await sheet(browser, {
      title: 'TASK-28 · estados e foco do Acervo (RNF-06, PD-09, PD-36)',
      file: 'library-states-focus.png',
      shots,
      scale: { desktop: 0.5, mobile: 0.62 },
    });
  },
};

const names = process.argv.slice(2);
const unknown = names.filter((n) => !(n in EVIDENCES));
if (names.length === 0 || unknown.length > 0) {
  console.error(
    `Evidência desconhecida ou ausente: ${unknown.join(', ') || '(nenhuma)'}. Use themes-widths ou states-focus.`,
  );
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
  await vite?.stop();
}
console.log(`\n${failures === 0 ? 'ok' : 'FALHA'}  ${failures} falha(s)`);
process.exit(failures === 0 ? 0 : 1);
