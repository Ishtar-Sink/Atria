// Evidência visual da TASK-24 (SPEC-002): os cinco diálogos do app sobre o `Dialog` genérico da
// `@atria/ui` têm o mesmo espaçamento do protótipo (RF-30, CT-29). Sem passo manual: sobe o Vite numa
// porta livre com a página virtual `/__evidence/<feature>` (finance, projects, library, reader e
// journal), simula a API de cada feature no navegador, abre cada diálogo nos dois temas, a 1280 px e a
// 360 px, mede o espaçamento, confere o axe e monta a prancha rotulada.
// Uso: node apps/web/scripts/evidence-dialogs.mjs <caminho.png>
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
const OUT = process.argv[2] ? resolve(process.argv[2]) : '';

const THEMES = ['light', 'dark'];
const SIZES = {
  desktop: { width: 1280, height: 800 },
  mobile: { width: 360, height: 760 },
};
const SIZE_LABEL = { desktop: '1280 px', mobile: '360 px' };
const THEME_LABEL = { light: 'claro', dark: 'escuro' };
const ZONE = 'America/Sao_Paulo';
const HARNESS = '/__evidence/';

let failures = 0;
function check(name, cond, extra) {
  if (!cond) failures += 1;
  console.log(`${cond ? 'ok    ' : 'FALHA '} ${name}${extra ? ` · ${extra}` : ''}`);
}

// ---------- PDF de exemplo (leitor), montado em bytes ----------

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

const pageHtml = (feature) => `<!doctype html>
<html lang="pt-BR" data-theme="light">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light dark" />
    <title>Atria · evidência dos diálogos</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/features/${feature}/evidence/harness.tsx"></script>
  </body>
</html>`;

