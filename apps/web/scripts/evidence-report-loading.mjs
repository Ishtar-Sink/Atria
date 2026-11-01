// Evidência visual da TASK-22 (padrão de carregando na página de relatório), sem passo manual: sobe o
// Vite numa porta livre com uma página virtual que carrega src/features/reports/evidence/harness.tsx,
// simula a API no Chromium do Playwright e fotografa gerando, exportando, exportado e falha, nos
// temas claro e escuro, em 1280 px e em 360 px.
// Uso: node apps/web/scripts/evidence-report-loading.mjs <caminho.png>
// Imprime "ok" ou "FALHA" por verificação, o caminho do PNG e sai com código 1 se algo falhar.
import AxeBuilder from '@axe-core/playwright';
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createServer as createNetServer } from 'node:net';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer as createViteServer } from 'vite';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const PAGE_PATH = '/__evidence-report-loading';
const HARNESS = '/src/features/reports/evidence/harness.tsx';
const REPORT_URL = '/reports/fin-flow?period=custom&from=2026-10-01&to=2026-10-31&run=1';

const THEMES = ['light', 'dark'];
const SIZES = {
  desktop: { width: 1280, height: 800 },
  mobile: { width: 360, height: 760 },
};
const SIZE_LABEL = { desktop: 'desktop 1280', mobile: '360 px' };
const THEME_LABEL = { light: 'claro', dark: 'escuro' };

let failures = 0;
function check(name, cond, extra) {
  if (!cond) failures += 1;
  console.log(`${cond ? 'ok    ' : 'FALHA '} ${name}${extra ? ` · ${extra}` : ''}`);
}

// ---------- servidor de desenvolvimento ----------

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

