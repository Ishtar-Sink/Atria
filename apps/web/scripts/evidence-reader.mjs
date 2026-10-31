// Evidências visuais da TASK-29 (modo leitura), sem passo manual: sobe o Vite numa porta livre (API
// `createServer`), serve uma página virtual que carrega `src/features/reader/evidence/harness.tsx`
// (as rotas do leitor num roteador em memória, com os providers do app e fora do layout), simula a API
// no navegador com fixtures em memória (o PDF é montado em bytes aqui), confere o estado no DOM antes
// de cada captura e monta a prancha (PNG) em vostok/work/tasks/SPEC-001/evidence/TASK-29/.
// Uso: node apps/web/scripts/evidence-reader.mjs themes-widths|states-focus
// Imprime "ok" ou "FALHA" por verificação e o caminho do PNG; sai com código 1 se algo falhar.
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
const OUT = join(ROOT, 'vostok', 'work', 'tasks', 'SPEC-001', 'evidence', 'TASK-29');

const THEMES = ['light', 'dark'];
const SIZES = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 360, height: 760 },
};
const SIZE_LABEL = { desktop: 'desktop 1440', mobile: '360 px' };
const THEME_LABEL = { light: 'claro', dark: 'escuro' };
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
    <title>Atria · evidência do leitor</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/features/reader/evidence/harness.tsx"></script>
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

// ---------- PDF de exemplo, montado em bytes ----------

const PAGE_W = 612;
const PAGE_H = 792;
const PAGE_COUNT = 70;
const OPEN_PAGE = 40;
const CLOSE_PAGE = 62;

/** PDF válido de `count` páginas com texto (Helvetica), sem arquivo no repositório. */
function makePdf(count) {
  const objects = [];
  const add = (body) => {
    objects.push(body);
    return objects.length;
  };
  add('<< /Type /Catalog /Pages 2 0 R >>');
  const kids = Array.from({ length: count }, (_, i) => `${4 + i * 2} 0 R`).join(' ');
  add(`<< /Type /Pages /Kids [${kids}] /Count ${count} >>`);
  add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  for (let n = 1; n <= count; n += 1) {
    const text = (size, y, value) => `BT /F1 ${size} Tf 72 ${y} Td (${value}) Tj ET`;
    const stream = [
      text(24, 720, `Página ${n}`),
      text(14, 680, `Trecho de exemplo da página ${n}, para selecionar e destacar.`),
      text(14, 660, 'O leitor abre na última página lida e guarda a saída.'),
      text(14, 640, 'A sessão de leitura só entra no histórico depois de confirmada.'),
      text(14, 600, 'Segundo parágrafo da página, com mais texto para a seleção.'),
    ].join('\n');
    const page = 4 + (n - 1) * 2;
    add(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 3 0 R >> >> /Contents ${page + 1} 0 R >>`,
    );
    add(`<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`);
  }
  let out = '%PDF-1.4\n';
  const offsets = [];
  objects.forEach((body, i) => {
    offsets.push(Buffer.byteLength(out, 'latin1'));
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = Buffer.byteLength(out, 'latin1');
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) out += `${String(offset).padStart(10, '0')} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

const PDF_OK = makePdf(PAGE_COUNT);
const PDF_BAD = Buffer.from('isto não é um PDF: bytes inválidos', 'utf8');

// ---------- API simulada ----------

const U = '3d5e0a21-7c4f-4b18-9a62-1e8f0c2d4b00';
const BOOK = '0b6f7d52-3c1e-4a50-9f7b-1d2a8e4c5a01';
const FILE_OK = '9a1c5e07-2b4d-4f86-a3c1-5d7e9b0f2a11';
const FILE_BAD = '9a1c5e07-2b4d-4f86-a3c1-5d7e9b0f2a12';

/** Destaque sobre o título da página 40, em frações da página. */
const HIGHLIGHT = {
  id: '7c3e1a90-5b2d-4e68-8f41-0a9d6c2b7e21',
  owner_id: U,
  file_id: FILE_OK,
  page: OPEN_PAGE,
  color: 'warning',
  text: `Página ${OPEN_PAGE}`,
  rects: [{ x: 72 / PAGE_W, y: 50 / PAGE_H, width: 120 / PAGE_W, height: 28 / PAGE_H }],
  is_current_file: true,
  created_at: '2026-10-30T10:00:00Z',
};

/** Modos: normal, loading (arquivo segurado) e corrupted (bytes inválidos no lugar do PDF). */
async function installApi(context, mode, gate) {
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
        if (mode === 'loading') await gate;
        const bytes = mode === 'corrupted' ? PDF_BAD : PDF_OK;
        return route.fulfill({ status: 200, contentType: 'application/pdf', body: bytes });
      }
      if (path === `/books/${BOOK}` && method === 'GET')
        return reply({
          id: BOOK,
          owner_id: U,
          title: 'Dom Casmurro',
          author: 'Machado de Assis',
          page_count: PAGE_COUNT,
          reading_status: 'reading',
          pdf_file_id: mode === 'corrupted' ? FILE_BAD : FILE_OK,
          tags: [],
          visibility: 'personal',
          created_at: '2026-10-01T10:00:00Z',
          updated_at: '2026-10-26T18:00:00Z',
        });
      if (path === `/books/${BOOK}/reading-position`) {
        if (method === 'PUT') return reply({ page: JSON.parse(request.postData() ?? '{}').page });
        return reply({ page: OPEN_PAGE });
      }
      if (path === `/books/${BOOK}/highlights` && method === 'GET')
        return reply({ items: [HIGHLIGHT] });
      return reply({ title: 'Não encontrado', code: 'not_found' }, 404);
    },
  );
  return state;
}

