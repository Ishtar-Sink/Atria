// Evidências visuais da TASK-08 (SPEC-002, Dashboard com cards pareados), sem passo manual: sobe o Vite numa porta livre com uma
// página virtual que carrega o harness da feature (src/features/dashboard/evidence/harness.tsx),
// simula a API no navegador (context.route), fixa o relógio, confere o estado no DOM antes de cada
// captura e monta a prancha (PNG) em $VOSTOK_EVIDENCE (padrão vostok/work/tasks/SPEC-002/evidence/TASK-08/).
// Uso: node apps/web/scripts/evidence-dashboard.mjs telas
// Imprime "ok" ou "FALHA" por verificação, o caminho do PNG e a linha final "ok  N falha(s)";
// sai com código 1 se algo falhar.
import AxeBuilder from '@axe-core/playwright';
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = join(WEB, '..', '..');
const OUT =
  process.env.VOSTOK_EVIDENCE ??
  join(ROOT, 'vostok', 'work', 'tasks', 'SPEC-002', 'evidence', 'TASK-08');
const PAGE_PATH = '/__evidence/dashboard.html';
const HARNESS = '/src/features/dashboard/evidence/harness.tsx';

const NOW = '2026-11-05T15:00:00Z'; // 12:00 em America/Sao_Paulo
const THEMES = ['light', 'dark'];
const THEME_LABEL = { light: 'claro', dark: 'escuro' };
const SIZES = {
  desktop: { width: 1440, height: 900 },
  tablet: { width: 900, height: 900 },
  mobile: { width: 360, height: 760 },
};
const SIZE_LABEL = { desktop: 'desktop 1440', tablet: '900 px', mobile: '360 px' };

let failures = 0;
function check(name, cond, extra) {
  if (!cond) failures += 1;
  console.log(`${cond ? 'ok    ' : 'FALHA '} ${name}${extra ? ` · ${extra}` : ''}`);
}

// ---------- servidor de desenvolvimento (API do Vite, sem processo filho) ----------

function evidencePage() {
  return {
    name: 'atria-evidence-page',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url?.split('?')[0] !== PAGE_PATH) return next();
        const html = `<!doctype html>
<html lang="pt-BR" data-theme="light">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light dark" />
    <title>Atria · evidência do Dashboard</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="${HARNESS}"></script>
  </body>
</html>`;
        res.setHeader('Content-Type', 'text/html');
        res.end(await server.transformIndexHtml(PAGE_PATH, html));
      });
    },
  };
}

async function startVite() {
  const server = await createServer({
    root: WEB,
    configFile: join(WEB, 'vite.config.ts'),
    logLevel: 'error',
    plugins: [evidencePage()],
    server: { host: '127.0.0.1', port: 0, strictPort: false, hmr: false },
  });
  await server.listen();
  const address = server.httpServer.address();
  return { url: `http://127.0.0.1:${address.port}`, stop: () => server.close() };
}

// ---------- API simulada ----------

const flow = (realized, forecast) => ({ realized, forecast });
const json = (body, status = 200) => ({
  status,
  contentType: status >= 400 ? 'application/problem+json' : 'application/json',
  body: JSON.stringify(body),
});