/** Serve a página virtual `/__evidence/<feature>`; o app em si não muda. */
const evidencePage = {
  name: 'atria-evidence-page',
  configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      if (!req.url?.startsWith(HARNESS)) return next();
      const feature = req.url.slice(HARNESS.length).split(/[?#]/)[0];
      const html = await server.transformIndexHtml(req.url, pageHtml(feature));
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

// ---------- API simulada (fixtures em memória, por feature) ----------

const U = 'u1';
const STAMP = { created_at: '2026-11-01T10:00:00Z', updated_at: '2026-11-02T10:00:00Z' };
const items = (list) => ({ items: list, next_cursor: null });
const problem = (status, code) => ({ status, body: { title: code, status, code } });

const FINANCE = {
  accounts: [
    {
      id: 'a1',
      name: 'Conta principal',
      kind: 'standard',
      balance_amount: 250000,
      currency: 'BRL',
      is_default: true,
      owner_id: U,
      visibility: 'personal',
      credit_limit_amount: null,
      closing_day: null,
      due_day: null,
      ...STAMP,
    },
    {
      id: 'a2',
      name: 'Carteira',
      kind: 'standard',
      balance_amount: 12000,
      currency: 'BRL',
      is_default: false,
      owner_id: U,
      visibility: 'personal',
      credit_limit_amount: null,
      closing_day: null,
      due_day: null,
      ...STAMP,
    },
  ],
};

const LANE = (id, system_key, name, color, position, counts_as_done = false) => ({
  id,
  owner_id: U,
  project_id: 'p-obra',
  system_key,
  name,
  color,
  counts_as_done,
  position,
  visibility: 'personal',
  ...STAMP,
});
const PROGRESS = { done_cards: 0, total_cards: 2 };
const PROJECTS = {
  project: {
    id: 'p-obra',
    owner_id: U,
    name: 'Reforma da sala',
    description: 'Pintura, luz e móveis da sala de estar.',
    visibility: 'personal',
    progress: PROGRESS,
    ...STAMP,
  },
  lanes: [
    LANE('l-wait', 'waiting', null, '#92400e', 0),
    LANE('l-doing', 'in_progress', null, '#6d28d9', 1),
    LANE('l-done', 'done', null, '#047857', 2, true),
  ],
  cards: ['Escolher a tinta', 'Comprar luminária'].map((title, position) => ({
    id: `c-${position}`,
    owner_id: U,
    project_id: 'p-obra',
    lane_id: 'l-wait',
    title,
    description: null,
    priority: null,
    labels: [],
    due_date: null,
    checklist: [],
    position,
    visibility: 'personal',
    ...STAMP,
  })),
};

const BOOK = '0b6f7d52-3c1e-4a50-9f7b-1d2a8e4c5a01';
const FILE_OK = '9a1c5e07-2b4d-4f86-a3c1-5d7e9b0f2a11';
const EMOTIONS = [
  ['e0000001-0000-4000-8000-000000000001', 'joy'],
  ['e0000001-0000-4000-8000-000000000002', 'sadness'],
  ['e0000001-0000-4000-8000-000000000006', 'calm'],
].map(([id, system_key]) => ({
  id,
  name: null,
  system_key,
  owner_id: U,
  visibility: 'personal',
  ...STAMP,
}));

/** Resposta de cada feature; o que não está aqui vira lista vazia (GET) ou 404. */
function handle(feature, method, path, url, state) {
  if (path === '/me')
    return { body: { id: U, email: 'ana@exemplo.com', display_name: 'Ana Souza' } };
  if (path === '/me/preferences') return { body: {} };
  if (path === '/search') return { body: { groups: [] } };
  if (feature === 'finance') {
    if (method === 'GET' && path === '/accounts') return { body: items(FINANCE.accounts) };
    const account = path.match(/^\/accounts\/([^/]+)$/);
    if (account && method === 'GET') {
      const found = FINANCE.accounts.find((a) => a.id === account[1]);
      return found ? { body: found } : problem(404, 'not_found');
    }
    if (account && method === 'DELETE') return problem(409, 'account_has_transactions');
  }
  if (feature === 'projects') {
    if (path === '/projects' && method === 'GET') return { body: items([PROJECTS.project]) };
    if (path === '/projects/p-obra' && method === 'GET') return { body: PROJECTS.project };
    if (path === '/projects/p-obra/summary') {
      return { body: { progress: PROGRESS, lanes: [], upcoming_due: [], in_progress: [] } };
    }
    if (path === '/projects/p-obra/lanes') return { body: items(PROJECTS.lanes) };
    if (path === '/projects/p-obra/cards') return { body: items(PROJECTS.cards) };
  }
  if (feature === 'reader') {
    if (path === `/files/${FILE_OK}`) return { pdf: true };
    if (path === `/books/${BOOK}` && method === 'GET') {
      return {
        body: {
          id: BOOK,
          owner_id: U,
          title: 'Dom Casmurro',
          author: 'Machado de Assis',
          page_count: PAGE_COUNT,
          reading_status: 'reading',
          pdf_file_id: FILE_OK,
          tags: [],
          visibility: 'personal',
          created_at: '2026-10-01T10:00:00Z',
          updated_at: '2026-10-26T18:00:00Z',
        },
      };
    }
    if (path === `/books/${BOOK}/reading-position`) {
      return { body: { page: state.position } };
    }
    if (path === `/books/${BOOK}/highlights`) return { body: items([]) };
  }
  if (feature === 'journal' && path === '/emotions' && method === 'GET') {
    return { body: items(EMOTIONS) };
  }
  void url;
  return method === 'GET' ? { body: items([]) } : problem(404, 'not_found');
}

async function installApi(context, feature) {
  const state = { position: OPEN_PAGE };
  await context.route(
    (url) => url.pathname.startsWith('/api/'),
    async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const path = url.pathname.replace('/api/v1', '');
      if (request.method() === 'PUT' && path.endsWith('/reading-position')) {
        state.position = request.postDataJSON().page;
      }
      const reply = handle(feature, request.method(), path, url, state);
      if (reply.pdf) {
        return route.fulfill({ status: 200, contentType: 'application/pdf', body: PDF_OK });
      }
      const status = reply.status ?? 200;
      return route.fulfill({
        status,
        contentType: status >= 400 ? 'application/problem+json' : 'application/json',
        body: JSON.stringify(reply.body),
      });
    },
  );
}

// ---------- captura e medidas ----------

async function openPage(browser, { theme, size, feature }) {
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
  await installApi(context, feature);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  return { page, context, errors };
}

async function gotoApp(page, base, feature, path) {
  await page.goto(`${base}${HARNESS}${feature}?path=${encodeURIComponent(path)}`);
  // O leitor ocupa a tela toda, fora do layout com `main#conteudo`.
  if (feature !== 'reader') await page.locator('main#conteudo').waitFor();
  await page.evaluate(() => document.fonts.ready);
}

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
      return ink > 50 && el.querySelector('span') !== null;
    },
    n,
    { timeout: 20000 },
  );
}