// ---------- captura ----------

async function openPage(browser, { theme, size, mode = 'normal' }) {
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
  let release = () => {};
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const state = await installApi(context, mode, gate);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  return { page, context, errors, release, state };
}

const noOverflow = (page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

/** Verificações comuns a toda captura: tema, sem rolagem horizontal, sem erro de JS e axe. */
async function baseChecks(page, errors, tag, theme) {
  const root = await page.evaluate(() => ({
    app: document.documentElement.dataset.theme,
    reader: document.querySelector('[data-theme]:not(html)')?.getAttribute('data-theme'),
  }));
  check(
    `${tag}: tema ${THEME_LABEL[theme]} aplicado`,
    root.app === theme && root.reader === theme,
    `app ${root.app} · leitor ${root.reader}`,
  );
  check(`${tag}: sem rolagem horizontal`, await noOverflow(page));
  check(`${tag}: sem erro de JS`, errors.length === 0, errors.join(' | '));
  const result = await new AxeBuilder({ page }).analyze();
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
    `${tag}: axe sem violações (inclusive color-contrast)`,
    result.violations.length === 0,
    summary,
  );
}

async function gotoReader(page, base, path = `/library/books/${BOOK}/read`) {
  await page.goto(`${base}/__evidence?path=${encodeURIComponent(path)}`);
  await page.locator('[role="toolbar"]').first().waitFor();
  await page.evaluate(() => document.fonts.ready);
}

const pageRegion = (page, n) => page.locator(`[role="region"][data-page="${n}"]`);

/** Espera a página renderizada: canvas com pixels de texto e camada de texto preenchida. */
async function waitPageDrawn(page, n) {
  await page.waitForFunction(
    (num) => {
      const el = document.querySelector(`[role="region"][data-page="${num}"]`);
      const canvas = el?.querySelector('canvas');
      if (!el || !canvas || canvas.width === 0) return false;
      const ctx = canvas.getContext('2d');
      const data = ctx.getImageData(0, 0, canvas.width, Math.min(canvas.height, 600)).data;
      let ink = 0;
      for (let i = 0; i < data.length; i += 4) if (data[i] < 120) ink += 1;
      const text = el.querySelector('span');
      return ink > 50 && text !== null;
    },
    n,
    { timeout: 20000 },
  );
  await page.waitForTimeout(150);
}

const focusRing = (page) =>
  page.evaluate(() => {
    const el = document.activeElement;
    const s = getComputedStyle(el);
    return {
      name: (el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 30),
      style: s.outlineStyle,
      width: parseFloat(s.outlineWidth),
      color: s.outlineColor,
    };
  });

/** Sem sidebar nem topbar do app e com a barra do leitor inteira dentro da janela. */
async function chromeChecks(page, tag) {
  const absent = await page.evaluate(
    () =>
      document.querySelector('aside#sidebar') === null &&
      document.querySelector('main#conteudo') === null &&
      document.querySelector('#menu-button') === null &&
      document.querySelector('header') === null,
  );
  check(`${tag}: sem sidebar nem topbar`, absent);
  const bar = await page.evaluate(() => {
    const toolbar = document.querySelector('[role="toolbar"]');
    const box = toolbar.getBoundingClientRect();
    const inside = [...toolbar.querySelectorAll('button, a, input')].every((el) => {
      const r = el.getBoundingClientRect();
      return r.left >= -0.5 && r.right <= window.innerWidth + 0.5;
    });
    return {
      inside,
      fits: toolbar.scrollWidth <= toolbar.clientWidth + 1,
      box: `l${Math.round(box.left)} r${Math.round(box.right)} / ${innerWidth}`,
    };
  });
  check(`${tag}: barra do leitor inteira dentro da janela`, bar.inside && bar.fits, bar.box);
}