/** Dados de um dia cheio; `override` troca respostas por `MÉTODO /caminho`. */
function fixtures(override = {}) {
  const base = {
    'GET /me': () => json({ id: 'u1', email: 'ana@exemplo.com', display_name: 'Ana Maria Souza' }),
    'GET /me/preferences': () =>
      json({ currency: 'BRL', locale: 'pt-BR', time_zone: 'America/Sao_Paulo' }),
    'GET /tasks/occurrences': () =>
      json({
        items: [
          { task_id: 'daily', occurrence_date: '2026-11-05', completed: false },
          { task_id: 'done', occurrence_date: '2026-11-05', completed: true },
          { task_id: 'today1', occurrence_date: '2026-11-05', completed: false },
        ],
      }),
    'GET /tasks': (q) =>
      q.get('recurring') === 'true'
        ? json({
            items: [
              { id: 'daily', title: 'Beber água', is_recurring: true },
              { id: 'done', title: 'Regar as plantas', is_recurring: true },
            ],
          })
        : json({
            items: [
              { id: 'late', title: 'Pagar o IPTU', is_recurring: false, due_on: '2026-11-03' },
              {
                id: 'today1',
                title: 'Ligar para a escola',
                is_recurring: false,
                due_on: '2026-11-05',
              },
            ],
          }),
    'GET /reminders/upcoming': (q) =>
      q.get('from')?.startsWith('2026-11-05')
        ? json({
            items: [
              { reminder_id: 'r3', title: 'Dormir cedo', fire_at: '2026-11-06T01:30:00Z' },
              { reminder_id: 'r1', title: 'Remédio', fire_at: '2026-11-05T11:00:00Z' },
              { reminder_id: 'r2', title: 'Reunião', fire_at: '2026-11-05T17:00:00Z' },
              { reminder_id: 'r4', title: 'Alongar', fire_at: '2026-11-05T22:00:00Z' },
            ],
          })
        : json({
            items: [{ reminder_id: 'r9', title: 'Aniversário', fire_at: '2026-11-07T13:00:00Z' }],
          }),
    'GET /transactions': (q) =>
      q.get('kind') === 'expense'
        ? json({
            items: [
              {
                id: null,
                recurrence_id: 'rec1',
                occurrence_date: '2026-12-05',
                kind: 'expense',
                description: 'Aluguel',
                expected_amount: 150000,
                expected_date: '2026-12-05',
                currency: 'BRL',
              },
              {
                id: null,
                recurrence_id: 'rec3',
                occurrence_date: '2026-12-10',
                kind: 'expense',
                description: 'Condomínio',
                expected_amount: 62000,
                expected_date: '2026-12-10',
                currency: 'BRL',
              },
            ],
            next_cursor: 'more',
          })
        : json({
            items: [
              {
                id: 'tx1',
                kind: 'expense',
                description: 'Internet',
                expected_amount: 9990,
                expected_date: '2026-11-08',
                currency: 'BRL',
              },
              {
                id: null,
                recurrence_id: 'rec2',
                occurrence_date: '2026-11-06',
                kind: 'expense',
                description: 'Streaming',
                expected_amount: 3990,
                expected_date: '2026-11-06',
                currency: 'BRL',
              },
            ],
          }),
    'GET /financial-summaries': (q) =>
      q.get('from') === '2026-11-01'
        ? json({
            currency: 'BRL',
            balance: {
              current: 1234500,
              accounts: [
                { id: 'a1', name: 'Conta corrente', balance_amount: 1000000 },
                { id: 'a2', name: 'Poupança', balance_amount: 234500 },
              ],
            },
            totals: { income: flow(0, 500000), expense: flow(100000, 300000), surplus: flow(0, 0) },
          })
        : json({
            currency: 'BRL',
            balance: { current: 0, accounts: [] },
            totals: {
              income: flow(0, 800000),
              expense: flow(0, 450000),
              surplus: flow(0, 350000),
            },
          }),
    'GET /journal-entries': () =>
      json({
        items: [
          {
            id: 'j1',
            occurred_at: '2026-11-04T23:30:00Z',
            text: 'Hoje foi um dia calmo, com tempo para ler e caminhar.\nSegunda linha.',
            emotions: [
              { emotion_id: 'e1', name: 'Calma' },
              { emotion_id: 'e2', name: 'Gratidão' },
            ],
          },
        ],
      }),
    'GET /books': () =>
      json({
        items: [
          { id: 'b1', title: 'Dom Casmurro', progress_percent: 42 },
          { id: 'b2', title: 'Memórias Póstumas de Brás Cubas', progress_percent: 8 },
        ],
      }),
  };
  return { ...base, ...override };
}

const EMPTY = { items: [] };
const PROBLEM = json({ code: 'internal_error', title: 'Erro interno' }, 500);

