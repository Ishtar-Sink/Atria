// Evidências visuais da TASK-31 (aba Conexões e tela de ligar), sem passo manual: sobe o Vite numa porta livre
// (API `createServer`), serve uma página virtual que carrega `src/features/connections/evidence/harness.tsx`
// (as rotas da feature e a aba Conexões de uma nota num roteador em memória, com os providers e o layout do app), simula a API no
// navegador com fixtures em memória, confere o estado no DOM antes de cada captura e monta a prancha
// (PNG) em vostok/work/tasks/SPEC-001/evidence/TASK-31/.
// Uso: node apps/web/scripts/evidence-connections.mjs temas|estados
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
const OUT = join(ROOT, 'vostok', 'work', 'tasks', 'SPEC-001', 'evidence', 'TASK-31');

const THEMES = ['light', 'dark'];
const SIZES = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 360, height: 760 },
};
const TALL = { desktop: 1100, mobile: 1100 };
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
    <title>Atria · evidência das conexões</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/features/connections/evidence/harness.tsx"></script>
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

const NOTE_ID = '0b6f7d52-3c1e-4a50-9f7b-1d2a8e4c5a01';
const PROJECT_ID = 'c4d1e7a2-5b36-4f08-9a1d-6e2b8c3f7a10';
const ids = {
  goal: '11111111-aaaa-4a01-8a01-000000000001',
  task: '11111111-aaaa-4a01-8a01-000000000002',
  book: '11111111-aaaa-4a01-8a01-000000000003',
  reminder: '11111111-aaaa-4a01-8a01-000000000004',
  transaction: '11111111-aaaa-4a01-8a01-000000000005',
  transfer: '11111111-aaaa-4a01-8a01-000000000006',
  journal_entry: '11111111-aaaa-4a01-8a01-000000000007',
  project_card: '11111111-aaaa-4a01-8a01-000000000008',
  project: '11111111-aaaa-4a01-8a01-000000000009',
  note: '11111111-aaaa-4a01-8a01-000000000010',
  other_goal: '11111111-aaaa-4a01-8a01-000000000011',
  other_book: '11111111-aaaa-4a01-8a01-000000000012',
};

/** Detalhes devolvidos pelos `GET` por id de cada tipo ligável (só os campos que a tela lê). */
const DETAILS = {
  goal: { id: ids.goal, title: 'Viajar para Lisboa em janeiro' },
  task: { id: ids.task, title: 'Comprar as passagens de trem' },
  book: { id: ids.book, title: 'Guia de Portugal' },
  reminder: { id: ids.reminder, title: 'Renovar o passaporte' },
  transaction: { id: ids.transaction, description: 'Hospedagem em Lisboa' },
  journal_entry: { id: ids.journal_entry, occurred_at: '2026-10-18T21:00:00Z' },
  project_card: {
    id: ids.project_card,
    title: 'Roteiro dos três primeiros dias',
    project_id: PROJECT_ID,
  },
  project: { id: ids.project, name: 'Viagem de janeiro' },
  note: { id: ids.note, title: 'Receita do pão de casa' },
  other_goal: { id: ids.other_goal, title: 'Aprender português europeu' },
  other_book: { id: ids.other_book, title: 'Mapa afetivo de Lisboa' },
};

const DETAIL_PATHS = {
  goal: (id) => `/goals/${id}`,
  task: (id) => `/tasks/${id}`,
  book: (id) => `/books/${id}`,
  reminder: (id) => `/reminders/${id}`,
  transaction: (id) => `/transactions/${id}`,
  journal_entry: (id) => `/journal-entries/${id}`,
  project_card: (id) => `/cards/${id}`,
  project: (id) => `/projects/${id}`,
  note: (id) => `/notes/${id}`,
};

/** Ligações da nota (data de criação decrescente); metade tem a nota como origem, metade como destino. */
function linkFixtures() {
  const make = (n, type, id, note_is_source, created_at) => ({
    id: `22222222-bbbb-4b02-8b02-${String(n).padStart(12, '0')}`,
    owner_id: 'u1',
    source_type: note_is_source ? 'note' : type,
    source_id: note_is_source ? NOTE_ID : id,
    target_type: note_is_source ? type : 'note',
    target_id: note_is_source ? id : NOTE_ID,
    visibility: 'personal',
    created_at,
    updated_at: created_at,
  });
  return [
    make(1, 'goal', ids.goal, true, '2026-11-04T10:00:00Z'),
    make(2, 'task', ids.task, false, '2026-11-03T09:00:00Z'),
    make(3, 'book', ids.book, true, '2026-11-02T18:00:00Z'),
    make(4, 'reminder', ids.reminder, false, '2026-10-29T12:00:00Z'),
    make(5, 'transaction', ids.transaction, true, '2026-10-28T08:00:00Z'),
    make(6, 'transfer', ids.transfer, true, '2026-10-27T08:00:00Z'),
    make(7, 'journal_entry', ids.journal_entry, false, '2026-10-26T20:00:00Z'),
    make(8, 'project_card', ids.project_card, true, '2026-10-25T15:00:00Z'),
    make(9, 'project', ids.project, false, '2026-10-24T11:00:00Z'),
    make(10, 'note', ids.note, true, '2026-10-23T09:00:00Z'),
  ];
}