async function runScenarios(browser, base, scenarios) {
  const shots = [];
  for (const sc of scenarios) {
    for (const size of ['desktop', 'mobile']) {
      for (const theme of THEMES) {
        const tag = `${sc.name} · ${SIZE_LABEL[size]} · ${THEME_LABEL[theme]}`;
        const { page, context, errors, release, state } = await openPage(browser, {
          theme,
          size,
          mode: sc.mode,
        });
        try {
          await gotoReader(page, base);
          await sc.run(page, tag, { theme, size, state, base });
          await baseChecks(page, errors, tag, theme);
          shots.push({ size, row: `${sc.name}-${size}`, label: tag, png: await page.screenshot() });
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

// ---------- evidência: temas e larguras ----------

const themesScenarios = [
  {
    name: 'leitor com PDF, destaque e nota de trecho',
    run: async (page, tag) => {
      await waitPageDrawn(page, OPEN_PAGE);
      check(`${tag}: página do PDF renderizada`, true, `página ${OPEN_PAGE}`);
      const input = await page.getByLabel('Página atual').inputValue();
      check(
        `${tag}: reabriu na página ${OPEN_PAGE}`,
        input === String(OPEN_PAGE),
        `campo ${input}`,
      );
      const mark = pageRegion(page, OPEN_PAGE).locator('[data-color="warning"]');
      await mark.first().waitFor();
      const box = await mark.first().boundingBox();
      check(`${tag}: destaque visível na página`, !!box && box.width > 8 && box.height > 4);
      // Seleciona um trecho de verdade, para a barra da seleção e o painel da nota.
      await page.evaluate((n) => {
        const layer = document.querySelector(
          `[role="region"][data-page="${n}"] [class*="textLayer"]`,
        );
        const span = [...layer.querySelectorAll('span')].find((s) =>
          s.textContent.includes('Trecho de exemplo'),
        );
        const range = document.createRange();
        range.selectNodeContents(span);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
      }, OPEN_PAGE);
      await page.getByRole('button', { name: 'Criar nota' }).click();
      const panel = page.locator('aside');
      await panel.waitFor();
      await page.getByLabel('Comentário (opcional)').fill('Voltar a este trecho na releitura.');
      const quote = await panel.locator('blockquote').textContent();
      check(
        `${tag}: painel da nota de trecho aberto`,
        (await panel.isVisible()) && /Trecho de exemplo/.test(quote ?? ''),
        (quote ?? '').slice(0, 40),
      );
      await chromeChecks(page, tag);
    },
  },
];

// ---------- evidência: estados e foco ----------

const statesScenarios = [
  {
    name: 'carregando',
    mode: 'loading',
    run: async (page, tag) => {
      const loading = page.getByText('Carregando o PDF…');
      await loading.waitFor();
      const skeleton = await page.evaluate(() => {
        const row = document.querySelector('[role="status"][aria-busy="true"] i');
        const r = row?.getBoundingClientRect();
        return r ? `${Math.round(r.width)}x${Math.round(r.height)}` : '0x0';
      });
      const [sw, sh] = skeleton.split('x').map(Number);
      check(
        `${tag}: estado carregando · indicador visível`,
        (await loading.count()) === 1 && sw > 50 && sh > 10,
        `esqueleto ${skeleton}`,
      );
      await chromeChecks(page, tag);
    },
  },
  {
    name: 'PDF corrompido',
    mode: 'corrupted',
    run: async (page, tag) => {
      const alert = page.getByRole('alert');
      await alert.waitFor();
      const text = (await alert.textContent()) ?? '';
      const download = page.getByRole('link', { name: 'Baixar' });
      check(
        `${tag}: PDF corrompido · erro em role="alert" com o botão "Baixar" visível`,
        /corrompido/.test(text) && (await download.isVisible()),
        text.slice(0, 40),
      );
      check(
        `${tag}: botão "Baixar" aponta para o arquivo`,
        (await download.getAttribute('href')) === `/api/v1/files/${FILE_BAD}`,
      );
      await chromeChecks(page, tag);
    },
  },
  {
    name: 'oferta de sessão ao fechar (40 a 62)',
    run: async (page, tag, { state }) => {
      await waitPageDrawn(page, OPEN_PAGE);
      const input = page.getByLabel('Página atual');
      await input.fill(String(CLOSE_PAGE));
      await input.press('Enter');
      await page.waitForFunction(
        (n) => document.querySelector('input[inputmode="numeric"]')?.value === String(n),
        CLOSE_PAGE,
      );
      await page.getByRole('button', { name: /Fechar leitor/ }).click();
      const dialog = page.getByRole('dialog', { name: 'Registrar esta sessão de leitura?' });
      await dialog.waitFor();
      const text = (await dialog.textContent()) ?? '';
      check(
        `${tag}: oferta de sessão · texto "da página ${OPEN_PAGE} até a ${CLOSE_PAGE}"`,
        text.includes(`da página ${OPEN_PAGE} até a ${CLOSE_PAGE}`),
      );
      const value = await dialog.getByLabel('Páginas lidas').inputValue();
      check(
        `${tag}: campo "Páginas lidas" com ${CLOSE_PAGE - OPEN_PAGE}`,
        value === String(CLOSE_PAGE - OPEN_PAGE),
        `valor ${value}`,
      );
      check(
        `${tag}: botões "Registrar sessão" e "Agora não" visíveis`,
        (await dialog.getByRole('button', { name: 'Registrar sessão' }).isVisible()) &&
          (await dialog.getByRole('button', { name: 'Agora não' }).isVisible()),
      );
      check(
        `${tag}: página de fechamento guardada antes da oferta (DEC-004)`,
        state.calls.includes(`PUT /books/${BOOK}/reading-position`),
      );
      check(
        `${tag}: nada registrado sem confirmação (RN-23)`,
        !state.calls.some((c) => c.startsWith('POST')),
      );
      await page.waitForTimeout(200);
    },
  },
  {
    name: 'foco por teclado na barra',
    run: async (page, tag) => {
      await waitPageDrawn(page, OPEN_PAGE);
      // O foco começa na área das páginas; Shift+Tab percorre a barra de trás para a frente.
      const stops = [];
      for (let i = 0; i < 14; i += 1) {
        await page.keyboard.press('Shift+Tab');
        const ring = await focusRing(page);
        stops.push(ring);
        if (/Fechar leitor/.test(ring.name)) break;
      }
      const reached = /Fechar leitor/.test(stops[stops.length - 1].name);
      check(`${tag}: barra navegada por Tab · botão "Fechar leitor" alcançado`, reached);
      const weak = stops.filter((s) => s.style === 'none' || s.width < 2);
      check(
        `${tag}: barra navegada por Tab · contorno de foco visível (≥ 2 px)`,
        stops.length > 3 && weak.length === 0,
        weak.length
          ? weak.map((s) => `${s.name} ${s.style} ${s.width}px`).join(' | ')
          : `${stops.length} paradas, ${stops[stops.length - 1].style} ${stops[stops.length - 1].width}px ${stops[stops.length - 1].color}`,
      );
      await chromeChecks(page, tag);
    },
  },
];

// ---------- principal ----------

const EVIDENCES = {
  'themes-widths': async (browser, base) => {
    const shots = await runScenarios(browser, base, themesScenarios);
    await sheet(browser, {
      title: 'TASK-29 · leitor com PDF, destaque e nota de trecho (RF-65, RNF-08, RNF-10)',
      file: 'reader-themes-widths.png',
      shots,
      scale: { desktop: 0.5, mobile: 0.62 },
    });
  },
  'states-focus': async (browser, base) => {
    const shots = await runScenarios(browser, base, statesScenarios);
    await sheet(browser, {
      title: 'TASK-29 · carregando, erro, oferta de sessão e foco (CB-16, RF-67, RNF-06, PD-60)',
      file: 'reader-states-focus.png',
      shots,
      scale: { desktop: 0.5, mobile: 0.62 },
    });
  },
};

const wanted = process.argv.slice(2);
const names = wanted.length > 0 ? wanted : Object.keys(EVIDENCES);
const unknown = names.filter((n) => !(n in EVIDENCES));
if (unknown.length > 0) {
  console.error(
    `Evidência desconhecida: ${unknown.join(', ')}. Use themes-widths ou states-focus.`,
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
  if (vite) await vite.stop();
}
console.log(`\n${failures === 0 ? 'ok' : 'FALHA'}  ${failures} falha(s)`);
process.exit(failures === 0 ? 0 : 1);