// ---------- captura ----------

async function openPage(browser, { theme, size, storage, handlers, gate }) {
  const context = await browser.newContext({
    viewport: SIZES[size],
    reducedMotion: 'reduce',
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
  });
  await context.addInitScript(
    ([entries]) => {
      try {
        for (const [k, v] of entries) localStorage.setItem(k, v);
      } catch {
        /* sem armazenamento */
      }
    },
    [[['atria_theme', theme], ...Object.entries(storage ?? {})]],
  );
  await context.route(
    (url) => url.pathname.startsWith('/api/'),
    async (route) => {
      const url = new URL(route.request().url());
      const key = `${route.request().method()} ${url.pathname.replace('/api/v1', '')}`;
      const handler = handlers[key];
      if (!handler) return route.fulfill(json({ code: 'not_found', title: 'não achado' }, 404));
      const reply = handler(url.searchParams);
      if (reply === 'wait') await gate; // bloco "carregando": nunca responde antes da captura
      return route.fulfill(reply === 'wait' ? EMPTY_REPLY : reply);
    },
  );
  const page = await context.newPage();
  await page.clock.setFixedTime(new Date(NOW));
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  return { page, context, errors };
}
const EMPTY_REPLY = json(EMPTY);

const noOverflow = (page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

/** Aumenta a janela até caber o conteúdo da área rolável, para fotografar a tela inteira. */
async function fitViewport(page, size) {
  const extra = await page.evaluate(() => {
    const area = document.querySelector('[data-scroll-area]');
    return area ? area.scrollHeight - area.clientHeight : 0;
  });
  if (extra > 0)
    await page.setViewportSize({
      width: SIZES[size].width,
      height: Math.min(SIZES[size].height + extra + 8, 4200),
    });
  await page.waitForTimeout(150);
}

/** DEC-010: dias de fora do mês do calendário ([data-outside]) ficam fora do color-contrast. */
function dropOutside(result) {
  for (const v of result.violations) {
    if (v.id === 'color-contrast')
      v.nodes = v.nodes.filter((n) => !n.html.includes('data-outside'));
  }
  result.violations = result.violations.filter((v) => v.nodes.length > 0);
}

async function baseChecks(page, errors, tag, theme) {
  const applied = await page.evaluate(() => document.documentElement.dataset.theme);
  check(`${tag}: tema ${THEME_LABEL[theme]} aplicado`, applied === theme);
  check(`${tag}: sem rolagem horizontal`, await noOverflow(page));
  check(`${tag}: sem erro de JavaScript`, errors.length === 0, errors.join(' | '));
  const axe = await new AxeBuilder({ page }).analyze();
  dropOutside(axe);
  check(
    `${tag}: axe sem violações (inclusive color-contrast; dias de fora do mês fora do contraste, DEC-010)`,
    axe.violations.length === 0,
    axe.violations
      .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' ; ')}`)
      .join(', '),
  );
}

/** Cartão do bloco pelo título. */
const block = (page, id) => page.locator(`[data-block="${id}"]`);

async function run(browser, base, scenarios) {
  const shots = [];
  for (const theme of THEMES) {
    for (const sc of scenarios) {
      for (const size of sc.sizes) {
        const tag = `${sc.name} · ${SIZE_LABEL[size]} · ${THEME_LABEL[theme]}`;
        let release;
        const gate = new Promise((resolve) => (release = resolve));
        const { page, context, errors } = await openPage(browser, {
          theme,
          size,
          storage: sc.storage,
          handlers: fixtures(sc.override),
          gate,
        });
        try {
          await page.goto(`${base}${PAGE_PATH}`);
          await page.getByRole('heading', { level: 1, name: 'Dashboard' }).waitFor();
          await sc.ready(page);
          await page.evaluate(() => document.fonts.ready);
          await fitViewport(page, size);
          await sc.run(page, tag, size, theme);
          await baseChecks(page, errors, tag, theme);
          shots.push({
            scenario: sc.name,
            theme,
            size,
            label: tag,
            png: await page.screenshot(),
            viewport: page.viewportSize(),
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

async function sheet(browser, { title, file, shots }) {
  const scale = { desktop: 0.5, tablet: 0.5, mobile: 0.55 };
  const figure = (s) => {
    const w = Math.round(s.viewport.width * scale[s.size]);
    return `<figure style="width:${w}px"><img style="width:${w}px" src="data:image/png;base64,${s.png.toString('base64')}"><figcaption>${s.label}</figcaption></figure>`;
  };
  // Uma linha por cenário; a coluna da esquerda é o tema claro e a da direita, o escuro.
  const cells = new Map();
  for (const s of shots) {
    const key = `${s.scenario}|${s.theme}`;
    cells.set(key, [...(cells.get(key) ?? []), s]);
  }
  const names = [...new Set(shots.map((s) => s.scenario))];
  const cell = (n, theme) =>
    `<div class="row">${(cells.get(`${n}|${theme}`) ?? []).map(figure).join('')}</div>`;
  const figures = names
    .map((n) => `<h2>${n}</h2><div class="pair">${cell(n, 'light')}${cell(n, 'dark')}</div>`)
    .join('');
  const html = `<!doctype html><meta charset="utf-8"><style>
    body{margin:0;padding:24px;background:#1b1b20;color:#e8e8ee;font:13px/1.4 system-ui,sans-serif}
    h1{font-size:18px;margin:0 0 16px}
    h2{font-size:15px;margin:28px 0 8px;color:#d0d0dc}
    .pair{display:flex;gap:48px;align-items:flex-start}
    figure{margin:0}
    .row{display:flex;gap:20px;align-items:flex-start}
    img{display:block;border:1px solid #444;border-radius:4px}
    figcaption{margin-top:6px;color:#b8b8c4}
  </style><h1>${title}</h1>${figures}`;
  const context = await browser.newContext({ viewport: { width: 2900, height: 800 } });
  const page = await context.newPage();
  await page.setContent(html);
  await page.waitForFunction(() => [...document.images].every((i) => i.complete));
  mkdirSync(OUT, { recursive: true });
  const path = join(OUT, file);
  writeFileSync(path, await page.screenshot({ fullPage: true }));
  await context.close();
  console.log(`png: ${relative(ROOT, path)} (${shots.length} capturas)`);
}

// ---------- verificações dos cenários ----------

const hasText = async (loc) => (await loc.count()) > 0 && (await loc.first().isVisible());

/** Cor "avermelhada": canal vermelho dominante. */
const isRed = ([r, g, b]) => r > 150 && r - g > 70 && r - b > 70;
const rgbOf = (el) => {
  const m = getComputedStyle(el).color.match(/[\d.]+/g) ?? ['0', '0', '0'];
  return m.slice(0, 3).map(Number);
};

const waitData = (name) => async (page) => {
  await page.getByRole('heading', { level: 2, name }).waitFor();
  await page.waitForFunction(() => document.querySelectorAll('[aria-busy="true"]').length === 0);
};

// Mede topo e base dos dois cartões de cada linha pareada (tolerância de 1 px).
const measureRows = (page, numbers) =>
  page.evaluate((list) => {
    return list.map((n) => {
      const [x, y] = Array.from(document.querySelectorAll(`[data-row="${n}"] > section`)).map(
        (el) => el.getBoundingClientRect(),
      );
      const ok =
        Boolean(x && y) && Math.abs(x.top - y.top) <= 1 && Math.abs(x.bottom - y.bottom) <= 1;
      const f = (v) => (v === undefined ? '-' : String(Math.round(v)));
      return {
        n,
        ok,
        detail: `linha ${n}: topo ${f(x?.top)}/${f(y?.top)}, base ${f(x?.bottom)}/${f(y?.bottom)}`,
      };
    });
  }, numbers);

const full = ['desktop', 'tablet', 'mobile'];
const both = ['desktop', 'mobile'];

const scenarios = [
  {
    name: 'dashboard com dados',
    sizes: full,
    ready: async (page) => {
      await page.getByText('Pagar o IPTU').waitFor();
      await page.getByText('Dom Casmurro').waitFor();
      await page.getByText('Aluguel').waitFor();
      await page.getByText('Streaming').waitFor();
      await page.getByText('Remédio').waitFor();
    },
    run: async (page, tag, size) => {
      check(
        `${tag}: saudação com o primeiro nome e a data longa`,
        (await page.getByText('Boa tarde, Ana', { exact: true }).isVisible()) &&
          (await page.getByText(/quinta-feira, 5 de novembro/i).isVisible()) &&
          (await page.getByRole('button', { name: 'Escrever no diário' }).isVisible()),
      );
      if (size === 'desktop') {
        const rows = await measureRows(page, [1, 2, 3]);
        check(
          `${tag}: cards pareados com topos e bases alinhados`,
          rows.every((row) => row.ok),
          rows.map((row) => row.detail).join('; '),
        );
      } else {
        const order = await page.evaluate(() => {
          const mains = document.querySelectorAll('[data-zone="main"]');
          const side = document.querySelector('[data-zone="side"]');
          return {
            last: mains[mains.length - 1].getBoundingClientRect().bottom,
            side: side.getBoundingClientRect().top,
          };
        });
        check(`${tag}: uma coluna com a zona principal primeiro`, order.side >= order.last - 1);
      }
      const titles = await page.locator('[data-block] > div > h2').allTextContents();
      check(
        `${tag}: seis blocos na ordem do protótipo`,
        titles.join('|') ===
          'Tarefas de hoje|Lembretes de hoje|Próximos dias|Diário|Dinheiro|Leituras',
        titles.join(' | '),
      );
      const today = block(page, 'today');
      const late = await today.getByText(/^Era para /).first();
      const lateColor = await late.evaluate(rgbOf);
      const rowColor = await today.getByText('Pagar o IPTU').evaluate(rgbOf);
      check(
        `${tag}: tarefa vencida com "Era para" sem vermelho`,
        (await late.isVisible()) && !isRed(lateColor) && !isRed(rowColor),
        `rgb(${lateColor.join(',')})`,
      );
      check(
        `${tag}: até 3 tarefas, cada uma com o check`,
        (await today.getByRole('button', { name: /^Concluir/ }).count()) === 3,
      );
      const rem = block(page, 'reminders');
      const periods = await rem.locator('h3').allTextContents();
      check(
        `${tag}: lembretes em Manhã, Tarde e Noite`,
        periods.join('|') === 'Manhã|Tarde|Noite',
        periods.join(' | '),
      );
      const up = block(page, 'upcoming');
      check(
        `${tag}: previsão de recorrente em Próximos dias`,
        (await hasText(up.getByRole('link', { name: 'Streaming' }))) &&
          (await up.getByRole('link', { name: 'Streaming' }).getAttribute('href')) ===
            '/finance/recurring-transactions/rec2',
      );
      const money = block(page, 'balance');
      check(
        `${tag}: previsão do mês seguinte no Dinheiro`,
        (await hasText(money.getByText('Previsão de dezembro'))) &&
          (await hasText(money.getByText('Aluguel'))) &&
          (await hasText(money.getByText(/Ver todas as contas de dezembro/))),
      );
      check(
        `${tag}: saldo por conta recolhido`,
        (await money.locator('details').evaluate((el) => !el.open)) === true,
      );
      check(
        `${tag}: sem botão Ocultar nos blocos`,
        (await page.getByRole('button', { name: /ocultar|personalizar/i }).count()) === 0,
      );
    },
  },
  {
    name: 'tudo feito por hoje',
    sizes: both,
    override: {
      'GET /tasks/occurrences': () =>
        json({ items: [{ task_id: 'done', occurrence_date: '2026-11-05', completed: true }] }),
      'GET /tasks': (q) =>
        q.get('recurring') === 'true'
          ? json({ items: [{ id: 'done', title: 'Regar as plantas', is_recurring: true }] })
          : json(EMPTY),
    },
    ready: waitData('Tarefas de hoje'),
    run: async (page, tag) => {
      const today = block(page, 'today');
      await today.getByText('Tudo feito por hoje.').waitFor();
      check(
        `${tag}: "Tudo feito por hoje." com o link para todas as tarefas`,
        (await hasText(today.getByText('Tudo feito por hoje. Aproveite o resto do dia.'))) &&
          (await hasText(today.getByRole('link', { name: /Ver todas \(1 tarefa hoje\)/ }))),
      );
    },
  },
  {
    name: 'olho: Dinheiro e Diário escondidos',
    sizes: both,
    storage: {
      'atria.dashboard.masked_blocks.u1': JSON.stringify(['journal', 'balance']),
    },
    ready: async (page) => {
      await page.getByText('Entrada oculta. Use o olho para mostrar.').waitFor();
    },
    run: async (page, tag) => {
      const money = block(page, 'balance');
      const text = await money.innerText();
      const values = text.match(/R\$\s*[\d.,]+/g) ?? [];
      check(
        `${tag}: valores do Dinheiro como "•••••" e texto do Diário oculto`,
        values.length === 0 &&
          (text.match(/R\$\s*•••••/g) ?? []).length >= 3 &&
          (await hasText(
            block(page, 'journal').getByText('Entrada oculta. Use o olho para mostrar.'),
          )) &&
          (await block(page, 'journal').getByText('Hoje foi um dia calmo').count()) === 0,
        `valores à mostra: ${values.length}`,
      );
      const eye = money.getByRole('button', { name: 'Mostrar as informações de Dinheiro' });
      check(
        `${tag}: olho marcado como pressionado`,
        (await eye.getAttribute('aria-pressed')) === 'true',
      );
    },
  },
  {
    name: 'linha com um card só',
    sizes: both,
    storage: { 'atria.dashboard.hidden_blocks.u1': JSON.stringify(['journal']) },
    ready: waitData('Dinheiro'),
    run: async (page, tag, size) => {
      if (size !== 'desktop') return;
      const alone = await page.evaluate(() => {
        const cell = document.querySelector('[data-alone]');
        const zones = document.querySelector('[data-zone]').parentElement;
        return {
          cell: cell.getBoundingClientRect().width,
          zones: zones.getBoundingClientRect().width,
          count: document.querySelectorAll('[data-alone]').length,
        };
      });
      const rows = await measureRows(page, [1, 2]);
      check(
        `${tag}: card sem par ocupa a linha inteira`,
        alone.count === 1 && Math.abs(alone.cell - alone.zones) <= 1 && rows.every((row) => row.ok),
        `célula ${String(Math.round(alone.cell))} px de ${String(Math.round(alone.zones))} px; ${rows.map((row) => row.detail).join('; ')}`,
      );
    },
  },
  {
    name: 'bloco oculto em Configurações',
    sizes: both,
    storage: { 'atria.dashboard.hidden_blocks.u1': JSON.stringify(['journal', 'upcoming']) },
    ready: waitData('Dinheiro'),
    run: async (page, tag) => {
      const titles = await page.locator('[data-block] > div > h2').allTextContents();
      check(
        `${tag}: bloco oculto em Configurações ausente`,
        !titles.includes('Diário') && !titles.includes('Próximos dias') && titles.length === 4,
        titles.join(' | '),
      );
    },
  },
  {
    name: 'todos os blocos ocultos',
    sizes: both,
    storage: {
      'atria.dashboard.hidden_blocks.u1': JSON.stringify([
        'today',
        'reminders',
        'upcoming',
        'journal',
        'balance',
        'reading',
      ]),
    },
    ready: async (page) => {
      await page.getByText('Todos os blocos estão ocultos').waitFor();
    },
    run: async (page, tag) => {
      const link = page.getByRole('link', { name: 'Abrir as configurações do dashboard' });
      check(
        `${tag}: estado "Todos os blocos estão ocultos" com o link para Configurações`,
        (await hasText(page.getByText('Escolha os blocos em Configurações › Dashboard.'))) &&
          (await link.getAttribute('href')) === '/settings/dashboard',
      );
    },
  },
  {
    name: 'estados: vazio, carregando e erro',
    sizes: both,
    override: {
      'GET /reminders/upcoming': () => json(EMPTY),
      'GET /journal-entries': () => 'wait',
      'GET /books': () => PROBLEM,
    },
    ready: async (page) => {
      await page.getByRole('button', { name: 'Tentar de novo' }).waitFor();
      await page.getByText('Nenhum lembrete para hoje.').waitFor();
    },
    run: async (page, tag) => {
      const empty = block(page, 'reminders').getByText('Nenhum lembrete para hoje.');
      const style = await empty.evaluate((el) => {
        const s = getComputedStyle(el);
        return {
          italic: s.fontStyle,
          bg: s.backgroundColor,
          border: parseFloat(s.borderTopWidth) + parseFloat(s.borderLeftWidth),
          color: s.color,
        };
      });
      check(
        `${tag}: bloco vazio com mensagem em itálico sem fundo`,
        style.italic === 'italic' &&
          (style.bg === 'rgba(0, 0, 0, 0)' || style.bg === 'transparent') &&
          style.border === 0,
        `${style.italic}, fundo ${style.bg}`,
      );
      check(
        `${tag}: bloco carregando`,
        (await block(page, 'journal').locator('[aria-busy="true"]').count()) > 0,
      );
      const err = block(page, 'reading');
      check(
        `${tag}: bloco com erro e "Tentar de novo"`,
        (await hasText(err.getByRole('button', { name: 'Tentar de novo' }))) &&
          (await hasText(err.getByText('Não foi possível carregar este bloco.'))),
      );
      check(
        `${tag}: os outros blocos seguem com dados`,
        await hasText(block(page, 'today').getByText('Pagar o IPTU')),
      );
    },
  },
  {
    name: 'foco no check da tarefa',
    sizes: both,
    ready: async (page) => {
      await page.getByText('Pagar o IPTU').waitFor();
    },
    run: async (page, tag) => {
      const target = block(page, 'today').getByRole('button', { name: 'Concluir: Pagar o IPTU' });
      for (let i = 0; i < 20; i += 1) {
        if (await target.evaluate((el) => el === document.activeElement)) break;
        await page.keyboard.press('Tab');
      }
      check(
        `${tag}: foco chegou ao check da tarefa pelo teclado`,
        await target.evaluate((el) => el === document.activeElement),
      );
      const outline = await target.evaluate((el) => {
        const s = getComputedStyle(el);
        return { style: s.outlineStyle, width: parseFloat(s.outlineWidth), color: s.outlineColor };
      });
      check(
        `${tag}: contorno de foco visível depois de Tab (≥ 2 px)`,
        outline.style !== 'none' && outline.width >= 2,
        `${outline.style} ${outline.width}px ${outline.color}`,
      );
      const box = await target.boundingBox();
      check(
        `${tag}: área do check com pelo menos 36 px`,
        box !== null && box.width >= 36 && box.height >= 36,
        box ? `${Math.round(box.width)}x${Math.round(box.height)}` : '',
      );
    },
  },
];

// ---------- execução ----------

async function main() {
  const which = process.argv.slice(2);
  if (which.length > 0 && !which.includes('telas')) {
    console.error('uso: node apps/web/scripts/evidence-dashboard.mjs telas');
    process.exit(2);
  }
  const vite = await startVite();
  const browser = await chromium.launch();
  try {
    const shots = await run(browser, vite.url, scenarios);
    await sheet(browser, {
      title: 'TASK-08 (SPEC-002) · Dashboard com cards pareados',
      file: 'dashboard-telas.png',
      shots,
    });
  } finally {
    await browser.close();
    await vite.stop();
  }
  console.log(failures === 0 ? 'ok  0 falha(s)' : `FALHA  ${String(failures)} falha(s)`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
