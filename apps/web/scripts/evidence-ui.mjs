// Print de componentes da @atria/ui por harness: sobe o Vite numa porta livre com uma página virtual
// que carrega o harness, lê as conferências que ele publica, roda o axe e grava o PNG.
// Uso: node apps/web/scripts/evidence-ui.mjs <harness relativo a apps/web> <png> [--width=1280] [--query=chave=valor]
// Imprime "ok" ou "FALHA" por verificação e o caminho do PNG; sai com código 1 se algo falhar.
import AxeBuilder from '@axe-core/playwright';
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { createServer as createNetServer } from 'node:net';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = '/__evidence-ui';

const args = process.argv.slice(2);
const flags = args.filter((a) => a.startsWith('--'));
const [harness, png] = args.filter((a) => !a.startsWith('--'));
if (!harness || !png) {
  console.log(
    'Uso: node apps/web/scripts/evidence-ui.mjs <harness relativo a apps/web> <png> [--width=1280] [--query=chave=valor]',
  );
  process.exit(2);
}
const flag = (name) => flags.find((f) => f.startsWith(`--${name}=`))?.slice(name.length + 3);
const width = Number(flag('width') ?? 1280);
const query = flags
  .filter((f) => f.startsWith('--query='))
  .map((f) => f.slice('--query='.length))
  .join('&');

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
    <title>Atria · evidência de interface</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/${harness.replace(/^\//, '')}"></script>
  </body>
</html>`;

/** Serve a página HTML virtual que carrega o harness; nada é gravado no projeto. */
function virtualPage() {
  return {
    name: 'evidence-ui-page',
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

let browser;
let vite;
try {
  const port = await freePort();
  vite = await createServer({
    root: WEB,
    logLevel: 'error',
    plugins: [virtualPage()],
    server: { port, strictPort: true, host: '127.0.0.1', proxy: {} },
  });
  await vite.listen();

  browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`http://127.0.0.1:${port}${PAGE}${query ? `?${query}` : ''}`);
  await page.waitForSelector('html[data-evidence-ready="true"]', { timeout: 15_000 });

  const items = await page.evaluate(() => window.__atria_evidence ?? []);
  check('o harness publicou conferências', items.length > 0);
  for (const item of items) check(item.name, item.ok, item.detail);

  check('sem erro de JavaScript', errors.length === 0, errors.join(' | '));
  const result = await new AxeBuilder({ page }).analyze();
  check(
    'axe sem violações',
    result.violations.length === 0,
    result.violations.map((v) => v.id).join(', '),
  );

  const target = resolve(png);
  mkdirSync(dirname(target), { recursive: true });
  await page.screenshot({ path: target, fullPage: true, animations: 'disabled' });
  console.log(`png: ${target}`);
  console.log(failures === 0 ? 'ok  0 falha(s)' : `FALHA  ${failures} falha(s)`);
} catch (error) {
  failures += 1;
  console.log(`FALHA  ${error instanceof Error ? error.message : String(error)}`);
} finally {
  await browser?.close();
  await vite?.close();
}
process.exit(failures === 0 ? 0 : 1);