/** Medidas do diálogo aberto, em px; `--sN` resolvido pelo próprio navegador. */
function measure(page) {
  return page.evaluate(() => {
    const dialog = document.querySelector('dialog[open]');
    if (!dialog) return null;
    const px = (token) => {
      const probe = document.createElement('div');
      probe.style.paddingTop = `var(${token})`;
      document.body.append(probe);
      const value = parseFloat(getComputedStyle(probe).paddingTop);
      probe.remove();
      return value;
    };
    const inner = dialog.firstElementChild;
    const title = dialog.querySelector('h2');
    const body = dialog.querySelector('[data-dialog-body]');
    const actions = dialog.querySelector('[data-dialog-actions]');
    const buttons = [...actions.querySelectorAll('button')];
    const rect = dialog.getBoundingClientRect();
    const inner_style = getComputedStyle(inner);
    const last = buttons[buttons.length - 1].getBoundingClientRect();
    return {
      s2: px('--s2'),
      s4: px('--s4'),
      s6: px('--s6'),
      padding: [
        inner_style.paddingTop,
        inner_style.paddingRight,
        inner_style.paddingBottom,
        inner_style.paddingLeft,
      ].map(parseFloat),
      title_margin: parseFloat(getComputedStyle(title).marginBottom),
      body_gap: actions.getBoundingClientRect().top - body.getBoundingClientRect().bottom,
      right_gap:
        inner.getBoundingClientRect().right -
        inner_style.paddingRight.replace('px', '') -
        last.right,
      justify: getComputedStyle(actions).justifyContent,
      box: [rect.left, rect.top, rect.right, rect.bottom],
      view: [innerWidth, innerHeight],
    };
  });
}

async function checkDialog(page, errors, tag, theme, confirm_metrics) {
  const m = await measure(page);
  check(`${tag}: diálogo aberto`, m !== null);
  if (!m) return null;
  const same = (a, b) => Math.abs(a - b) < 0.6;
  check(
    `${tag}: padding igual a --s6`,
    m.padding.every((v) => same(v, m.s6)),
    `${m.padding.join('/')} px, --s6 ${m.s6} px`,
  );
  check(
    `${tag}: corpo até as ações igual a --s4`,
    same(m.body_gap, m.s4),
    `${m.body_gap} px, --s4 ${m.s4} px`,
  );
  check(
    `${tag}: margem do título igual a --s2`,
    same(m.title_margin, m.s2),
    `${m.title_margin} px, --s2 ${m.s2} px`,
  );
  check(
    `${tag}: ações à direita`,
    m.justify === 'flex-end' && m.right_gap >= -0.6 && m.right_gap < 1,
    `${m.justify}, folga ${m.right_gap.toFixed(1)} px`,
  );
  if (confirm_metrics) {
    check(
      `${tag}: igual ao ConfirmDialog`,
      same(m.padding[0], confirm_metrics.padding[0]) &&
        same(m.title_margin, confirm_metrics.title_margin) &&
        same(m.body_gap, confirm_metrics.body_gap),
      `padding ${m.padding[0]}/${confirm_metrics.padding[0]}, título ${m.title_margin}/${confirm_metrics.title_margin}, corpo ${m.body_gap}/${confirm_metrics.body_gap}`,
    );
  }
  const [l, t, r, b] = m.box;
  check(
    `${tag}: dentro da janela a 360 px`,
    l >= -0.5 && t >= -0.5 && r <= m.view[0] + 0.5 && b <= m.view[1] + 0.5,
    `caixa ${[l, t, r, b].map(Math.round).join(',')} em ${m.view.join('x')}`,
  );
  const current = await page.evaluate(() => document.documentElement.dataset.theme);
  check(`${tag}: tema ${THEME_LABEL[theme]} aplicado`, current === theme);
  check(`${tag}: sem erro de JS`, errors.length === 0, errors.join(' | '));
  const result = await new AxeBuilder({ page }).analyze();
  const summary = result.violations
    .map(
      (v) =>
        `${v.id} (${v.nodes
          .slice(0, 2)
          .map((n) => `${n.target.join(' ')} ${(n.any[0]?.message ?? '').slice(0, 140)}`)
          .join('; ')})`,
    )
    .join(' | ');
  check(
    `${tag}: axe sem violações (inclui color-contrast)`,
    result.violations.length === 0,
    summary,
  );
  return m;
}

// ---------- cenários: um por diálogo ----------

const PDF_OK = makePdf(PAGE_COUNT);