/** Itens da busca de "Conectar com": inclui a própria nota e itens já ligados, que a tela esconde. */
const SEARCH_GROUPS = [
  {
    context: 'goals',
    items: [
      { entity_type: 'goal', id: ids.goal, title: DETAILS.goal.title },
      { entity_type: 'goal', id: ids.other_goal, title: DETAILS.other_goal.title },
    ],
  },
  {
    context: 'library',
    items: [
      { entity_type: 'book', id: ids.book, title: DETAILS.book.title },
      { entity_type: 'book', id: ids.other_book, title: DETAILS.other_book.title },
    ],
  },
  {
    context: 'notes',
    items: [
      { entity_type: 'note', id: NOTE_ID, title: 'Ideias para a viagem de janeiro' },
      {
        entity_type: 'note',
        id: '33333333-cccc-4c03-8c03-000000000001',
        title: 'Roteiro de trem pela serra',
      },
    ],
  },
  {
    context: 'tasks',
    items: [
      {
        entity_type: 'task',
        id: '33333333-cccc-4c03-8c03-000000000002',
        title: 'Reservar a pousada perto do rio',
      },
    ],
  },
];

/**
 * Modos: normal, empty (sem ligações), loading (`/links` seguido até o fim da cena), error
 * (`problem+json` 500 em `/links`) e search_error (500 em `/search`).
 */
