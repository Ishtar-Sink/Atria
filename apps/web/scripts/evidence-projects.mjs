// Evidências visuais da TASK-30 (telas de Projetos), sem passo manual: sobe o Vite numa porta livre
// (API `createServer`), serve uma página virtual que carrega `src/features/projects/evidence/harness.tsx`
// (as rotas da feature num roteador em memória, com os providers e o layout do app), simula a API no
// navegador com fixtures em memória, confere o estado no DOM antes de cada captura e monta a prancha
// (PNG) em vostok/work/tasks/SPEC-001/evidence/TASK-30/.
// Uso: node apps/web/scripts/evidence-projects.mjs themes-widths|states-focus
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
const OUT = join(ROOT, 'vostok', 'work', 'tasks', 'SPEC-001', 'evidence', 'TASK-30');

const THEMES = ['light', 'dark'];
const SIZES = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 360, height: 760 },
};
const TALL = { desktop: 1400, mobile: 1700 };
const SIZE_LABEL = { desktop: 'desktop 1440', mobile: '360 px' };
const THEME_LABEL = { light: 'claro', dark: 'escuro' };
const TODAY = '2026-11-05';
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
    <title>Atria · evidência dos projetos</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/features/projects/evidence/harness.tsx"></script>
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

const NOW_ISO = '2026-11-01T12:00:00Z';

function lane(id, system_key, name, color, position, counts_as_done = false) {
  return {
    id,
    owner_id: 'u1',
    project_id: 'p-obra',
    system_key,
    name,
    color,
    counts_as_done,
    position,
    visibility: 'personal',
    created_at: NOW_ISO,
    updated_at: NOW_ISO,
  };
}

function card(id, lane_id, position, title, extra = {}) {
  return {
    id,
    owner_id: 'u1',
    project_id: 'p-obra',
    lane_id,
    title,
    description: null,
    priority: null,
    labels: [],
    due_date: null,
    checklist: [],
    position,
    visibility: 'personal',
    created_at: NOW_ISO,
    updated_at: NOW_ISO,
    ...extra,
  };
}

const item = (id, text, done, position) => ({ id, text, done, position });

function fixtures() {
  const lanes = [
    lane('l-wait', 'waiting', null, '#92400e', 0),
    lane('l-doing', 'in_progress', null, '#6d28d9', 1),
    lane('l-review', null, 'Revisão', '#0ea5e9', 2),
    lane('l-done', 'done', null, '#047857', 3, true),
  ];
  const cards = [
    card('c-tinta', 'l-wait', 0, 'Escolher a tinta', {
      description: 'Ver as amostras de verde-sálvia.',
      priority: 'high',
      labels: ['sala'],
      due_date: '2026-11-02',
    }),
    card('c-luminaria', 'l-wait', 1, 'Comprar luminária', {
      due_date: '2026-11-09',
      checklist: [
        item('i1', 'Medir o teto', true, 0),
        item('i2', 'Comparar preços', false, 1),
        item('i3', 'Fechar a compra', false, 2),
      ],
    }),
    card('c-lixar', 'l-doing', 0, 'Lixar as paredes', {
      priority: 'medium',
      due_date: '2026-11-12',
      labels: ['obra'],
      checklist: [item('i4', 'Parede norte', true, 0), item('i5', 'Parede sul', false, 1)],
    }),
    card('c-pintar', 'l-doing', 1, 'Pintar a sala', { priority: 'high' }),
    card('c-medir', 'l-done', 0, 'Medir o espaço'),
    card('c-orcamento', 'l-done', 1, 'Pedir o orçamento', { labels: ['contas'] }),
  ];
  const tasks = [
    {
      id: 't-luz',
      owner_id: 'u1',
      title: 'Pagar a conta de luz',
      description: null,
      due_on: null,
      labels: [],
      is_recurring: false,
      recurrence: null,
      completed_at: null,
      visibility: 'personal',
      created_at: NOW_ISO,
      updated_at: NOW_ISO,
    },
    {
      id: 't-lampada',
      owner_id: 'u1',
      title: 'Trocar a lâmpada da sala',
      description: null,
      due_on: null,
      labels: [],
      is_recurring: false,
      recurrence: null,
      completed_at: null,
      visibility: 'personal',
      created_at: NOW_ISO,
      updated_at: NOW_ISO,
    },
  ];
  const links = [
    { id: 'k1', card_id: 'c-luminaria', task_id: 't-luz' },
    { id: 'k2', card_id: 'c-lixar', task_id: 't-lampada' },
  ];
  const projects = [
    ['p-obra', 'Reforma da sala', 'Pintura, luz e móveis da sala de estar.'],
    ['p-viagem', 'Viagem de fim de ano', 'Roteiro, reservas e malas.'],
    ['p-estudos', 'Estudos de inglês', null],
  ].map(([id, name, description]) => ({
    id,
    owner_id: 'u1',
    name,
    description,
    visibility: id === 'p-viagem' ? 'shared' : 'personal',
    created_at: '2026-10-05T10:00:00Z',
    updated_at: NOW_ISO,
  }));
  return { lanes, cards, tasks, links, projects };
}

