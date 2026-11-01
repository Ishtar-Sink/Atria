// Evidência da TASK-21 (Acervo: área de capa e envio com progresso), sem passo manual: sobe o Vite
// numa porta livre, serve uma página virtual que carrega `src/features/library/evidence/harness.tsx`,
// simula a API no navegador (o PUT do PDF fica seguro até o script liberar) e confere, nos temas claro
// e escuro, em 1280 px e 360 px, a área de capa como controle e o envio do PDF de 21 MB com barra e
// aviso. Ao fim grava um vídeo (desktop 1280x800, tema claro) com o foco, o arrasto e o envio.
// Uso: node apps/web/scripts/evidence-cover-upload.mjs <caminho.webm>
// Imprime "ok" ou "FALHA" por verificação, "video: <caminho> (N capturas)" e, na última linha,
// "ok  0 falha(s)"; sai com código 1 se algo falhar.
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { createServer as createNetServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as axePackage from '@axe-core/playwright';
import { chromium } from '@playwright/test';
import { createServer } from 'vite';

const AxeBuilder = axePackage.default ?? axePackage.AxeBuilder;
const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const THEMES = ['light', 'dark'];
const THEME_LABEL = { light: 'claro', dark: 'escuro' };
const SIZES = { desktop: { width: 1280, height: 800 }, mobile: { width: 360, height: 760 } };
const SIZE_LABEL = { desktop: '1280 px', mobile: '360 px' };
const U = '3d5e0a21-7c4f-4b18-9a62-1e8f0c2d4b00';
const PDF_BYTES = 21 * 1024 * 1024;
const AREA_NAME = 'Capa do livro: clique ou arraste uma imagem';

let failures = 0;
let captures = 0;
function check(name, cond, extra) {
  if (!cond) failures += 1;
  console.log(`${cond ? 'ok    ' : 'FALHA '} ${name}${extra ? ` · ${extra}` : ''}`);
}

const pause = (ms) => new Promise((done) => setTimeout(done, ms));

function freePort() {
  return new Promise((done, fail) => {
    const server = createNetServer();
    server.once('error', fail);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => done(port));
    });
  });
}

