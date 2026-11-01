// Evidência visual da TASK-23 (leitor: primeira página rápida e zoom), sem passo manual: sobe o
// Vite numa porta livre, serve uma página virtual que carrega `src/features/reader/evidence/harness.tsx`,
// simula a API no navegador com um PDF de cerca de 21 MB servido em partes (Range/206) e fotografa
// o leitor a 1920 px e a 360 px, nos temas claro e escuro.
// Uso: node apps/web/scripts/evidence-reader-zoom.mjs <caminho.png>
// Imprime "ok" ou "FALHA" por verificação; sai com código 1 se algo falhar.
import { mkdirSync, writeFileSync } from 'node:fs';
import { createServer as createNetServer } from 'node:net';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as axePackage from '@axe-core/playwright';
import { chromium } from '@playwright/test';
import { createServer } from 'vite';

const AxeBuilder = axePackage.default ?? axePackage.AxeBuilder;
const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');

const out_arg = process.argv[2];
if (!out_arg) {
  console.error('Uso: node apps/web/scripts/evidence-reader-zoom.mjs <caminho.png>');
  process.exit(2);
}
const OUT = resolve(out_arg);

const THEMES = ['light', 'dark'];
const THEME_LABEL = { light: 'claro', dark: 'escuro' };
const SIZES = {
  wide: { width: 1920, height: 1080 },
  narrow: { width: 360, height: 760 },
};
const SIZE_LABEL = { wide: '1920 px', narrow: '360 px' };
const MAX_FIRST_PAGE_MS = 3000;
const FILLER_BYTES = 21 * 1024 * 1024;

let failures = 0;
function check(name, cond, extra) {
  if (!cond) failures += 1;
  console.log(`${cond ? 'ok    ' : 'FALHA '} ${name}${extra ? ` · ${extra}` : ''}`);
}

// ---------- servidor de desenvolvimento ----------