/** Plugin que serve a página HTML virtual carregando o harness, sem arquivo novo no app. */
function evidencePage() {
  return {
    name: 'atria-evidence-report-loading-page',
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
    <title>Atria · evidência de carregando em Relatórios</title>
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

// ---------- API simulada ----------

const NOW = new Date('2026-11-05T15:00:00Z');
const USER = {
  id: '00000000-0000-4000-8000-000000000001',
  email: 'ana@atria.test',
  display_name: 'Ana Souza',
};
const uuid = (n) => `00000000-0000-4000-8000-0000000004${String(n).padStart(2, '0')}`;
const ACCOUNTS = [{ id: uuid(10), name: 'Conta corrente', owner_id: USER.id }];
const FIN_FLOW = {
  report: 'fin-flow',
  generated_on: '2026-11-05',
  filters: [],
  period: { from: '2026-10-01', to: '2026-10-31' },
  any_period: false,
  currency: 'BRL',
  totals: { income: 500000, expense: 200000, net: 300000 },
  months: [{ month: '2026-10', income: 500000, expense: 200000, net: 300000 }],
  accounts: [],
};

const json = (route, body, status = 200, contentType = 'application/json') =>
  route.fulfill({ status, contentType, body: JSON.stringify(body) });

/**
 * Instala a API simulada. `pdf`: "ok" ou "error". O relatório e o PDF (nos dois modos) só respondem
 * quando o script chama `releaseReport()` e `releasePdf()`.
 */
async function installApi(context, pdf, theme, unknown) {
  const gates = {};
  const gate = (key) =>
    new Promise((done) => {
      gates[key] = done;
    });
  const report = gate('report');
  const file = gate('pdf');
  await context.route(
    (url) => url.pathname.startsWith('/api/'),
    async (route) => {
      const url = new URL(route.request().url());
      const path = url.pathname.replace('/api/v1', '');
      if (route.request().method() === 'GET') {
        if (path === '/me') return json(route, USER);
        if (path === '/me/preferences') return json(route, { theme });
        if (path === '/accounts') return json(route, { items: ACCOUNTS, next_cursor: null });
        if (path === '/categories') return json(route, { items: [], next_cursor: null });
        if (path === '/reports/fin-flow' && url.searchParams.get('format') === 'pdf') {
          await file;
          if (pdf === 'error') {
            return json(route, { title: 'Erro', code: 'internal_error', status: 500 }, 500);
          }
          return route.fulfill({
            status: 200,
            contentType: 'application/pdf',
            headers: { 'Content-Disposition': 'attachment; filename="atria-fin-flow.pdf"' },
            body: '%PDF-1.4',
          });
        }
        if (path === '/reports/fin-flow') {
          await report;
          return json(route, FIN_FLOW);
        }
      }
      unknown.push(`${route.request().method()} ${path}`);
      return json(route, { title: 'Não simulada', code: 'not_found', status: 404 }, 404);
    },
  );
  return { releaseReport: gates.report, releasePdf: gates.pdf };
}

// ---------- captura ----------

async function openPage(browser, { theme, size, pdf }) {
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
  const api = await installApi(context, pdf, theme, unknown);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  return { page, context, errors, unknown, api };
}

const noOverflow = (page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

/** Verificações comuns a toda captura: tema, rolagem, erro de JS, API simulada e axe (inclui color-contrast). */
async function baseChecks(page, errors, unknown, tag, theme) {
  const applied = await page.evaluate(() => document.documentElement.dataset.theme);
  check(`${tag}: tema ${THEME_LABEL[theme]} aplicado`, applied === theme);
  check(`${tag}: sem rolagem horizontal`, await noOverflow(page));
  check(`${tag}: sem erro de JS`, errors.length === 0, errors.join(' | '));
  check(`${tag}: só chamadas simuladas à API`, unknown.length === 0, unknown.join(' | '));
  const axe = await new AxeBuilder({ page }).analyze();
  const bad = axe.violations.map(
    (v) => `${v.id}(${v.nodes.length}) ${v.nodes[0]?.target.join(' ') ?? ''}`,
  );
  check(`${tag}: axe sem violações (inclui color-contrast)`, bad.length === 0, bad.join(', '));
}

async function open(page, base) {
  await page.goto(`${base}${PAGE_PATH}?path=${encodeURIComponent(REPORT_URL)}`);
  await page.locator('h1').first().waitFor();
  await page.evaluate(() => document.fonts.ready);
}

const resultRegion = (page) => page.getByRole('region', { name: 'Resultado do relatório' });
const exportButton = (page) => page.getByRole('button', { name: /Exportar PDF|Exportando/ });

/** Gerando e exportando com sucesso: um contexto, quatro estados em sequência (os dois primeiros e o toast). */
async function flowOk(browser, base, theme, size, shots) {
  const { page, context, errors, unknown, api } = await openPage(browser, {
    theme,
    size,
    pdf: 'ok',
  });
  const where = `${SIZE_LABEL[size]} · ${THEME_LABEL[theme]}`;
  const shot = async (state, tag) => {
    await baseChecks(page, errors, unknown, tag, theme);
    shots.push({ size, label: `${state} · ${where}`, png: await page.screenshot() });
  };
  try {
    await open(page, base);
    let tag = `gerando · ${where}`;
    const region = resultRegion(page);
    await region.waitFor();
    check(`${tag}: resultado com aria-busy`, (await region.getAttribute('aria-busy')) === 'true');
    check(`${tag}: LoadingState visível`, await region.getByRole('status').isVisible());
    const generate = page.getByRole('button', { name: 'Gerar relatório' });
    check(
      `${tag}: Gerar relatório em carregando`,
      (await generate.getAttribute('aria-busy')) === 'true',
    );
    await shot('gerando', tag);

    api.releaseReport();
    await region.getByRole('heading', { name: /Entradas e saídas/ }).waitFor();
    check(
      `${tag}: resultado sem aria-busy depois de gerado`,
      !(await region.getAttribute('aria-busy')),
    );

    tag = `exportando · ${where}`;
    await exportButton(page).click();
    const busy = page.getByRole('button', { name: /Exportando/ });
    await busy.waitFor();
    check(`${tag}: Exportando… com aria-busy`, (await busy.getAttribute('aria-busy')) === 'true');
    check(
      `${tag}: indicador do botão visível`,
      await busy.locator('svg, [role="presentation"], span').first().isVisible(),
    );
    await shot('exportando', tag);

    tag = `exportado · ${where}`;
    api.releasePdf();
    const notice = page.getByText('PDF do relatório baixado.');
    await notice.waitFor();
    check(`${tag}: aviso PDF do relatório baixado.`, await notice.isVisible());
    check(`${tag}: sem alerta de erro`, (await page.getByRole('alert').count()) === 0);
    await shot('exportado', tag);
  } catch (e) {
    check(`fluxo de sucesso · ${where}: executou`, false, String(e.message).split('\n')[0]);
  } finally {
    api.releaseReport();
    api.releasePdf();
    await context.close();
  }
}

/** Falha do PDF: mensagem com role="alert" e o botão de novo disponível. */
async function flowError(browser, base, theme, size, shots) {
  const { page, context, errors, unknown, api } = await openPage(browser, {
    theme,
    size,
    pdf: 'error',
  });
  const where = `${SIZE_LABEL[size]} · ${THEME_LABEL[theme]}`;
  const tag = `falha · ${where}`;
  try {
    await open(page, base);
    api.releaseReport();
    await resultRegion(page)
      .getByRole('heading', { name: /Entradas e saídas/ })
      .waitFor();
    await exportButton(page).click();
    api.releasePdf();
    const alert = page.getByRole('alert').filter({ hasText: 'Não foi possível exportar' });
    await alert.waitFor();
    check(`${tag}: erro com role alert`, await alert.isVisible());
    const again = page.getByRole('button', { name: 'Exportar PDF' });
    check(`${tag}: Exportar PDF de novo disponível`, await again.isEnabled());
    check(
      `${tag}: sem aviso de sucesso`,
      (await page.getByText('PDF do relatório baixado.').count()) === 0,
    );
    await baseChecks(page, errors, unknown, tag, theme);
    shots.push({ size, label: tag, png: await page.screenshot() });
  } catch (e) {
    check(`${tag}: executou`, false, String(e.message).split('\n')[0]);
  } finally {
    api.releaseReport();
    api.releasePdf();
    await context.close();
  }
}

// ---------- prancha ----------

async function sheet(browser, { title, file, shots, scale }) {
  const figure = (s) => {
    const w = Math.round(SIZES[s.size].width * scale[s.size]);
    return `<figure style="width:${w}px"><img style="width:${w}px" src="data:image/png;base64,${s.png.toString('base64')}"><figcaption>${s.label}</figcaption></figure>`;
  };
  const html = `<!doctype html><meta charset="utf-8"><style>
    body{margin:0;padding:24px;background:#1b1b20;color:#e8e8ee;font:13px/1.4 system-ui,sans-serif}
    h1{font-size:18px;margin:0 0 16px}
    main{display:flex;flex-wrap:wrap;gap:20px;align-items:flex-start}
    figure{margin:0}
    img{display:block;border:1px solid #444;border-radius:4px}
    figcaption{margin-top:6px;color:#b8b8c4}
  </style><h1>${title}</h1><main>${shots.map(figure).join('')}</main>`;
  const context = await browser.newContext({ viewport: { width: 1480, height: 800 } });
  const page = await context.newPage();
  await page.setContent(html);
  await page.waitForFunction(() => [...document.images].every((i) => i.complete));
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, await page.screenshot({ fullPage: true }));
  await context.close();
  console.log(`png: ${file} (${shots.length} capturas)`);
}

// ---------- principal ----------

const target = process.argv[2];
if (!target) {
  console.error('Uso: node apps/web/scripts/evidence-report-loading.mjs <caminho.png>');
  process.exit(2);
}

let vite;
let browser;
try {
  vite = await startVite();
  console.log(`vite: ${vite.url} (porta livre, encerrado ao final)`);
  browser = await chromium.launch();
  const shots = [];
  for (const theme of THEMES) {
    for (const size of Object.keys(SIZES)) {
      await flowOk(browser, vite.url, theme, size, shots);
      await flowError(browser, vite.url, theme, size, shots);
    }
  }
  await sheet(browser, {
    title:
      'TASK-22 · relatório gerando, exportando, exportado e com falha, nos temas claro e escuro, 1280 px e 360 px (RF-24, CT-23)',
    file: resolve(target),
    shots,
    scale: { desktop: 0.42, mobile: 0.6 },
  });
} catch (e) {
  failures += 1;
  console.log(`FALHA  execução: ${e.message}`);
} finally {
  await browser?.close();
  if (vite) await vite.stop();
}
console.log(`\n${failures === 0 ? 'ok' : 'FALHA'}  ${failures} falha(s)`);
process.exit(failures === 0 ? 0 : 1);