const PAGE_HTML = `<!doctype html>
<html lang="pt-BR" data-theme="light">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light dark" />
    <title>Atria · evidência da área de capa</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/features/library/evidence/harness.tsx"></script>
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

/** API simulada; o `PUT /books/{id}/pdf` espera `gate.release()`. */
async function installApi(context) {
  let release = () => {};
  const held = new Promise((done) => {
    release = done;
  });
  const gate = { release };
  const books = [];
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
        return reply({ id: U, email: 'ana@exemplo.com', display_name: 'Ana Souza' });
      if (path === '/me/preferences') return reply({});
      if (path === '/search') return reply({ groups: [] });
      if (path === '/books' && method === 'POST') {
        const body = JSON.parse(request.postData() ?? '{}');
        const book = {
          owner_id: U,
          tags: [],
          visibility: 'personal',
          reading_status: 'want_to_read',
          created_at: '2026-11-05T12:00:00Z',
          updated_at: '2026-11-05T12:00:00Z',
          ...body,
          id: 'b0000000-0000-4000-8000-000000000001',
        };
        books.push(book);
        return reply(book, 201);
      }
      const item = path.match(/^\/books\/([^/]+)(?:\/(cover|pdf|reading-sessions|book-notes))?$/);
      if (item) {
        const book = books.find((b) => b.id === item[1]);
        if (!book) return reply({ title: 'Não encontrado', code: 'not_found' }, 404);
        if (item[2] === 'pdf' && method === 'PUT') {
          await held;
          Object.assign(book, { pdf_file_id: 'file-pdf-1' });
          return reply(book);
        }
        if (item[2] === 'cover' && method === 'PUT') return reply(book);
        if (item[2]) return reply({ items: [] });
        return reply(book);
      }
      return reply({ title: 'Não encontrado', code: 'not_found' }, 404);
    },
  );
  return gate;
}

async function openPage(browser, { theme, size, video }) {
  const context = await browser.newContext({
    viewport: SIZES[size],
    reducedMotion: 'reduce',
    locale: 'pt-BR',
    ...(video ? { recordVideo: { dir: video, size: SIZES[size] } } : {}),
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
  // A interceptação de rede do Playwright não emite progresso de envio: o script informa 50% do
  // corpo logo ao enviar, como o navegador faria com a rede segurando o resto.
  await context.addInitScript(() => {
    const send = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send = function patched(body) {
      if (body instanceof Blob) {
        const total = body.size;
        setTimeout(() => {
          this.upload.dispatchEvent(
            new ProgressEvent('progress', { lengthComputable: true, loaded: total / 2, total }),
          );
        }, 50);
      }
      return send.call(this, body);
    };
  });
  const gate = await installApi(context);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  return { page, context, gate, errors };
}

async function gotoForm(page, base) {
  await page.goto(`${base}/__evidence?path=${encodeURIComponent('/library/books/new')}`);
  await page.locator('main#conteudo').waitFor();
  await page.evaluate(() => document.fonts.ready);
}

async function axeCheck(page, tag) {
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
    `${tag}: axe sem violações (inclui color-contrast)`,
    result.violations.length === 0,
    summary,
  );
}

/** Cursor desenhado na página, para o vídeo mostrar para onde o mouse vai. */
async function installCursor(page) {
  await page.addInitScript(() => {
    addEventListener('DOMContentLoaded', () => {
      const dot = document.createElement('div');
      dot.style.cssText =
        'position:fixed;z-index:99999;width:18px;height:18px;margin:-9px 0 0 -9px;border-radius:50%;' +
        'background:rgba(220,60,60,.75);border:2px solid #fff;pointer-events:none;left:-40px;top:-40px';
      document.body.append(dot);
      addEventListener(
        'mousemove',
        (e) => {
          dot.style.left = `${e.clientX}px`;
          dot.style.top = `${e.clientY}px`;
        },
        true,
      );
    });
  });
}

async function focusArea(page) {
  for (let i = 0; i < 20; i += 1) {
    await page.keyboard.press('Tab');
    const hit = await page.evaluate(
      (name) =>
        document.activeElement?.getAttribute('role') === 'button' &&
        document.activeElement?.getAttribute('aria-label') === name,
      AREA_NAME,
    );
    if (hit) return true;
  }
  return false;
}

async function dragOver(page, area) {
  const handle = await page.evaluateHandle(() => {
    const data = new DataTransfer();
    data.items.add(new File([new Uint8Array(8)], 'capa.png', { type: 'image/png' }));
    return data;
  });
  await area.dispatchEvent('dragover', { dataTransfer: handle });
}

/** O fluxo completo; `slow` espaça os passos para o vídeo. */
async function runFlow(page, gate, errors, tag, { base, theme, slow }) {
  const wait = (ms) => (slow ? pause(ms) : Promise.resolve());
  await gotoForm(page, base);
  const area = page.getByRole('button', { name: AREA_NAME });
  await area.waitFor();
  await wait(1200);
  check(
    `${tag}: sem botão Escolher imagem`,
    (await page.getByRole('button', { name: 'Escolher imagem' }).count()) === 0,
  );
  check(
    `${tag}: tema ${THEME_LABEL[theme]} aplicado`,
    (await page.evaluate(() => document.documentElement.dataset.theme)) === theme,
  );
  await axeCheck(page, `${tag}: área vazia`);

  check(`${tag}: foco na área (role button)`, await focusArea(page));
  const outline = await area.evaluate(
    (el) =>
      getComputedStyle(el).outlineStyle !== 'none' &&
      parseFloat(getComputedStyle(el).outlineWidth) >= 2,
  );
  check(`${tag}: contorno de foco visível`, outline);
  await wait(1800);

  await page.mouse.move(40, 40);
  await area.scrollIntoViewIfNeeded();
  const box = await area.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: slow ? 25 : 1 });
  await dragOver(page, area);
  const over = await area.evaluate((el) => /over/.test(el.className));
  check(`${tag}: estado de arrasto`, over);
  await wait(2000);
  await area.dispatchEvent('dragleave');

  await page.getByLabel('Título').fill('Livro com PDF grande');
  await page.getByLabel('PDF (opcional)').setInputFiles({
    name: 'livro.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.alloc(PDF_BYTES, 1),
  });
  await wait(1000);
  const save = page.getByRole('button', { name: 'Salvar' });
  await save.scrollIntoViewIfNeeded();
  if (slow) {
    const sb = await save.boundingBox();
    await page.mouse.move(sb.x + sb.width / 2, sb.y + sb.height / 2, { steps: 25 });
    await pause(500);
  }
  await save.click();
  const bar = page.getByRole('progressbar', { name: 'Enviando o PDF' });
  let shown = true;
  try {
    await bar.waitFor({ timeout: 8000 });
  } catch {
    shown = false;
  }
  check(`${tag}: barra Enviando o PDF visível`, shown);
  check(`${tag}: Salvar com aria-busy`, (await save.getAttribute('aria-busy')) === 'true');
  check(
    `${tag}: sem rolagem horizontal`,
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
  );
  await axeCheck(page, `${tag}: durante o envio`);
  await wait(3500);
  gate.release();
  let notice = true;
  try {
    await page.getByText('Arquivo enviado.').waitFor({ timeout: 8000 });
  } catch {
    notice = false;
  }
  check(`${tag}: aviso Arquivo enviado.`, notice);
  check(`${tag}: sem erro de JS`, errors.length === 0, errors.join(' | '));
  await wait(2500);
}

async function main() {
  const target = process.argv[2];
  if (!target) {
    console.log('FALHA  uso: node apps/web/scripts/evidence-cover-upload.mjs <caminho.webm>');
    process.exit(1);
  }
  const out = resolve(target);
  mkdirSync(dirname(out), { recursive: true });
  const vite = await startVite();
  const browser = await chromium.launch();
  try {
    for (const size of ['desktop', 'mobile']) {
      for (const theme of THEMES) {
        const tag = `${SIZE_LABEL[size]} · ${THEME_LABEL[theme]}`;
        const { page, context, gate, errors } = await openPage(browser, { theme, size });
        try {
          await runFlow(page, gate, errors, tag, { base: vite.url, theme, slow: false });
        } catch (e) {
          check(`${tag}: cenário executou`, false, String(e.message).split('\n')[0]);
        } finally {
          gate.release();
          await context.close();
        }
      }
    }
    const tmp = mkdtempSync(join(tmpdir(), 'cover-upload-video-'));
    const { page, context, gate, errors } = await openPage(browser, {
      theme: 'light',
      size: 'desktop',
      video: tmp,
    });
    await installCursor(page);
    const video = page.video();
    try {
      await runFlow(page, gate, errors, 'vídeo', { base: vite.url, theme: 'light', slow: true });
      captures += 1;
    } catch (e) {
      check('vídeo: cenário executou', false, String(e.message).split('\n')[0]);
    } finally {
      gate.release();
      await context.close();
    }
    await video.saveAs(out);
    rmSync(tmp, { recursive: true, force: true });
    console.log(`video: ${out} (${String(captures)} capturas)`);
  } finally {
    await browser.close();
    await vite.stop();
  }
  console.log(failures === 0 ? 'ok  0 falha(s)' : `FALHA  ${String(failures)} falha(s)`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.log(`FALHA  ${String(e.message).split('\n')[0]}`);
  process.exit(1);
});
