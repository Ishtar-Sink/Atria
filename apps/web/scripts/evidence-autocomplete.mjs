// Vídeo do autocomplete da @atria/ui pelo teclado e pelo mouse: sobe o Vite com a página virtual do
// harness (`?cena=video`), grava o Chromium em 1280x800 com o marcador de cursor e confere cada passo.
// Uso: node apps/web/scripts/evidence-autocomplete.mjs <webm>
// Imprime "ok" ou "FALHA" por passo, a linha "video:" e o resumo; sai com código 1 se algo falhar.
import AxeBuilder from '@axe-core/playwright';
import { chromium } from '@playwright/test';
import { mkdirSync, rmSync } from 'node:fs';
import { createServer as createNetServer } from 'node:net';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = '/__evidence-autocomplete';
const HARNESS = 'src/app/dev/autocomplete-harness.tsx';

const [webm] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
if (!webm) {
  console.log('Uso: node apps/web/scripts/evidence-autocomplete.mjs <webm>');
  process.exit(2);
}

let failures = 0;
function check(name, cond, extra) {
  if (!cond) failures += 1;
  console.log(`${cond ? 'ok    ' : 'FALHA '} ${name}${extra ? ` · ${extra}` : ''}`);
}

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
    <title>Atria · vídeo do autocomplete</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/${HARNESS}"></script>
  </body>
</html>`;

function virtualPage() {
  return {
    name: 'evidence-autocomplete-page',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith(PAGE)) return next();
        const html = await server.transformIndexHtml(req.url, PAGE_HTML);
        res.setHeader('Content-Type', 'text/html');
        res.end(html);
      });
    },
  };
}

/** Marcador do cursor no vídeo: o Playwright não desenha o ponteiro, então mostramos o `cursor` computado. */
const CURSOR_MARKER = () => {
  const dot = document.createElement('div');
  dot.dataset.cursorMarker = '';
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

const target = resolve(webm);
const tmp = join(dirname(target), 'video-tmp');
const size = { width: 1280, height: 800 };
let browser;
let vite;
let context;
let video;
try {
  mkdirSync(dirname(target), { recursive: true });
  const port = await freePort();
  vite = await createServer({
    root: WEB,
    logLevel: 'error',
    plugins: [virtualPage()],
    server: { port, strictPort: true, host: '127.0.0.1', proxy: {} },
  });
  await vite.listen();

  browser = await chromium.launch();
  context = await browser.newContext({
    viewport: size,
    recordVideo: { dir: tmp, size },
    colorScheme: 'light',
  });
  await context.addInitScript(CURSOR_MARKER);
  const page = await context.newPage();
  video = page.video();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const pause = (ms) => page.waitForTimeout(ms);
  const goTo = async (locator) => {
    const box = await locator.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 15 });
  };
  const optionNames = async () => page.getByRole('option').allTextContents();

  await page.goto(`http://127.0.0.1:${port}${PAGE}?cena=video`);
  await page.waitForSelector('html[data-evidence-ready="true"]', { timeout: 15_000 });
  const items = await page.evaluate(() => window.__atria_evidence ?? []);
  for (const item of items) check(item.name, item.ok, item.detail);
  await page.mouse.move(640, 700);
  await pause(1000);

  const single = page.getByRole('combobox', { name: 'Categoria', exact: true });
  const multiple = page.getByRole('combobox', { name: 'Categorias', exact: true });
  const singleOut = page.locator('output[data-value="single"]');
  const multipleOut = page.locator('output[data-value="multiple"]');

  // 1. Clicar no campo abre a lista com todas as opções.
  await goTo(single);
  await pause(600);
  await single.click();
  await pause(1200);
  check('lista aberta com as seis opções', (await page.getByRole('option').count()) === 6);

  // 2. Digitar filtra a lista.
  await single.pressSequentially('sa', { delay: 180 });
  await pause(1000);
  const filtered = await optionNames();
  check('lista filtra por "sa": Saúde', filtered.length === 1 && filtered[0] === 'Saúde');
  const axe = await new AxeBuilder({ page }).exclude('[data-cursor-marker]').analyze();
  check(
    'axe sem violações com a lista aberta',
    axe.violations.length === 0,
    axe.violations.map((v) => v.id).join(', '),
  );

  // 3. Setas e Enter escolhem.
  await page.keyboard.press('Control+A');
  await page.keyboard.type('m', { delay: 180 });
  await pause(800);
  await page.keyboard.press('ArrowDown');
  await pause(800);
  await page.keyboard.press('Enter');
  await pause(1200);
  check(
    'setas e Enter escolhem Mercado',
    (await singleOut.textContent()) === 'Valor: mercado' &&
      (await page.getByRole('listbox').count()) === 0,
    await singleOut.textContent(),
  );

  // 4. Sem resultado e Esc.
  await single.click();
  await pause(800);
  await single.pressSequentially('xyz', { delay: 180 });
  await pause(1200);
  check(
    'sem resultado mostra "Nenhuma categoria encontrada"',
    (await page.locator('p[role="status"]').textContent()) === 'Nenhuma categoria encontrada',
  );
  await page.keyboard.press('Escape');
  await pause(1200);
  check(
    'Esc fecha e mantém Mercado',
    (await single.inputValue()) === 'Mercado' &&
      (await singleOut.textContent()) === 'Valor: mercado' &&
      (await page.getByRole('listbox').count()) === 0,
  );

  // 5. Seleção múltipla.
  await goTo(multiple);
  await pause(600);
  await multiple.click();
  await pause(800);
  await multiple.pressSequentially('la', { delay: 180 });
  await page.keyboard.press('Enter');
  await pause(900);
  await multiple.pressSequentially('tra', { delay: 180 });
  await page.keyboard.press('Enter');
  await pause(1200);
  check(
    'duas opções escolhidas',
    (await multipleOut.textContent()) === 'Valores: lazer, transporte',
    await multipleOut.textContent(),
  );
  // A lista aberta cobre as pílulas: o Esc a fecha antes de usar o ×.
  await page.keyboard.press('Escape');
  await pause(800);
  await goTo(page.getByRole('button', { name: 'Remover Lazer' }));
  await pause(600);
  await page.getByRole('button', { name: 'Remover Lazer' }).click();
  await pause(1200);
  check('remove pelo ×', (await multipleOut.textContent()) === 'Valores: transporte');
  await goTo(multiple);
  await multiple.click();
  await pause(800);
  await page.keyboard.press('Backspace');
  await pause(1200);
  check(
    'remove a última pelo teclado',
    (await multipleOut.textContent()) === 'Valores: ',
    await multipleOut.textContent(),
  );
  await page.keyboard.press('Tab');
  await pause(1200);
  check('Tab fecha a lista', (await page.getByRole('listbox').count()) === 0);
  check('sem erro de JavaScript', errors.length === 0, errors.join(' | '));
  await pause(800);
} catch (error) {
  failures += 1;
  console.log(`FALHA  ${error instanceof Error ? error.message : String(error)}`);
} finally {
  await context?.close();
  if (video) {
    await video.saveAs(target);
    console.log(`video: ${target}`);
  }
  rmSync(tmp, { recursive: true, force: true });
  await browser?.close();
  await vite?.close();
}
console.log(failures === 0 ? 'ok  0 falha(s)' : `FALHA  ${failures} falha(s)`);
process.exit(failures === 0 ? 0 : 1);