async function installApi(context, mode, gate) {
  const links = mode === 'empty' ? [] : linkFixtures();
  const state = { removed: 0 };
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
      if (path === '/links' && method === 'GET') {
        if (mode === 'loading') {
          await gate;
          return reply({ title: 'Indisponível', code: 'unavailable' }, 503);
        }
        if (mode === 'error') return reply({ title: 'Erro interno', code: 'internal_error' }, 500);
        const q = url.searchParams;
        const type = q.get('entity_type');
        const id = q.get('entity_id');
        const items = links
          .filter(
            (l) =>
              (l.source_type === type && l.source_id === id) ||
              (l.target_type === type && l.target_id === id),
          )
          .map((l) => {
            const from_source = l.source_type === type && l.source_id === id;
            return {
              ...l,
              linked_type: from_source ? l.target_type : l.source_type,
              linked_id: from_source ? l.target_id : l.source_id,
            };
          })
          .filter((l) => !q.get('linked_type') || l.linked_type === q.get('linked_type'));
        return reply({ items, next_cursor: null });
      }
      const remove = path.match(/^\/links\/([^/]+)$/);
      if (remove && method === 'DELETE') {
        state.removed += 1;
        return route.fulfill({ status: 204 });
      }
      if (path === '/search' && method === 'GET') {
        if (mode === 'search_error') {
          return reply({ title: 'Erro interno', code: 'internal_error' }, 500);
        }
        const term = (url.searchParams.get('q') ?? '').toLowerCase();
        const groups = SEARCH_GROUPS.map((g) => ({
          ...g,
          items: g.items.filter(() => term !== ''),
        }));
        return reply({ groups });
      }
      if (path === `/notes/${NOTE_ID}` && method === 'GET') {
        return reply({ id: NOTE_ID, title: 'Ideias para a viagem de janeiro' });
      }
      for (const [type, pathOf] of Object.entries(DETAIL_PATHS)) {
        const detail = DETAILS[type];
        if (path === pathOf(detail.id) && method === 'GET') return reply(detail);
      }
      return reply({ title: 'Não encontrada', code: 'not_found' }, 404);
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

/** DEC-010: dias de fora do mês do calendário ([data-outside]) ficam fora do color-contrast. */
function dropOutside(result) {
  for (const v of result.violations) {
    if (v.id === 'color-contrast')
      v.nodes = v.nodes.filter((n) => !n.html.includes('data-outside'));
  }
  result.violations = result.violations.filter((v) => v.nodes.length > 0);
}

async function baseChecks(page, errors, tag, theme) {
  const current = await page.evaluate(() => document.documentElement.dataset.theme);
  check(`${tag}: tema ${THEME_LABEL[theme]} aplicado`, current === theme);
  check(`${tag}: sem rolagem horizontal`, await noOverflow(page));
  check(`${tag}: sem erro de JS`, errors.length === 0, errors.join(' | '));
  const result = await new AxeBuilder({ page }).analyze();
  dropOutside(result);
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
    `${tag}: axe sem violações (inclui color-contrast; dias de fora do mês fora do contraste, DEC-010)`,
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
const TAB_PATH = '/evidence/note';
const NEW_PATH = `/connections/new?source_type=note&source_id=${NOTE_ID}&q=viagem`;
const CATEGORY_COUNT = 8;

/** Nenhum texto cortado: todo elemento do conteúdo cabe na própria caixa e na janela. */
async function noClipped(page) {
  return page.evaluate(() => {
    const bad = [];
    for (const el of document.querySelectorAll('main#conteudo *')) {
      if (el.children.length > 0 || el.textContent.trim() === '') continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0) continue;
      if (el.scrollWidth > el.clientWidth + 1 || r.right > window.innerWidth + 1) {
        bad.push(el.textContent.trim().slice(0, 30));
      }
    }
    return bad;
  });
}

async function focusOutline(page) {
  return page.evaluate(() => {
    const s = getComputedStyle(document.activeElement);
    return { style: s.outlineStyle, width: parseFloat(s.outlineWidth), color: s.outlineColor };
  });
}

const themeScenarios = [
  {
    name: 'aba Conexões agrupada por categoria',
    path: TAB_PATH,
    tall: true,
    run: async (page, tag) => {
      const first = main(page).getByRole('link', { name: 'Viajar para Lisboa em janeiro' });
      await first.waitFor();
      const heads = await main(page).locator('h2').allTextContents();
      check(
        `${tag}: grupos por categoria visíveis · ${heads.length} cabeçalhos`,
        heads.length === CATEGORY_COUNT,
        heads.join(' | '),
      );
      const rows = main(page).locator('ul > li');
      const badges = await rows.evaluateAll((els) =>
        els.map((el) => el.textContent ?? '').filter((t) => t !== ''),
      );
      check(`${tag}: 10 ligações listadas`, (await rows.count()) === 10, `${await rows.count()}`);
      const labels = [
        'Metas',
        'Tarefas',
        'Acervo',
        'Lembretes',
        'Financeiro',
        'Diário',
        'Projetos',
        'Notas',
      ];
      const missing = labels.filter((l) => !badges.some((t) => t.includes(l)));
      check(
        `${tag}: rótulo da categoria em cada ligação`,
        missing.length === 0 && (await rows.count()) === 10,
        missing.join(', '),
      );
      check(
        `${tag}: título do cartão de projeto com link para o cartão`,
        (
          await main(page)
            .getByRole('link', { name: 'Roteiro dos três primeiros dias' })
            .getAttribute('href')
        )?.includes(`/projects/c4d1e7a2-5b36-4f08-9a1d-6e2b8c3f7a10/cards/`) ?? false,
      );
      check(
        `${tag}: transferência pelo rótulo do tipo, sem link`,
        (await main(page).getByRole('link', { name: 'Transferência' }).count()) === 0 &&
          (await main(page).getByText('Transferência', { exact: true }).count()) === 1,
      );
      const filters = page.getByRole('group', { name: 'Filtros' });
      const search = page.getByRole('searchbox', { name: 'Busca' });
      const view = page.getByRole('group', { name: 'Visualização' });
      check(
        `${tag}: controles Filtros, Busca e Visualização`,
        (await filters.count()) >= 1 && (await search.count()) >= 1 && (await view.count()) >= 1,
        `${await filters.count()}/${await search.count()}/${await view.count()}`,
      );
      check(
        `${tag}: botão "Conectar com" visível`,
        await main(page).getByRole('link', { name: 'Conectar com' }).isVisible(),
      );
      check(`${tag}: nenhum <select> nativo`, (await page.locator('select').count()) === 0);
      const clipped = await noClipped(page);
      check(`${tag}: rótulos sem corte`, clipped.length === 0, clipped.join(' | '));
    },
  },
  {
    name: 'tela de ligar (/connections/new)',
    path: NEW_PATH,
    run: async (page, tag) => {
      const list = page.getByRole('list', { name: 'Resultados da busca' });
      await list.waitFor();
      const field = page.getByRole('searchbox', { name: 'Buscar item para ligar' });
      check(
        `${tag}: campo de busca da tela de ligar`,
        (await field.isVisible()) && (await field.inputValue()) === 'viagem',
      );
      const titles = (await list.getByRole('listitem').allTextContents()).join(' | ');
      check(
        `${tag}: resultados sem o próprio item nem os já ligados`,
        !titles.includes('Ideias para a viagem') &&
          !titles.includes('Viajar para Lisboa') &&
          !titles.includes('Guia de Portugal') &&
          titles.includes('Aprender português europeu'),
        titles,
      );
      check(
        `${tag}: subtítulo com o item de origem`,
        await page.getByText('Ligue “Ideias para a viagem de janeiro”').isVisible(),
      );
      check(
        `${tag}: botões "Conectar" em cada resultado`,
        (await list.getByRole('button', { name: /^Conectar com / }).count()) === 4,
      );
      const clipped = await noClipped(page);
      check(`${tag}: rótulos sem corte`, clipped.length === 0, clipped.join(' | '));
    },
  },
];

const stateScenarios = [
  {
    name: 'aba vazia',
    path: TAB_PATH,
    mode: 'empty',
    run: async (page, tag) => {
      const title = page.getByText('Nenhuma conexão', { exact: true });
      await title.waitFor();
      check(
        `${tag}: estado vazio com texto explicativo`,
        (await title.isVisible()) &&
          (await page
            .getByText('Use “Conectar com” para ligar este item a qualquer outro.')
            .isVisible()),
      );
    },
  },
  {
    name: 'aba carregando',
    path: TAB_PATH,
    mode: 'loading',
    run: async (page, tag) => {
      const status = page.getByRole('status').filter({ hasText: 'Carregando conexões' });
      await status.waitFor();
      check(`${tag}: indicador de carregamento visível`, await status.isVisible());
    },
  },
  {
    name: 'aba com erro',
    path: TAB_PATH,
    mode: 'error',
    run: async (page, tag) => {
      const retry = page.getByRole('button', { name: 'Tentar de novo' });
      await retry.waitFor();
      check(
        `${tag}: mensagem de erro visível com "Tentar de novo"`,
        (await retry.isVisible()) &&
          (await page.getByText('Não foi possível carregar as conexões').isVisible()),
      );
    },
  },
  {
    name: 'foco nos resultados da tela de ligar',
    path: NEW_PATH,
    run: async (page, tag) => {
      const list = page.getByRole('list', { name: 'Resultados da busca' });
      await list.waitFor();
      const field = page.getByRole('searchbox', { name: 'Buscar item para ligar' });
      check(
        `${tag}: foco inicial no campo de busca`,
        await field.evaluate((el) => el === document.activeElement),
      );
      await page.keyboard.press('Tab');
      await page.keyboard.press('ArrowDown');
      const active = await page.evaluate(() => {
        const el = document.activeElement;
        const list = document.querySelector('ul[aria-label="Resultados da busca"]');
        const buttons = [...(list?.querySelectorAll('button') ?? [])];
        return { inside: !!list && list.contains(el), index: buttons.indexOf(el) };
      });
      check(
        `${tag}: resultado ativo depois de Tab e setas`,
        active.inside && active.index === 1,
        `índice ${active.index}`,
      );
      const outline = await focusOutline(page);
      check(
        `${tag}: contorno de foco visível · ≥ 2px`,
        outline.style !== 'none' && outline.width >= 2,
        `${outline.style} ${outline.width}px ${outline.color}`,
      );
      await page.keyboard.press('ArrowUp');
      const back = await page.evaluate(() => {
        const list = document.querySelector('ul[aria-label="Resultados da busca"]');
        return [...(list?.querySelectorAll('button') ?? [])].indexOf(document.activeElement);
      });
      check(`${tag}: seta para cima volta ao primeiro resultado`, back === 0, `índice ${back}`);
      await page.keyboard.press('ArrowDown');
    },
  },
];

// ---------- principal ----------

const EVIDENCES = {
  temas: async (browser, base) => {
    const shots = await runScenarios(browser, base, themeScenarios);
    await sheet(browser, {
      title: 'TASK-31 · aba Conexões e tela de ligar nos dois temas e larguras (RNF-08, RNF-10)',
      file: 'connections-themes-widths.png',
      shots,
      scale: { desktop: 0.5, mobile: 0.62 },
    });
  },
  estados: async (browser, base) => {
    const shots = await runScenarios(browser, base, stateScenarios);
    await sheet(browser, {
      title: 'TASK-31 · estados da aba e foco por teclado na tela de ligar (RNF-06)',
      file: 'connections-states-focus.png',
      shots,
      scale: { desktop: 0.5, mobile: 0.62 },
    });
  },
};

const names = process.argv.slice(2);
const unknown = names.filter((n) => !(n in EVIDENCES));
if (names.length === 0 || unknown.length > 0) {
  console.error(
    `Evidência desconhecida ou ausente: ${unknown.join(', ') || '(nenhuma)'}. Use temas ou estados.`,
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
