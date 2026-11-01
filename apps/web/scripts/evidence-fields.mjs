// Evidência visual do período no cabeçalho e do campo de etiquetas: sobe o Vite numa porta livre com
// uma página virtual que carrega o harness, confere as medidas no DOM, roda o axe e grava um PNG.
// Uso: node apps/web/scripts/evidence-fields.mjs <png>
// Imprime "ok" ou "FALHA" por conferência; sai com código 1 se algo falhar.
import AxeBuilder from '@axe-core/playwright';
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { createServer as createNetServer } from 'node:net';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = '/__evidence-fields';

const png = process.argv[2];
if (!png) {
  console.error('Uso: node apps/web/scripts/evidence-fields.mjs <png>');
  process.exit(2);
}

let failures = 0;
function check(name, cond, extra) {
  if (!cond) failures += 1;
  console.log(`${cond ? 'ok    ' : 'FALHA '} ${name}${extra ? ` · ${extra}` : ''}`);
}

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
    <title>Atria · evidência dos campos</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/app/dev/fields-harness.tsx"></script>
  </body>
</html>`;

/** Serve a página HTML virtual que carrega o harness; nada é gravado no projeto. */
function virtualPage() {
  return {
    name: 'evidence-fields-page',
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

async function startVite() {
  const port = await freePort();
  const server = await createServer({
    root: WEB,
    logLevel: 'error',
    plugins: [virtualPage()],
    server: { port, strictPort: true, host: '127.0.0.1', proxy: {} },
  });
  await server.listen();
  return { url: `http://127.0.0.1:${port}`, stop: () => server.close() };
}

let vite;
let browser;
try {
  vite = await startVite();
  console.log(`vite: ${vite.url} (porta livre, encerrado ao final)`);
  browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: 'reduce',
    locale: 'pt-BR',
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${vite.url}${PAGE}`);
  await page.waitForSelector('html[data-evidence-ready="true"]', { timeout: 15000 });
  const checks = await page.evaluate(() => window.__atria_fields_evidence ?? []);
  check('conferências publicadas pelo harness', checks.length > 0);
  for (const c of checks) check(c.name, c.ok, c.detail);
  check('sem erro de JavaScript', errors.length === 0, errors.join(' | '));
  const result = await new AxeBuilder({ page }).analyze();
  check(
    'axe sem violações',
    result.violations.length === 0,
    result.violations
      .map(
        (v) =>
          `${v.id} (${v.nodes.length}): ${v.nodes.map((n) => n.html.slice(0, 140)).join(' ; ')}`,
      )
      .join(', '),
  );
  const out = resolve(png);
  mkdirSync(dirname(out), { recursive: true });
  await page.screenshot({ path: out, fullPage: true, animations: 'disabled' });
  console.log(`png: ${out}`);
  await context.close();
} catch (e) {
  failures += 1;
  console.log(`FALHA  execução: ${e.message}`);
} finally {
  await browser?.close();
  if (vite) await vite.stop();
}
console.log(`\n${failures === 0 ? 'ok' : 'FALHA'}  ${failures} falha(s)`);
process.exit(failures === 0 ? 0 : 1);