const SCENARIOS = [
  {
    name: 'Confirmação (Diário)',
    feature: 'journal',
    path: '/journal/emotions',
    open: async (page) => {
      await page.getByRole('button', { name: 'Remover Alegria' }).click();
      await page.getByRole('alertdialog', { name: 'Remover esta emoção?' }).waitFor();
    },
  },
  {
    name: 'Conta com movimentações (Financeiro)',
    feature: 'finance',
    path: '/finance/accounts/a2',
    open: async (page) => {
      await page.getByRole('heading', { level: 1, name: 'Carteira' }).waitFor();
      await page.getByRole('button', { name: 'Mais ações' }).click();
      await page.getByRole('menuitem', { name: 'Excluir' }).click();
      await page.getByRole('alertdialog').getByRole('button', { name: 'Excluir' }).click();
      await page.getByRole('alertdialog', { name: 'Esta conta tem movimentações' }).waitFor();
    },
  },
  {
    name: 'Excluir raia com cartões (Projetos)',
    feature: 'projects',
    path: '/projects/p-obra?tab=settings',
    open: async (page) => {
      await page.getByRole('button', { name: 'Excluir Aguardando' }).click();
      await page.getByRole('alertdialog').waitFor();
    },
  },
  {
    name: 'Criar no Acervo (Biblioteca)',
    feature: 'library',
    path: '/library?tab=articles',
    open: async (page) => {
      await page.getByRole('button', { name: 'Novo', exact: true }).click();
      await page.getByRole('dialog').waitFor();
    },
  },
  {
    name: 'Registrar a sessão de leitura (Leitor)',
    feature: 'reader',
    path: `/library/books/${BOOK}/read`,
    open: async (page) => {
      await waitPageDrawn(page, OPEN_PAGE);
      const input = page.getByLabel('Página atual');
      await input.fill(String(CLOSE_PAGE));
      await input.press('Enter');
      await page.waitForFunction(
        (n) => document.querySelector('input[inputmode="numeric"]')?.value === String(n),
        CLOSE_PAGE,
      );
      await page.getByRole('button', { name: /Fechar leitor/ }).click();
      await page.getByRole('dialog', { name: 'Registrar esta sessão de leitura?' }).waitFor();
    },
  },
];

// ---------- prancha ----------

async function sheet(browser, shots) {
  const figure = (s) => {
    const w = Math.round(SIZES[s.size].width * (s.size === 'desktop' ? 0.4 : 0.55));
    return `<figure style="width:${w}px"><img style="width:${w}px" src="data:image/png;base64,${s.png.toString('base64')}"><figcaption>${s.label}</figcaption></figure>`;
  };
  const rows = [];
  for (const s of shots) {
    const last = rows[rows.length - 1];
    if (last?.row === s.row) last.items.push(s);
    else rows.push({ row: s.row, items: [s] });
  }
  const html = `<!doctype html><meta charset="utf-8"><style>
    body{margin:0;padding:24px;background:#1b1b20;color:#e8e8ee;font:13px/1.4 system-ui,sans-serif}
    h1{font-size:18px;margin:0 0 16px}
    main{display:flex;flex-direction:column;gap:24px}
    figure{margin:0}
    .row{display:flex;gap:20px;align-items:flex-start}
    img{display:block;border:1px solid #444;border-radius:4px}
    figcaption{margin-top:6px;color:#b8b8c4}
  </style><h1>Diálogos do app sobre o Dialog genérico (RF-30)</h1><main>${rows
    .map((r) => `<div class="row">${r.items.map(figure).join('')}</div>`)
    .join('')}</main>`;
  const context = await browser.newContext({ viewport: { width: 1180, height: 800 } });
  const page = await context.newPage();
  await page.setContent(html);
  await page.waitForFunction(() => [...document.images].every((i) => i.complete));
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, await page.screenshot({ fullPage: true }));
  await context.close();
  console.log(`png: ${OUT} (${shots.length} capturas)`);
}

// ---------- principal ----------

async function main() {
  if (!OUT) {
    console.error('uso: node apps/web/scripts/evidence-dialogs.mjs <caminho.png>');
    process.exit(2);
  }
  const vite = await startVite();
  const browser = await chromium.launch();
  const shots = [];
  try {
    for (const size of Object.keys(SIZES)) {
      for (const theme of THEMES) {
        let confirm_metrics = null;
        for (const sc of SCENARIOS.filter(
          (x) => !process.env.ONLY || x.feature === process.env.ONLY,
        )) {
          const tag = `${sc.name} · ${SIZE_LABEL[size]} · ${THEME_LABEL[theme]}`;
          const { page, context, errors } = await openPage(browser, {
            theme,
            size,
            feature: sc.feature,
          });
          try {
            await gotoApp(page, vite.url, sc.feature, sc.path);
            await sc.open(page);
            await page.waitForTimeout(150);
            await page.mouse.move(0, 0);
            const m = await checkDialog(page, errors, tag, theme, confirm_metrics);
            if (sc.feature === 'journal') confirm_metrics = m;
            shots.push({
              row: `${size}-${theme}`,
              size,
              label: tag,
              png: await page.screenshot(),
            });
          } catch (e) {
            check(`${tag}: cenário executou`, false, String(e.message).split('\n')[0]);
            if (process.env.ONLY)
              await page.screenshot({
                path: '/tmp/claude-1000/-home-victor-projetos-ishtar-sink-atria/e83331c8-146c-4bcc-b5a0-5c49ad795808/scratchpad/task-24/dbg.png',
              });
          } finally {
            await context.close();
          }
        }
      }
    }
    if (shots.length > 0) await sheet(browser, shots);
  } finally {
    await browser.close();
    await vite.stop();
  }
  console.log(`${failures === 0 ? 'ok ' : 'FALHA'} ${failures} falha(s)`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