function addDaysIso(iso, days) {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Modos: normal, empty (sem projetos), loading (respostas seguradas) e error (500 na listagem). */
async function installApi(context, mode, gate) {
  const db = fixtures();
  const calls = [];
  const lanesOf = () => [...db.lanes].sort((a, b) => a.position - b.position);
  const progressOf = (project_id) => {
    const done = new Set(
      lanesOf()
        .filter((l) => l.counts_as_done)
        .map((l) => l.id),
    );
    const own = project_id === 'p-obra' ? db.cards : [];
    return {
      done_cards: own.filter((c) => done.has(c.lane_id)).length,
      total_cards: own.length,
    };
  };
  const projectView = (project) => ({
    ...project,
    lanes: project.id === 'p-obra' ? lanesOf() : [],
    progress: progressOf(project.id),
  });
  const summary = (today) => {
    const lanes = lanesOf();
    const open = new Set(lanes.filter((l) => !l.counts_as_done).map((l) => l.id));
    const middle = new Set(lanes.slice(1, -1).map((l) => l.id));
    return {
      progress: progressOf('p-obra'),
      lanes: lanes.map((l) => ({
        lane_id: l.id,
        name: l.name,
        system_key: l.system_key,
        color: l.color,
        counts_as_done: l.counts_as_done,
        card_count: db.cards.filter((c) => c.lane_id === l.id).length,
      })),
      upcoming_due: db.cards
        .filter((c) => open.has(c.lane_id) && c.due_date && c.due_date <= addDaysIso(today, 14))
        .sort((a, b) => a.due_date.localeCompare(b.due_date))
        .map((c) => ({
          card_id: c.id,
          title: c.title,
          lane_id: c.lane_id,
          due_date: c.due_date,
          overdue: c.due_date < today,
        })),
      in_progress: db.cards
        .filter((c) => middle.has(c.lane_id))
        .map((c) => ({
          card_id: c.id,
          title: c.title,
          lane_id: c.lane_id,
          due_date: c.due_date,
          priority: c.priority,
          checklist_done: c.checklist.filter((i) => i.done).length,
          checklist_total: c.checklist.length,
        })),
    };
  };
  const renumber = () => {
    for (const l of db.lanes) {
      db.cards
        .filter((c) => c.lane_id === l.id)
        .sort((a, b) => a.position - b.position)
        .forEach((c, index) => {
          c.position = index;
        });
    }
  };

  await context.route(
    (url) => url.pathname.startsWith('/api/'),
    async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const path = url.pathname.replace('/api/v1', '');
      const method = request.method();
      const body = request.postData() ? JSON.parse(request.postData()) : {};
      const reply = (data, status = 200) =>
        route.fulfill({
          status,
          contentType: status >= 400 ? 'application/problem+json' : 'application/json',
          body: JSON.stringify(data),
        });
      if (path === '/me')
        return reply({ id: 'u1', email: 'ana@exemplo.com', display_name: 'Ana Maria Souza' });
      if (path === '/me/preferences') return reply({});
      calls.push({ method, path, body });
      if (path.startsWith('/projects') && mode === 'loading') {
        await gate;
        return reply({ title: 'Indisponível', code: 'unavailable' }, 503);
      }
      if (path.startsWith('/projects') && mode === 'error') {
        return reply({ title: 'Erro interno', code: 'internal_error' }, 500);
      }
      const q = url.searchParams;
      if (path === '/projects' && method === 'GET') {
        const items = mode === 'empty' ? [] : db.projects.map(projectView);
        return reply({ items, next_cursor: null });
      }
      const parts = path.split('/').filter(Boolean);
      const [root, id, section, child, action] = parts;
      if (root === 'tasks') {
        const open = db.tasks.filter((t) => t.completed_at === null);
        if (id === undefined) return reply({ items: open, next_cursor: null });
        const found = db.tasks.find((t) => t.id === id);
        return found ? reply(found) : reply({ title: 'Não encontrada', code: 'not_found' }, 404);
      }
      if (root === 'links' && method === 'GET') {
        const entity = q.get('entity_id');
        const items = db.links
          .filter((l) => l.card_id === entity)
          .map((l) => ({
            id: l.id,
            source_type: 'project_card',
            source_id: l.card_id,
            target_type: 'task',
            target_id: l.task_id,
            linked_type: 'task',
            linked_id: l.task_id,
          }));
        return reply({ items, next_cursor: null });
      }
      if (root !== 'projects') return reply({ title: 'Não encontrada', code: 'not_found' }, 404);
      const project = db.projects.find((p) => p.id === id);
      if (!project) return reply({ title: 'Não encontrado', code: 'not_found' }, 404);
      if (section === undefined) return reply(projectView(project));
      if (section === 'summary') return reply(summary(q.get('today') ?? TODAY));
      if (section === 'lanes') {
        if (child === 'order' && method === 'PUT') {
          body.lane_ids.forEach((lane_id, index) => {
            db.lanes.find((l) => l.id === lane_id).position = index;
          });
          return reply({ items: lanesOf(), next_cursor: null });
        }
        if (child === undefined) return reply({ items: lanesOf(), next_cursor: null });
        const target = db.lanes.find((l) => l.id === child);
        if (!target) return reply({ title: 'Não encontrada', code: 'not_found' }, 404);
        if (method === 'PATCH') Object.assign(target, body);
        return reply(target);
      }
      if (section === 'cards') {
        if (child === undefined) return reply({ items: db.cards, next_cursor: null });
        const target = db.cards.find((c) => c.id === child);
        if (!target) return reply({ title: 'Não encontrado', code: 'not_found' }, 404);
        if (action === 'move') {
          const others = db.cards
            .filter((c) => c.lane_id === body.lane_id && c.id !== target.id)
            .sort((a, b) => a.position - b.position);
          target.lane_id = body.lane_id;
          others.splice(Math.min(body.position ?? others.length, others.length), 0, target);
          others.forEach((c, index) => {
            c.position = index;
          });
          renumber();
        }
        return reply(target);
      }
      return reply({ title: 'Não encontrada', code: 'not_found' }, 404);
    },
  );
  return { calls, db };
}