function freePort() {
  return new Promise((resolvePort, reject) => {
    const server = createNetServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolvePort(port));
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

// ---------- PDF grande, montado em bytes ----------

const PAGE_W = 612;
const PAGE_H = 792;
const PAGE_COUNT = 64;

/** PDF válido de `count` páginas com texto e um objeto de enchimento não referenciado antes da xref. */
function makePdf(count, filler) {
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
      text(14, 680, `Trecho de exemplo da página ${n} de um PDF grande servido em partes.`),
    ].join('\n');
    const page = 4 + (n - 1) * 2;
    add(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 3 0 R >> >> /Contents ${page + 1} 0 R >>`,
    );
    add(`<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`);
  }
  add(`<< /Length ${filler} >>\nstream\n${'A'.repeat(filler)}\nendstream`);
  let body = '%PDF-1.4\n';
  const offsets = [];
  objects.forEach((obj, i) => {
    offsets.push(Buffer.byteLength(body, 'latin1'));
    body += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xref = Buffer.byteLength(body, 'latin1');
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) body += `${String(offset).padStart(10, '0')} 00000 n \n`;
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(body, 'latin1');
}

const PDF = makePdf(PAGE_COUNT, FILLER_BYTES);

// ---------- API simulada, com envio parcial ----------

const U = '3d5e0a21-7c4f-4b18-9a62-1e8f0c2d4b00';
const BOOK = '0b6f7d52-3c1e-4a50-9f7b-1d2a8e4c5a01';
const FILE = '9a1c5e07-2b4d-4f86-a3c1-5d7e9b0f2a11';

async function installApi(context) {
  const state = { ranged: 0, partial_bytes: 0 };
  await context.route(
    (url) => url.pathname.startsWith('/api/'),
    async (route) => {
      const request = route.request();
      const path = new URL(request.url()).pathname.replace('/api/v1', '');
      const method = request.method();
      const reply = (body, status = 200) =>
        route.fulfill({
          status,
          contentType: status >= 400 ? 'application/problem+json' : 'application/json',
          body: JSON.stringify(body),
        });
      if (path === '/me')
        return reply({ id: U, email: 'ana@exemplo.com', display_name: 'Ana Maria Souza' });
      if (path === '/me/preferences') return reply({});
      if (path === `/files/${FILE}`) {
        const range = request.headers().range?.match(/^bytes=(\d+)-(\d*)$/);
        if (!range) {
          return route.fulfill({
            status: 200,
            contentType: 'application/pdf',
            headers: { 'Accept-Ranges': 'bytes', 'Content-Length': String(PDF.length) },
            body: PDF,
          });
        }
        const start = Number(range[1]);
        const end = Math.min(range[2] === '' ? PDF.length - 1 : Number(range[2]), PDF.length - 1);
        const chunk = PDF.subarray(start, end + 1);
        state.ranged += 1;
        state.partial_bytes += chunk.length;
        return route.fulfill({
          status: 206,
          contentType: 'application/pdf',
          headers: {
            'Accept-Ranges': 'bytes',
            'Content-Range': `bytes ${start}-${end}/${PDF.length}`,
            'Content-Length': String(chunk.length),
          },
          body: chunk,
        });
      }
      if (path === `/books/${BOOK}` && method === 'GET')
        return reply({
          id: BOOK,
          owner_id: U,
          title: 'Livro grande',
          author: 'Autora de exemplo',
          page_count: PAGE_COUNT,
          reading_status: 'reading',
          pdf_file_id: FILE,
          tags: [],
          visibility: 'personal',
          created_at: '2026-10-01T10:00:00Z',
          updated_at: '2026-10-26T18:00:00Z',
        });
      if (path === `/books/${BOOK}/reading-position`) {
        if (method === 'PUT') return reply({ page: JSON.parse(request.postData() ?? '{}').page });
        return reply({ page: 1 });
      }
      if (path === `/books/${BOOK}/highlights` && method === 'GET') return reply({ items: [] });
      return reply({ title: 'Não encontrado', code: 'not_found' }, 404);
    },
  );
  return state;
}

// ---------- captura ----------

async function capture(browser, base, { theme, size }) {
  const tag = `${SIZE_LABEL[size]} · ${THEME_LABEL[theme]}`;
  const context = await browser.newContext({
    viewport: SIZES[size],
    reducedMotion: 'reduce',
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
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
  const state = await installApi(context);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    const path = `/library/books/${BOOK}/read`;
    const started = Date.now();
    await page.goto(`${base}/__evidence?path=${encodeURIComponent(path)}`);
    const text = page.locator('[role="region"][data-page="1"] span', {
      hasText: 'Trecho de exemplo',
    });
    await text.first().waitFor({ timeout: 20000 });
    const elapsed = Date.now() - started;
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(200);

    check(
      `${tag}: primeira página em ${elapsed} ms (até ${MAX_FIRST_PAGE_MS})`,
      elapsed <= MAX_FIRST_PAGE_MS,
    );
    check(`${tag}: pedidos com Range: ${state.ranged}`, state.ranged > 0);
    check(
      `${tag}: arquivo não baixado inteiro`,
      state.partial_bytes < PDF.length,
      `${state.partial_bytes} de ${PDF.length} bytes`,
    );

    const box = await page
      .locator('[role="region"][data-page="1"] canvas')
      .first()
      .evaluate((el) => {
        const r = el.getBoundingClientRect();
        return { left: r.left, right: r.right, width: r.width };
      });
    if (size === 'wide') {
      check(
        `largura da página a 1920 px: ${Math.round(box.width)} px (900 a 960)`,
        box.width >= 900 && box.width <= 960.5,
        tag,
      );
    } else {
      check(
        `${tag}: página dentro da janela a 360 px`,
        box.left >= -0.5 && box.right <= SIZES.narrow.width + 0.5,
        `${Math.round(box.left)} a ${Math.round(box.right)} px`,
      );
    }

    const zoom_label = await page.getByRole('button', { name: /^Zoom \d+%/ }).textContent();
    check(`${tag}: rótulo "Zoom 100%"`, /Zoom 100%/.test(zoom_label ?? ''), zoom_label?.trim());
    const root = await page.evaluate(() => document.documentElement.dataset.theme);
    check(`${tag}: tema ${THEME_LABEL[theme]} aplicado`, root === theme, `app ${root}`);
    check(
      `${tag}: sem rolagem horizontal`,
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
    );
    check(`${tag}: sem erro de JS`, errors.length === 0, errors.join(' | '));
    const axe = await new AxeBuilder({ page }).analyze();
    check(
      `${tag}: axe sem violações (inclui color-contrast)`,
      axe.violations.length === 0,
      axe.violations.map((v) => v.id).join(' | '),
    );
    return { size, label: tag, png: await page.screenshot() };
  } catch (e) {
    check(`${tag}: cenário executou`, false, String(e.message).split('\n')[0]);
    return undefined;
  } finally {
    await context.close();
  }
}

// ---------- prancha ----------

async function sheet(browser, shots) {
  const scale = { wide: 0.38, narrow: 0.62 };
  const figure = (s) => {
    const w = Math.round(SIZES[s.size].width * scale[s.size]);
    return `<figure style="width:${w}px"><img style="width:${w}px" src="data:image/png;base64,${s.png.toString('base64')}"><figcaption>${s.label}</figcaption></figure>`;
  };
  const rows = ['wide', 'narrow']
    .map(
      (size) =>
        `<div class="row">${shots
          .filter((s) => s.size === size)
          .map(figure)
          .join('')}</div>`,
    )
    .join('');
  const html = `<!doctype html><meta charset="utf-8"><style>
    body{margin:0;padding:24px;background:#1b1b20;color:#e8e8ee;font:13px/1.4 system-ui,sans-serif}
    h1{font-size:18px;margin:0 0 16px}
    main{display:flex;flex-direction:column;gap:24px}
    figure{margin:0}
    .row{display:flex;gap:20px;align-items:flex-start}
    img{display:block;border:1px solid #444;border-radius:4px}
    figcaption{margin-top:6px;color:#b8b8c4}
  </style><h1>TASK-23 · leitor com PDF de cerca de 21 MB em partes: 100% na largura de leitura (RF-28, RF-29)</h1><main>${rows}</main>`;
  const context = await browser.newContext({ viewport: { width: 1520, height: 800 } });
  const page = await context.newPage();
  await page.setContent(html);
  await page.waitForFunction(() => [...document.images].every((i) => i.complete));
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, await page.screenshot({ fullPage: true }));
  await context.close();
  console.log(`png: ${OUT} (${shots.length} capturas)`);
}

// ---------- principal ----------

let vite;
let browser;
try {
  vite = await startVite();
  console.log(`vite: ${vite.url} (porta livre, encerrado ao final)`);
  browser = await chromium.launch();
  const shots = [];
  for (const size of ['wide', 'narrow']) {
    for (const theme of THEMES) {
      const shot = await capture(browser, vite.url, { theme, size });
      if (shot) shots.push(shot);
    }
  }
  if (shots.length > 0) await sheet(browser, shots);
} catch (e) {
  failures += 1;
  console.log(`FALHA  execução: ${e.message}`);
} finally {
  await browser?.close();
  if (vite) await vite.stop();
}
console.log(`\n${failures === 0 ? 'ok' : 'FALHA'}  ${failures} falha(s)`);
process.exit(failures === 0 ? 0 : 1);