// ---------- captura ----------

/** Primeiro acesso ao Vite: otimiza as dependências antes dos cenários, para não medir a partida a frio. */
async function warmUp(browser, base) {
  const context = await browser.newContext({ viewport: SIZES.desktop });
  const page = await context.newPage();
  try {
    await page.route('**/api/**', (route) =>
      route.fulfill({ status: 503, contentType: 'application/problem+json', body: '{}' }),
    );
    await page.goto(`${base}/__evidence?path=${encodeURIComponent('/projects')}`);
    await page.locator('main#conteudo').waitFor({ timeout: 90000 });
    await page.waitForLoadState('networkidle');
  } catch {
    /* o cenário seguinte diz se a página abre */
  } finally {
    await context.close();
  }
}

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
  const api = await installApi(context, mode, gate);
  const page = await context.newPage();
  await page.clock.setFixedTime(NOW);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  return { page, context, errors, release, api };
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
  check(`${tag}: sem rolagem horizontal da página`, await noOverflow(page));
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
    `${tag}: axe sem violações (inclusive color-contrast; dias de fora do mês fora do contraste, DEC-010)`,
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
        const { page, context, errors, release, api } = await openPage(browser, {
          theme,
          size,
          mode: sc.mode,
          tall: sc.tall,
        });
        try {
          await gotoApp(page, base, sc.path);
          const snap = async (suffix) =>
            shots.push({
              size,
              row: `${sc.name}-${size}`,
              label: suffix ? `${tag} · ${suffix}` : tag,
              png: await page.screenshot({ fullPage: sc.tall === true }),
            });
          await sc.run(page, tag, { theme, size, api, snap });
          await baseChecks(page, errors, tag, theme);
          if (!sc.own_shots) await snap();
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
const BOARD = '/projects/p-obra?tab=board';
const SETTINGS = '/projects/p-obra?tab=settings';

const boxOf = (locator) => locator.boundingBox();

/** Aperta Tab até o elemento em foco satisfazer o teste; devolve se chegou e o contorno dele. */
async function tabUntil(page, predicate, limit = 120) {
  const focused = () => page.evaluate(predicate);
  for (let i = 0; i < limit && !(await focused()); i += 1) await page.keyboard.press('Tab');
  const reached = await focused();
  const outline = await page.evaluate(() => {
    const s = getComputedStyle(document.activeElement);
    return { style: s.outlineStyle, width: parseFloat(s.outlineWidth), color: s.outlineColor };
  });
  return { reached, outline };
}

const outlineOk = (r) => r.reached && r.outline.style !== 'none' && r.outline.width >= 2;
const outlineText = (r) => `${r.outline.style} ${r.outline.width}px ${r.outline.color}`;

const themesWidths = [
  {
    name: 'grade de projetos',
    path: '/projects?view=grid',
    run: async (page, tag) => {
      await page.getByRole('link', { name: 'Reforma da sala' }).waitFor();
      const progress = page.getByText('2 de 6 cartões prontos');
      check(
        `${tag}: grade com o progresso de cada projeto · "2 de 6 cartões prontos"`,
        await progress.first().isVisible(),
      );
      const bars = await page.getByRole('progressbar').count();
      check(`${tag}: barra de progresso por projeto · ${bars} barras`, bars >= 3);
    },
  },
  {
    name: 'Visão geral',
    path: '/projects/p-obra',
    tall: true,
    run: async (page, tag, { size }) => {
      await page.getByRole('heading', { name: 'Andamento', exact: true }).waitFor();
      await page.getByRole('link', { name: 'Escolher a tinta' }).first().waitFor();
      const bar = page.getByRole('img', { name: /Aguardando: 2/ });
      const segments = await bar.locator('> span').count();
      check(
        `${tag}: barra do Andamento com um segmento por raia · ${segments} segmentos`,
        segments === 3,
      );
      const overdue = page.getByText('Era para 02/11/2026');
      await overdue.waitFor();
      const danger = [
        await tokenColor(page, '--danger'),
        await tokenColor(page, '--danger-soft', 'background-color'),
      ];
      const colors = await overdue.evaluate((el) =>
        [el, ...el.querySelectorAll('*')].flatMap((n) => {
          const s = getComputedStyle(n);
          return [s.color, s.backgroundColor, s.borderTopColor];
        }),
      );
      check(
        `${tag}: prazo vencido sem a cor de perigo · "Era para 02/11/2026"`,
        !colors.some((c) => danger.includes(c)),
        colors.join(' | '),
      );
      const main_box = await boxOf(page.getByRole('heading', { name: 'Andamento', exact: true }));
      const side_box = await boxOf(page.getByRole('heading', { name: 'Sobre', exact: true }));
      if (size === 'desktop') {
        check(
          `${tag}: Visão geral em duas zonas · lateral à direita`,
          side_box.x > main_box.x + 300,
          `x ${Math.round(main_box.x)} / ${Math.round(side_box.x)}`,
        );
      } else {
        check(
          `${tag}: 360 px · zonas numa coluna`,
          Math.abs(side_box.x - main_box.x) <= 2 && side_box.y > main_box.y,
          `x ${Math.round(main_box.x)} / ${Math.round(side_box.x)}`,
        );
      }
      const linked = page.getByText('Tarefa ligada a “Comprar luminária”');
      check(`${tag}: Ligações com a tarefa ligada ao cartão`, await linked.isVisible());
    },
  },
  {
    name: 'Quadro',
    path: BOARD,
    tall: true,
    run: async (page, tag, { size }) => {
      const lanes = page.locator('li[data-lane-id]');
      await page.getByRole('link', { name: 'Escolher a tinta' }).waitFor();
      check(
        `${tag}: quadro com as quatro raias · ${await lanes.count()} raias`,
        (await lanes.count()) === 4,
      );
      const text = await tokenColor(page, '--text');
      const surface = await tokenColor(page, '--surface', 'background-color');
      const info = await lanes.evaluateAll((els) =>
        els.map((el) => ({
          hex: getComputedStyle(el).getPropertyValue('--lane').trim(),
          bg: getComputedStyle(el).backgroundColor,
          name: getComputedStyle(el.querySelector('h2')).color,
        })),
      );
      const hexes = info.map((i) => i.hex);
      check(
        `${tag}: raias tingidas na cor HEX · nome em --text`,
        hexes.join() === '#92400e,#6d28d9,#0ea5e9,#047857' &&
          info.every((i) => i.bg !== surface && i.bg !== 'rgba(0, 0, 0, 0)') &&
          new Set(info.map((i) => i.bg)).size === 4 &&
          info.every((i) => i.name === text),
        `${hexes.join(' ')} · ${info[0].bg}`,
      );
      const adds = await lanes.evaluateAll((els) =>
        els.map((el) => {
          const button = [...el.querySelectorAll('button')].find((b) =>
            b.textContent.includes('Adicionar cartão'),
          );
          const cards = [...el.querySelectorAll('[data-card-id]')];
          const lastCard = cards.at(-1)?.getBoundingClientRect().bottom ?? 0;
          return button ? button.getBoundingClientRect().top >= lastCard : false;
        }),
      );
      check(
        `${tag}: "+ Adicionar cartão" no pé da raia · ${adds.filter(Boolean).length} de 4`,
        adds.length === 4 && adds.every(Boolean),
      );
      const first = await boxOf(lanes.nth(0));
      const second = await boxOf(lanes.nth(1));
      if (size === 'mobile') {
        check(
          `${tag}: 360 px · raias empilhadas`,
          Math.abs(first.x - second.x) <= 2 && second.y >= first.y + first.height - 2,
          `x ${Math.round(first.x)}/${Math.round(second.x)} y ${Math.round(first.y)}/${Math.round(second.y)}`,
        );
      } else {
        check(
          `${tag}: raias lado a lado no desktop`,
          second.x > first.x + 100 && Math.abs(second.y - first.y) <= 2,
        );
      }
      const shown = ['Escolher a tinta', 'Comprar luminária', 'Lixar as paredes'];
      const badges = await Promise.all(
        shown.map((title) => page.getByRole('link', { name: title }).first().isVisible()),
      );
      check(`${tag}: cartões com título visível`, badges.every(Boolean));
    },
  },
  {
    name: 'seção Raias',
    path: SETTINGS,
    tall: true,
    run: async (page, tag) => {
      const handles = page.getByRole('button', { name: /^Reordenar a raia/ });
      await handles.first().waitFor();
      const total = await handles.count();
      let visible = 0;
      for (let i = 0; i < total; i += 1) {
        const box = await boxOf(handles.nth(i));
        if (
          box &&
          box.width >= 8 &&
          box.height >= 8 &&
          box.x >= 0 &&
          box.x + box.width <= SIZES.desktop.width
        ) {
          visible += 1;
        }
      }
      check(
        `${tag}: puxador das raias visível · ${visible} de ${total}`,
        total === 4 && visible === 4,
      );
      const boxes = await page.getByRole('checkbox', { name: /^Conta como concluída/ }).count();
      check(`${tag}: "Conta como concluída" em cada raia · ${boxes} caixas`, boxes === 4);
    },
  },
];

const statesFocus = [
  {
    name: 'lista vazia',
    path: '/projects',
    mode: 'empty',
    run: async (page, tag) => {
      const title = page.getByText('Nenhum projeto por aqui');
      await title.waitFor();
      check(
        `${tag}: estado vazio · texto explicativo visível`,
        (await title.isVisible()) &&
          (await page
            .getByText('Crie um projeto para organizar cartões em raias', { exact: false })
            .isVisible()),
      );
    },
  },
  {
    name: 'carregando',
    path: '/projects',
    mode: 'loading',
    run: async (page, tag) => {
      const status = page.getByRole('status').filter({ hasText: 'Carregando' });
      await status.first().waitFor();
      check(`${tag}: estado carregando · indicador visível`, await status.first().isVisible());
    },
  },
  {
    name: 'erro',
    path: '/projects',
    mode: 'error',
    run: async (page, tag) => {
      const retry = page.getByRole('button', { name: 'Tentar de novo' });
      await retry.waitFor();
      check(
        `${tag}: estado de erro · mensagem visível`,
        (await retry.isVisible()) &&
          (await page.getByText('Não foi possível carregar os projetos').isVisible()),
      );
    },
  },
  {
    name: 'diálogo de exclusão da raia',
    path: SETTINGS,
    run: async (page, tag) => {
      await page.getByRole('button', { name: 'Excluir Aguardando' }).click();
      const dialog = page.getByRole('alertdialog');
      await dialog.waitFor();
      const select = dialog.getByRole('button', { name: /Mover os cartões para/ });
      await select.waitFor();
      check(
        `${tag}: diálogo de exclusão · seletor da raia de destino`,
        (await select.isVisible()) &&
          (await dialog.getByText('A raia tem 2 cartões.', { exact: false }).isVisible()) &&
          (await inViewport(dialog)),
        await page.evaluate(() => window.__box),
      );
    },
  },
  {
    name: 'foco e movimento do cartão pelo teclado',
    path: BOARD,
    own_shots: true,
    tall: true,
    run: async (page, tag, { api, snap }) => {
      await page.getByRole('link', { name: 'Escolher a tinta' }).waitFor();
      const focus = await tabUntil(
        page,
        () =>
          document.activeElement?.getAttribute('aria-haspopup') === 'listbox' &&
          document.activeElement.closest('[data-card-id]') !== null,
      );
      check(
        `${tag}: seletor do pé do cartão focado por Tab · contorno de foco visível (≥ 2 px)`,
        outlineOk(focus),
        outlineText(focus),
      );
      await snap('seletor do pé focado');
      await page.keyboard.press('ArrowDown');
      await page.getByRole('option', { name: 'Em progresso' }).waitFor();
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(400);
      const moved = api.calls.find((c) => c.method === 'POST' && c.path.endsWith('/move'));
      const inLane = await page
        .locator('li[data-lane-id="l-doing"] [data-card-id="c-tinta"]')
        .count();
      check(
        `${tag}: cartão movido pelo teclado · POST .../move para a raia de destino`,
        moved?.body.lane_id === 'l-doing' && inLane === 1,
        JSON.stringify(moved?.body ?? null),
      );
      await snap('cartão movido para Em progresso');
    },
  },
  {
    name: 'foco e reordenação do puxador',
    path: SETTINGS,
    own_shots: true,
    tall: true,
    run: async (page, tag, { api, snap }) => {
      await page
        .getByRole('button', { name: /^Reordenar a raia/ })
        .first()
        .waitFor();
      const focus = await tabUntil(page, () =>
        (document.activeElement?.getAttribute('aria-label') ?? '').startsWith('Reordenar a raia'),
      );
      check(
        `${tag}: puxador da raia focado · contorno de foco visível (≥ 2 px)`,
        outlineOk(focus),
        outlineText(focus),
      );
      await snap('puxador focado');
      await page.keyboard.press('ArrowDown');
      await page.waitForTimeout(400);
      const put = api.calls.find((c) => c.method === 'PUT' && c.path.endsWith('/lanes/order'));
      const name = await page.evaluate(() => document.activeElement?.getAttribute('aria-label'));
      check(
        `${tag}: raia reordenada pelo teclado · PUT .../lanes/order e foco no puxador`,
        put?.body.lane_ids?.[0] === 'l-doing' && /posição 2 de 4/.test(name ?? ''),
        `${JSON.stringify(put?.body ?? null)} · ${name}`,
      );
      await snap('raia movida uma posição');
    },
  },
  {
    name: 'formulário do cartão com tarefa ligada',
    path: '/projects/p-obra/cards/c-luminaria',
    tall: true,
    run: async (page, tag) => {
      const task = page.getByRole('button', { name: /Ligar a uma tarefa.*Pagar a conta de luz/ });
      await task.waitFor();
      const title = await page.getByRole('textbox', { name: 'Título' }).inputValue();
      check(
        `${tag}: formulário do cartão · "Ligar a uma tarefa" preenchido`,
        (await task.isVisible()) && title === 'Comprar luminária',
        title,
      );
      const native = await page
        .locator('select, input[type="date"], input[type="time"], input[type="number"]')
        .count();
      check(`${tag}: nenhum campo nativo de data, hora, número ou <select>`, native === 0);
    },
  },
];

// ---------- principal ----------

const EVIDENCES = {
  'themes-widths': async (browser, base) => {
    await warmUp(browser, base);
    const shots = await runScenarios(browser, base, themesWidths);
    await sheet(browser, {
      title:
        'TASK-30 · Projetos nos dois temas e em 360 e 1440 px (RNF-08, RNF-10, PD-42, PD-44, PD-47)',
      file: 'projects-themes-widths.png',
      shots,
      scale: { desktop: 0.5, mobile: 0.62 },
    });
  },
  'states-focus': async (browser, base) => {
    await warmUp(browser, base);
    const shots = await runScenarios(browser, base, statesFocus);
    await sheet(browser, {
      title:
        'TASK-30 · estados, exclusão da raia, teclado e formulário do cartão (CB-07, RNF-06, PD-46, PD-47)',
      file: 'projects-states-focus.png',
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
