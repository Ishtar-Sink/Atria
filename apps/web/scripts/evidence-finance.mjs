// Evidências visuais do Financeiro (TASK-22, TASK-16 e TASK-17), sem passo manual: sobe o Vite numa porta livre com uma página
// virtual que carrega `src/features/finance/evidence/harness.tsx` (as rotas do Financeiro num
// roteador em memória, com os providers e o layout do app), simula a API no navegador com
// fixtures em memória, confere o estado no DOM (e o axe) antes de cada captura e monta a prancha
// em $VOSTOK_EVIDENCE (padrão vostok/work/tasks/SPEC-002/evidence/TASK-17): finance-telas.png,
// finance-formulario.webm e finance-painel.png (Chromium e Firefox).
// Uso: node apps/web/scripts/evidence-finance.mjs [telas|formulario|painel]
// Imprime "ok" ou "FALHA" por verificação e o caminho do PNG; sai com código 1 se algo falhar.
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createServer as createNetServer } from 'node:net';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import AxeBuilder from '@axe-core/playwright';
import { chromium, firefox } from '@playwright/test';
import { createServer } from 'vite';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = join(WEB, '..', '..');
const OUT =
  process.env.VOSTOK_EVIDENCE ??
  join(ROOT, 'vostok', 'work', 'tasks', 'SPEC-002', 'evidence', 'TASK-17');
const HARNESS_PATH = '/__evidence/finance';
const HARNESS_ENTRY = '/src/features/finance/evidence/harness.tsx';
// Relógio fixo: quinta, 05/11/2026, meio-dia em São Paulo (o período "Este mês" é novembro).
const NOW = new Date('2026-11-05T15:00:00Z');

const SIZES = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 360, height: 760 },
};
const SIZE_LABEL = { desktop: 'desktop 1440', mobile: '360 px' };
const THEME_LABEL = { light: 'claro', dark: 'escuro' };
const ALL = [
  ['light', 'desktop'],
  ['dark', 'desktop'],
  ['light', 'mobile'],
  ['dark', 'mobile'],
];
// Cada tela sai nos dois temas e nas duas larguras ao longo da prancha, sem repetir tudo.
const PAIR = [
  ['light', 'desktop'],
  ['dark', 'mobile'],
];
const PAIR_ALT = [
  ['dark', 'desktop'],
  ['light', 'mobile'],
];

let failures = 0;
function check(name, cond, extra) {
  if (!cond) failures += 1;
  console.log(`${cond ? 'ok    ' : 'FALHA '} ${name}${extra ? ` · ${extra}` : ''}`);
}

// ---------- fixtures (o servidor do Financeiro em memória) ----------

const STAMP = { created_at: '2026-11-01T10:00:00Z', updated_at: '2026-11-02T10:00:00Z' };

function account(o) {
  return {
    kind: 'standard',
    balance_amount: 0,
    currency: 'BRL',
    is_default: false,
    owner_id: 'u1',
    visibility: 'personal',
    credit_limit_amount: null,
    closing_day: null,
    due_day: null,
    ...STAMP,
    ...o,
  };
}

function category(o) {
  return {
    kind: 'expense',
    color: 'primary',
    owner_id: 'u1',
    visibility: 'personal',
    ...STAMP,
    ...o,
  };
}

function transaction(o) {
  return {
    account_id: 'a1',
    category_id: 'c1',
    currency: 'BRL',
    description: 'Mercado',
    kind: 'expense',
    expected_amount: 10000,
    expected_date: '2026-11-10',
    effective_date: '2026-11-10',
    status: 'open',
    owner_id: 'u1',
    visibility: 'personal',
    settled_amount: null,
    settled_at: null,
    difference_amount: null,
    difference_kind: null,
    generated_from: null,
    recurrence_id: null,
    occurrence_date: null,
    installment: null,
    statement_period: null,
    ...STAMP,
    ...o,
  };
}

const RULE = {
  frequency: 'monthly',
  interval: 1,
  weekdays: [],
  month_day: 31,
  time: '12:00',
  timezone: 'America/Sao_Paulo',
  starts_on: '2026-01-31',
  ends_on: null,
};

function recurring(o) {
  return {
    account_id: 'a1',
    category_id: 'c2',
    currency: 'BRL',
    kind: 'expense',
    owner_id: 'u1',
    visibility: 'personal',
    rule: RULE,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...o,
  };
}

function statement(period, o = {}) {
  const [year, month] = period.split('-');
  return {
    period,
    closing_date: `${year}-${month}-03`,
    due_date: `${year}-${month}-10`,
    total_amount: 120000,
    outstanding_amount: 120000,
    paid: false,
    transaction_count: 2,
    ...o,
  };
}

const COPY = transaction({
  id: 't9',
  description: 'Aluguel',
  category_id: 'c2',
  status: 'settled',
  expected_amount: 200000,
  settled_amount: 200000,
  settled_at: '2026-09-30',
  effective_date: '2026-09-30',
  occurrence_date: '2026-09-30',
  generated_from: 'r1',
  recurrence_id: 'r1',
});

const COPY_AUG = transaction({
  ...COPY,
  id: 't8',
  settled_at: '2026-08-31',
  effective_date: '2026-08-31',
  occurrence_date: '2026-08-31',
});

function summary() {
  return {
    period: { from: '2026-11-01', to: '2026-11-30' },
    previous_period: { from: '2026-10-01', to: '2026-10-31' },
    totals: {
      income: { realized: 500000, forecast: 600000 },
      expense: { realized: 218000, forecast: 512000 },
      surplus: { realized: 282000, forecast: 88000 },
    },
    previous_totals: {
      income: { realized: 600000, forecast: 600000 },
      expense: { realized: 540000, forecast: 540000 },
      surplus: { realized: 60000, forecast: 60000 },
    },
    where_it_went: [
      { group: 'category', category_id: 'c2', name: 'Casa', color: 'info', amount: 420000 },
      { group: 'category', category_id: 'c1', name: 'Mercado', color: 'warning', amount: 52000 },
      { group: 'category', category_id: 'c4', name: 'Transporte', color: 'accent', amount: 24000 },
      { group: 'uncategorized', amount: 6000 },
      { group: 'others', amount: 10000 },
    ],
    expected_vs_settled: {
      income: { expected_amount: 600000, settled_amount: 500000 },
      expense: { expected_amount: 512000, settled_amount: 218000 },
    },
    savings_and_losses: { savings_amount: 2000, gains_amount: 0, losses_amount: 1500 },
    balance: {
      current: 750000,
      forecast_at_period_end: 662000,
      accounts: [
        { id: 'a1', name: 'Conta principal', kind: 'standard', balance_amount: 700000 },
        { id: 'a2', name: 'Carteira', kind: 'standard', balance_amount: 50000 },
      ],
    },
    credit_cards: [
      {
        account_id: 'a3',
        name: 'Cartão Nu',
        credit_limit_amount: 500000,
        used_limit_amount: 186400,
        open_statement_amount: 120000,
        statement_period: '2026-11',
        due_date: '2026-11-10',
      },
    ],
    upcoming_bills: [
      transaction({
        id: null,
        recurrence_id: 'r3',
        kind: 'income',
        description: 'Salário',
        category_id: 'c3',
        expected_amount: 500000,
        expected_date: '2026-11-12',
        occurrence_date: '2026-11-12',
        status: 'forecast',
      }),
      transaction({
        id: null,
        recurrence_id: 'r1',
        description: 'Aluguel',
        category_id: 'c2',
        expected_amount: 200000,
        expected_date: '2026-10-31',
        occurrence_date: '2026-10-31',
        status: 'overdue',
      }),
      transaction({ id: 't1', description: 'Feira', expected_date: '2026-11-10' }),
      transaction({
        id: null,
        recurrence_id: 'r2',
        description: 'Internet',
        category_id: 'c2',
        expected_amount: 12000,
        expected_date: '2026-11-15',
        occurrence_date: '2026-11-15',
        status: 'open',
      }),
    ],
    currency: 'BRL',
  };
}

function seed() {
  return {
    accounts: [
      account({ id: 'a1', name: 'Conta principal', is_default: true, balance_amount: 700000 }),
      account({ id: 'a2', name: 'Carteira', balance_amount: 50000 }),
      account({
        id: 'a3',
        name: 'Cartão Nu',
        kind: 'credit_card',
        credit_limit_amount: 500000,
        closing_day: 3,
        due_day: 10,
      }),
    ],
    categories: [
      category({ id: 'c1', name: 'Mercado', kind: 'expense', color: 'warning' }),
      category({ id: 'c2', name: 'Casa', kind: 'expense', color: 'info' }),
      category({ id: 'c4', name: 'Transporte', kind: 'expense', color: 'accent' }),
      category({ id: 'c3', name: 'Salário', kind: 'income', color: 'success' }),
      category({ id: 'c5', name: 'Freelas', kind: 'income', color: 'primary' }),
    ],
    transactions: [
      transaction({ id: 't1', description: 'Feira', category_id: 'c1', expected_amount: 10000 }),
      transaction({
        id: 't2',
        description: 'Luz',
        category_id: 'c2',
        status: 'settled',
        expected_amount: 20000,
        expected_date: '2026-11-03',
        settled_amount: 18000,
        settled_at: '2026-11-03',
        effective_date: '2026-11-03',
        difference_amount: -2000,
        difference_kind: 'saving',
      }),
      transaction({
        id: 't5',
        description: 'Gás',
        category_id: 'c2',
        status: 'settled',
        expected_amount: 10000,
        expected_date: '2026-11-02',
        settled_amount: 11500,
        settled_at: '2026-11-02',
        effective_date: '2026-11-02',
        difference_amount: 1500,
        difference_kind: 'loss',
      }),
      transaction({
        id: 't3',
        kind: 'income',
        description: 'Salário de novembro',
        category_id: 'c3',
        expected_amount: 600000,
      }),
      ...[1, 2, 3].map((number) =>
        transaction({
          id: `p${String(number)}`,
          account_id: 'a3',
          category_id: 'c2',
          description: 'Geladeira',
          expected_amount: 100000,
          expected_date: '2026-11-04',
          effective_date: number === 1 ? '2026-11-04' : `2026-${String(10 + number)}-04`,
          installment: { number, total: 3 },
          statement_period: `2026-${String(10 + number)}`,
        }),
      ),
      transaction({
        id: 't6',
        account_id: 'a3',
        category_id: 'c1',
        description: 'Padaria',
        expected_amount: 20000,
        expected_date: '2026-11-01',
        effective_date: '2026-11-01',
        statement_period: '2026-11',
      }),
      transaction({
        id: null,
        recurrence_id: 'r1',
        occurrence_date: '2026-10-31',
        expected_date: '2026-10-31',
        effective_date: '2026-11-01',
        status: 'overdue',
        description: 'Aluguel',
        category_id: 'c2',
        expected_amount: 200000,
      }),
      transaction({
        id: null,
        recurrence_id: 'r2',
        occurrence_date: '2026-11-15',
        expected_date: '2026-11-15',
        effective_date: '2026-11-15',
        status: 'open',
        description: 'Internet',
        category_id: 'c2',
        expected_amount: 12000,
      }),
      transaction({
        id: null,
        recurrence_id: 'r1',
        occurrence_date: '2026-11-30',
        expected_date: '2026-11-30',
        effective_date: '2026-11-30',
        status: 'forecast',
        description: 'Aluguel',
        category_id: 'c2',
        expected_amount: 200000,
      }),
      COPY,
      COPY_AUG,
    ],
    recurring: [
      recurring({
        id: 'r1',
        description: 'Aluguel',
        expected_amount: 200000,
        open_occurrence: { occurrence_date: '2026-10-31', status: 'overdue' },
      }),
      recurring({
        id: 'r2',
        description: 'Internet',
        expected_amount: 12000,
        rule: { ...RULE, month_day: 15, starts_on: '2026-01-15' },
        open_occurrence: { occurrence_date: '2026-11-15', status: 'open' },
      }),
    ],
    copies: { r1: [COPY, COPY_AUG] },
    statements: {
      a3: [
        statement('2026-11'),
        statement('2026-12', {
          total_amount: 100000,
          outstanding_amount: 100000,
          transaction_count: 1,
        }),
        statement('2026-13', {
          total_amount: 100000,
          outstanding_amount: 100000,
          transaction_count: 1,
        }),
      ],
    },
    transfers: [
      {
        id: 'tr1',
        from_account_id: 'a1',
        to_account_id: 'a2',
        amount: 5000,
        currency: 'BRL',
        transferred_on: '2026-11-04',
        description: 'Troco',
        owner_id: 'u1',
        visibility: 'personal',
        created_at: '2026-11-04T10:00:00Z',
        updated_at: '2026-11-04T10:00:00Z',
      },
    ],
    summary: summary(),
  };
}

function empty() {
  return {
    accounts: [account({ id: 'a1', name: 'Conta principal', is_default: true })],
    categories: [category({ id: 'c1', name: 'Mercado' })],
    transactions: [],
    recurring: [],
    copies: {},
    statements: {},
    transfers: [],
    summary: summary(),
  };
}

const problem = (status, code) => ({
  status,
  body: { type: 'about:blank', title: code, status, code },
});
const page = (items) => ({ body: { items, next_cursor: null } });
const HANG = { hang: true };

function matchPath(pattern, path) {
  const left = pattern.split('/');
  const right = path.split('/');
  if (left.length !== right.length) return null;
  const params = {};
  for (const [i, part] of left.entries()) {
    if (part.startsWith(':')) params[part.slice(1)] = decodeURIComponent(right[i]);
    else if (part !== right[i]) return null;
  }
  return params;
}

/** Rotas usadas pelas telas, no mesmo contrato dos testes da feature (`test-utils.tsx`). */
function financeRoutes(state) {
  const find = (list, id) => list.find((e) => e.id === id);
  return {
    'GET /me': () => ({ body: { id: 'u1', email: 'ana@exemplo.com', display_name: 'Ana Souza' } }),
    'GET /accounts': () => page(state.accounts),
    'GET /accounts/:id': (_c, { id }) => {
      const found = find(state.accounts, id);
      return found ? { body: found } : problem(404, 'not_found');
    },
    'GET /categories': (call) => {
      const kind = call.url.searchParams.get('kind');
      return page(state.categories.filter((e) => kind === null || e.kind === kind));
    },
    'GET /categories/:id': (_c, { id }) => {
      const found = find(state.categories, id);
      return found ? { body: found } : problem(404, 'not_found');
    },
    'DELETE /categories/:id': (_c, { id }) => {
      state.categories = state.categories.filter((e) => e.id !== id);
      return { status: 204 };
    },
    'GET /transactions': (call) => {
      const p = call.url.searchParams;
      const kind = p.get('kind');
      const account_id = p.get('account_id');
      const category_id = p.get('category_id');
      const repetition = p.get('repetition');
      const q = p.get('q')?.toLocaleLowerCase();
      const from = p.get('from');
      const to = p.get('to');
      return page(
        state.transactions.filter(
          (e) =>
            (kind === null || e.kind === kind) &&
            (account_id === null || e.account_id === account_id) &&
            (category_id === null || e.category_id === category_id) &&
            (repetition === null ||
              (repetition === 'recurring' ? e.recurrence_id !== null : e.recurrence_id === null)) &&
            (q === undefined || (e.description ?? '').toLocaleLowerCase().includes(q)) &&
            (from === null || e.effective_date >= from) &&
            (to === null || e.effective_date <= to),
        ),
      );
    },
    'GET /transactions/:id': (_c, { id }) => {
      const found = find(state.transactions, id);
      return found ? { body: found } : problem(404, 'not_found');
    },
    'POST /transactions/:id/settlement': (call, { id }) => {
      const found = find(state.transactions, id);
      if (!found) return problem(404, 'not_found');
      const { settled_amount, settled_at } = call.body;
      const difference_amount = settled_amount - found.expected_amount;
      Object.assign(found, {
        status: 'settled',
        settled_amount,
        settled_at,
        effective_date: settled_at,
        difference_amount,
        difference_kind: difference_amount === 0 ? null : difference_amount < 0 ? 'saving' : 'loss',
      });
      return { body: found };
    },
    'GET /transfers': () => page(state.transfers),
    'GET /transfers/:id': (_c, { id }) => {
      const found = find(state.transfers, id);
      return found ? { body: found } : problem(404, 'not_found');
    },
    'GET /recurring-transactions/:id': (_c, { id }) => {
      const found = find(state.recurring, id);
      return found ? { body: found } : problem(404, 'not_found');
    },
    'GET /recurring-transactions/:id/settled-transactions': (_c, { id }) =>
      page(state.copies[id] ?? []),
    'GET /credit-cards/:id/statements': (_c, { id }) => page(state.statements[id] ?? []),
    'GET /financial-summaries': () =>
      state.summary ? { body: state.summary } : problem(500, 'internal_error'),
  };
}

/** Intercepta `/api/**` no navegador: a API é simulada, sem servidor Rust (KNW-007). */
async function mockApi(context, state, override) {
  const routes = financeRoutes(state);
  // Só `/api/...`: um glob `**/api/**` também casaria `/src/shared/api/*.ts` do Vite.
  await context.route(
    (u) => u.pathname.startsWith('/api/'),
    async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const path = url.pathname.replace(/^\/api\/v1/, '');
      const method = request.method();
      let body;
      try {
        body = request.postDataJSON();
      } catch {
        body = undefined;
      }
      const call = { method, path, url, body };
      let reply = override?.(call, state);
      if (!reply) {
        reply = problem(404, 'not_found');
        for (const [key, handler] of Object.entries(routes)) {
          const [m, pattern] = key.split(' ');
          if (m !== method) continue;
          const params = matchPath(pattern, path);
          if (params === null) continue;
          reply = handler(call, params);
          break;
        }
      }
      // Resposta que nunca chega: mantém a tela no estado "carregando".
      if (reply.hang) return new Promise(() => undefined);
      const status = reply.status ?? 200;
      const problemish = status >= 400;
      try {
        await route.fulfill({
          status,
          contentType: problemish ? 'application/problem+json' : 'application/json',
          body: status === 204 || reply.body === undefined ? '' : JSON.stringify(reply.body),
        });
      } catch {
        /* página já fechada */
      }
      return undefined;
    },
  );
}

// ---------- servidor de desenvolvimento ----------

const HTML = `<!doctype html>
<html lang="pt-BR" data-theme="light">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light dark" />
    <title>Atria · evidência do Financeiro</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="${HARNESS_ENTRY}"></script>
  </body>
</html>`;

/** Página virtual do harness: só existe neste servidor, nunca no build de produção. */
function harnessPage() {
  return {
    name: 'atria-finance-evidence',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith(HARNESS_PATH)) return next();
        try {
          const html = await server.transformIndexHtml(req.url, HTML);
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.end(html);
        } catch (e) {
          next(e);
        }
        return undefined;
      });
    },
  };
}

function freePort() {
  return new Promise((resolve, reject) => {
    const probe = createNetServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

async function startVite() {
  const port = await freePort();
  const server = await createServer({
    root: WEB,
    configFile: join(WEB, 'vite.config.ts'),
    logLevel: 'error',
    clearScreen: false,
    plugins: [harnessPage()],
    server: { host: '127.0.0.1', port, strictPort: true, proxy: {}, hmr: false },
  });
  await server.listen();
  const url = `http://127.0.0.1:${String(port)}`;
  return { url, stop: () => server.close() };
}

// ---------- captura ----------

async function openPage(browser, { theme, size }) {
  const context = await browser.newContext({
    viewport: SIZES[size],
    reducedMotion: 'reduce',
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
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
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  return { page, context, errors };
}

const noOverflow = (page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const themeOf = (page) => page.evaluate(() => document.documentElement.dataset.theme);

async function axeCheck(page, tag) {
  const result = await new AxeBuilder({ page }).analyze();
  // Dias de fora do mês fora do contraste (DEC-010): seguem o protótipo, abaixo de 4,5:1 de
  // propósito. Só a regra color-contrast ignora esses nós; as outras regras os auditam.
  let skipped = 0;
  for (const v of result.violations.filter((x) => x.id === 'color-contrast')) {
    const kept = [];
    for (const node of v.nodes) {
      const outside = await page.evaluate(
        (sel) => !!document.querySelector(sel)?.closest('[data-outside]'),
        node.target.join(' '),
      );
      if (outside) skipped += 1;
      else kept.push(node);
    }
    v.nodes = kept;
  }
  result.violations = result.violations.filter((v) => v.nodes.length > 0);
  if (skipped > 0)
    console.log(
      `nota   ${tag}: dias de fora do mês fora do contraste (DEC-010) · ${skipped} nó(s)`,
    );
  const list = result.violations.map(
    (v) => `${v.id}(${String(v.nodes.length)}): ${v.nodes[0]?.target.join(' ') ?? ''}`,
  );
  const contrast =
    result.passes.some((p) => p.id === 'color-contrast') ||
    result.violations.some((v) => v.id === 'color-contrast') ||
    result.incomplete.some((v) => v.id === 'color-contrast');
  check(
    `${tag}: axe sem violações (inclusive color-contrast)`,
    result.violations.length === 0 && contrast,
    list.join(' | '),
  );
}

async function baseChecks(page, errors, tag, theme) {
  check(`${tag}: tema ${THEME_LABEL[theme]} aplicado`, (await themeOf(page)) === theme);
  check(`${tag}: sem rolagem horizontal`, await noOverflow(page));
  check(`${tag}: sem erro de JS`, errors.length === 0, errors.join(' | '));
  await axeCheck(page, tag);
}

async function gotoHarness(page, base, path) {
  await page.goto(`${base}${HARNESS_PATH}?path=${encodeURIComponent(path)}`);
  await page.locator('h1').first().waitFor({ timeout: 20000 });
  await page.evaluate(() => document.fonts.ready);
}

/** Cor do token do tema já resolvida (`rgb(...)`), para comparar com a cor calculada. */
const tokenColor = (page, token) =>
  page.evaluate((name) => {
    const probe = document.createElement('span');
    probe.style.color = `var(${name})`;
    document.body.append(probe);
    const color = getComputedStyle(probe).color;
    probe.remove();
    return color;
  }, token);

/** Nenhum elemento dentro de `scope` usa o vermelho do tema (classe `danger` ou a cor do token). */
async function noRed(page, scope) {
  const danger = await tokenColor(page, '--danger');
  return page.evaluate(
    ([sel, red]) => {
      const nodes = [...document.querySelectorAll(`${sel}, ${sel} *`)];
      const bad = nodes.filter((el) => {
        const s = getComputedStyle(el);
        const cls = typeof el.className === 'string' ? el.className : '';
        return /danger/i.test(cls) || s.color === red || s.backgroundColor === red;
      });
      return { ok: bad.length === 0, sample: bad.slice(0, 3).map((el) => el.textContent?.trim()) };
    },
    [scope, danger],
  );
}

async function settle(page, ms = 250) {
  await page.waitForTimeout(ms);
}

// ---------- cenários ----------

/** Cards da mesma linha do painel com topos e bases alinhados (desktop) ou uma coluna com a zona principal primeiro (360 px). */
async function checkPanelRows(page, tag, { size }) {
  await page.getByRole('region', { name: /Fechamento/ }).waitFor();
  await page.getByText('Para onde foi').first().waitFor();
  await settle(page, 400);
  const cells = await page.evaluate(() =>
    [...document.querySelectorAll('[data-zone][data-row]')].map((cell) => {
      const box = (cell.firstElementChild ?? cell).getBoundingClientRect();
      return {
        zone: cell.dataset.zone,
        row: cell.dataset.row,
        alone: cell.hasAttribute('data-alone'),
        top: box.top,
        bottom: box.bottom,
        left: box.left,
      };
    }),
  );
  if (size === 'desktop') {
    const rows = [...new Set(cells.map((c) => c.row))];
    const bad = [];
    for (const row of rows) {
      const pair = cells.filter((c) => c.row === row && !c.alone);
      if (pair.length !== 2) continue;
      if (Math.abs(pair[0].top - pair[1].top) > 1 || Math.abs(pair[0].bottom - pair[1].bottom) > 1)
        bad.push(row);
    }
    check(
      `${tag}: cards pareados com topos e bases alinhados`,
      cells.length >= 6 && bad.length === 0,
      bad.length > 0 ? `linhas ${bad.join(', ')}` : `${cells.length} cards`,
    );
  } else {
    const lefts = new Set(cells.map((c) => Math.round(c.left)));
    const lastMain = Math.max(...cells.filter((c) => c.zone === 'main').map((c) => c.top));
    const firstSide = Math.min(...cells.filter((c) => c.zone === 'side').map((c) => c.top));
    check(
      `${tag}: uma coluna com a zona principal primeiro`,
      lefts.size === 1 && lastMain < firstSide,
      `${lefts.size} coluna(s)`,
    );
  }
}

/** Todo `caption` da página fica recortado e nada dele aparece sobre o card. */
async function checkChartCaptions(page, tag) {
  await page.getByRole('region', { name: /Fechamento/ }).waitFor();
  await page.getByText('Para onde foi').first().waitFor();
  await settle(page, 400);
  const info = await page.evaluate(() => {
    const captions = [...document.querySelectorAll('caption')];
    return {
      count: captions.length,
      loose: captions.filter((c) => {
        // O recorte do contêiner invisível limita o que se vê: a parte do caption dentro dele.
        const r = c.getBoundingClientRect();
        const box = c.closest('figure > div')?.getBoundingClientRect();
        if (!box) return true;
        const w = Math.min(r.right, box.right) - Math.max(r.left, box.left);
        const h = Math.min(r.bottom, box.bottom) - Math.max(r.top, box.top);
        if (w > 1.5 || h > 1.5) return true;
        const figure = c.closest('figure');
        if (!figure) return true;
        const f = figure.getBoundingClientRect();
        const hit = document.elementFromPoint(f.left + f.width / 2, f.top + f.height / 2);
        return hit?.tagName === 'CAPTION';
      }).length,
    };
  });
  check(
    `${tag}: tabela dos gráficos sem texto solto`,
    info.count >= 2 && info.loose === 0,
    `${info.count} caption(s), ${info.loose} solto(s)`,
  );
}

const MONEY = /^R\$\s\d{1,3}(\.\d{3})*,\d{2}$/;
const plain = (s) => (s ?? '').replace(/[  ]/g, ' ').trim();

let recurringPosts = 0;

const scenarios = [
  {
    name: 'Painel',
    path: '/finance',
    combos: ALL,
    run: async (page, tag, { size }) => {
      const closing = page.getByRole('region', { name: /Fechamento/ });
      await closing.waitFor();
      await page.getByText('Para onde foi').first().waitFor();
      await settle(page, 400);
      const cols = await page.evaluate(() => {
        const zones = document.querySelector('[class*="zones"]');
        if (!zones) return -1;
        return getComputedStyle(zones).gridTemplateColumns.split(' ').filter(Boolean).length;
      });
      if (size === 'desktop')
        check(`${tag}: Painel em duas zonas`, cols === 2, `${cols} coluna(s)`);
      else check(`${tag}: Painel em uma coluna`, cols === 1, `${cols} coluna(s)`);
    },
  },
  {
    name: 'Painel com Cartões',
    group: 'painel',
    path: '/finance',
    combos: ALL,
    run: (page, tag, ctx) => checkPanelRows(page, tag, ctx),
  },
  {
    name: 'Painel sem Cartões',
    group: 'painel',
    path: '/finance',
    combos: ALL,
    world: () => ({ ...seed(), summary: { ...summary(), credit_cards: [] } }),
    run: (page, tag, ctx) => checkPanelRows(page, tag, ctx),
  },
  {
    name: 'Próximas movimentações',
    group: 'painel',
    path: '/finance',
    combos: PAIR,
    run: async (page, tag) => {
      const block = page.getByRole('region', { name: 'Próximas movimentações' });
      await block.waitFor();
      await settle(page);
      const income = block.locator('li').filter({ hasText: 'Salário' });
      const expense = block.locator('li').filter({ hasText: 'Feira' });
      check(
        `${tag}: Salário listado como Entrada`,
        /Entrada/.test(await income.innerText()),
        plain(await income.innerText()).replace(/\n/g, ' '),
      );
      check(`${tag}: saída listada como Saída`, /Saída/.test(await expense.innerText()));
      check(
        `${tag}: links Ver entradas e Ver saídas`,
        (await block.getByRole('link', { name: 'Ver entradas' }).isVisible()) &&
          (await block.getByRole('link', { name: 'Ver saídas' }).isVisible()),
      );
    },
  },
  {
    name: 'período no cabeçalho',
    group: 'painel',
    path: '/finance/expenses',
    combos: [
      ['light', 'desktop'],
      ['dark', 'desktop'],
    ],
    run: async (page, tag) => {
      await page.getByRole('link', { name: 'Feira' }).waitFor();
      await settle(page);
      const period = page.getByRole('button', { name: /Período/ }).first();
      const reports = page.getByRole('button', { name: 'Relatórios' });
      check(
        `${tag}: botão de período sem texto "Período" visível`,
        !/Período/.test(await period.innerText()),
        plain(await period.innerText()),
      );
      const hiddenLabel = await page.evaluate(() =>
        [...document.querySelectorAll('span')]
          .filter((n) => n.textContent === 'Período')
          .every(
            (n) => n.getBoundingClientRect().width <= 1 && n.getBoundingClientRect().height <= 1,
          ),
      );
      check(`${tag}: rótulo "Período" só para leitor de tela`, hiddenLabel);
      const a = await period.boundingBox();
      const b = await reports.boundingBox();
      check(
        `${tag}: período alinhado ao botão Relatórios`,
        Math.abs(a.y - b.y) <= 1 && Math.abs(a.y + a.height - (b.y + b.height)) <= 1,
        `período ${a.y}/${a.height} · relatórios ${b.y}/${b.height}`,
      );
    },
  },
  {
    name: 'lista sem largura sobrando',
    group: 'painel',
    path: '/finance/expenses',
    combos: ALL,
    run: async (page, tag) => {
      await page.getByRole('link', { name: 'Feira' }).waitFor();
      await settle(page);
      const view = page.getByRole('group', { name: 'Visualização' });
      const info = await view.evaluate((group) => {
        const buttons = [...group.querySelectorAll('button')];
        return {
          width: group.getBoundingClientRect().width,
          sum: buttons.reduce((total, button) => total + button.getBoundingClientRect().width, 0),
          icons: buttons.every(
            (button) => button.hasAttribute('title') && button.querySelector('svg'),
          ),
          count: buttons.length,
        };
      });
      check(
        `${tag}: seletor de visualização só com a largura dos botões`,
        info.count === 2 && Math.abs(info.width - info.sum) <= 4,
        `grupo ${info.width.toFixed(1)} px · botões ${info.sum.toFixed(1)} px`,
      );
      check(`${tag}: botões com title e ícone`, info.icons);
    },
  },
  {
    name: 'tabela dos gráficos sem texto solto',
    group: 'painel',
    path: '/finance',
    combos: PAIR,
    run: (page, tag) => checkChartCaptions(page, tag),
  },
  {
    name: 'seletor de período aberto',
    path: '/finance/expenses',
    combos: PAIR,
    run: async (page, tag) => {
      await page.getByRole('link', { name: 'Feira' }).waitFor();
      await page
        .getByRole('button', { name: /Período/ })
        .first()
        .click();
      const dialog = page.getByRole('dialog', { name: 'Escolher período' });
      await dialog.waitFor();
      await settle(page);
      const presets = (await dialog.locator('[aria-pressed]').allTextContents()).map(plain);
      const wanted = ['Este mês', 'Mês passado', 'Próximos 30 dias', 'Qualquer período'];
      check(
        `${tag}: seletor de período aberto com os presets`,
        wanted.every((w) => presets.includes(w)),
        presets.filter((p) => !/^\d+$/.test(p)).join(', '),
      );
    },
  },
  {
    name: 'intervalo no calendário do período',
    path: '/finance/expenses',
    combos: PAIR_ALT,
    run: async (page, tag) => {
      await page.getByRole('link', { name: 'Feira' }).waitFor();
      await page
        .getByRole('button', { name: /Período/ })
        .first()
        .click();
      const dialog = page.getByRole('dialog', { name: 'Escolher período' });
      await dialog.waitFor();
      await dialog.locator('[data-day="2026-11-09"]').click();
      await dialog.locator('[data-day="2026-11-20"]').click();
      await settle(page);
      const info = await dialog.evaluate((root) => {
        const days = [...root.querySelectorAll('[data-day]')];
        const base = days.find((d) => d.dataset.day === '2026-11-25');
        const baseBg = base ? getComputedStyle(base).backgroundColor : '';
        const between = days.filter(
          (d) => d.dataset.day > '2026-11-09' && d.dataset.day < '2026-11-20',
        );
        const marked = between.filter(
          (d) => /inRange/.test(d.className) && getComputedStyle(d).backgroundColor !== baseBg,
        );
        const edges = days
          .filter((d) => d.getAttribute('aria-pressed') === 'true')
          .map((d) => d.dataset.day);
        return { between: between.length, marked: marked.length, edges };
      });
      check(
        `${tag}: intervalo marcado no calendário com os dias entre destacados`,
        info.between === 10 && info.marked === 10 && info.edges.join() === '2026-11-09,2026-11-20',
        `${info.marked}/${info.between} dias entre · pontas ${info.edges.join(' e ')}`,
      );
    },
  },
  {
    name: 'foco pelo teclado no calendário',
    path: '/finance/expenses',
    combos: PAIR,
    run: async (page, tag) => {
      await page.getByRole('link', { name: 'Feira' }).waitFor();
      await page
        .getByRole('button', { name: /Período/ })
        .first()
        .click();
      const dialog = page.getByRole('dialog', { name: 'Escolher período' });
      await dialog.waitFor();
      let onDay = false;
      for (let i = 0; i < 20 && !onDay; i += 1) {
        await page.keyboard.press('Tab');
        onDay = await page.evaluate(
          () => document.activeElement?.hasAttribute('data-day') ?? false,
        );
      }
      await settle(page);
      const outline = await page.evaluate(() => {
        const el = document.activeElement;
        const s = getComputedStyle(el);
        return { style: s.outlineStyle, width: parseFloat(s.outlineWidth), day: el.dataset.day };
      });
      check(
        `${tag}: contorno de foco visível depois de Tab (≥ 2 px)`,
        onDay && outline.style !== 'none' && outline.width >= 2,
        `${outline.day ?? 'fora do calendário'} · ${outline.style} ${outline.width}px`,
      );
    },
  },
  {
    name: 'diálogo "Novo registro"',
    path: '/finance/expenses',
    combos: PAIR_ALT,
    run: async (page, tag) => {
      await page.getByRole('link', { name: 'Feira' }).waitFor();
      await page.getByRole('button', { name: 'Novo registro' }).first().click();
      const dialog = page.getByRole('dialog', { name: 'O que você quer registrar?' });
      await dialog.waitFor();
      await settle(page);
      const text = plain(await dialog.textContent());
      check(
        `${tag}: diálogo "Novo registro" aberto`,
        ['Entrada', 'Saída', 'Transferência', 'Categoria', 'Conta'].every((w) => text.includes(w)),
      );
    },
  },
  {
    name: 'aba Saídas',
    path: '/finance/expenses',
    combos: ALL,
    run: async (page, tag) => {
      await page.getByRole('link', { name: 'Feira' }).waitFor();
      await settle(page);
      const filters = page.getByRole('group', { name: 'Filtros' });
      const chips = await Promise.all(
        ['Todas', 'Recorrentes', 'Pontuais'].map((n) =>
          filters.getByRole('button', { name: n, exact: true }).isVisible(),
        ),
      );
      check(`${tag}: chips de repetição na aba Saídas`, chips.every(Boolean));
      const rows = await page.locator('li').evaluateAll((lis) =>
        lis
          .filter((li) => li.querySelector('a'))
          .map((li) => ({
            text: li.textContent ?? '',
            title: li.querySelector('a')?.textContent ?? '',
          })),
      );
      const rent = rows.filter((r) => r.title === 'Aluguel');
      const net = rows.find((r) => r.title === 'Internet');
      check(
        `${tag}: recorrente aberta, atrasada e previsão listadas`,
        rent.some((r) => r.text.includes('Atrasada')) &&
          rent.some((r) => r.text.includes('Previsão')) &&
          !!net?.text.includes('Prevista'),
      );
      const order = await page
        .locator('li')
        .filter({ hasText: 'Luz' })
        .first()
        .evaluate((li) => {
          const value = [...li.querySelectorAll('*')].find(
            (e) =>
              /^R\$/.test((e.textContent ?? '').replace(/\s/g, ' ').trim()) &&
              e.children.length === 0,
          );
          const badges = [...li.querySelectorAll('*')].filter(
            (e) => e.children.length === 0 && /Liquidada|Economizou/.test(e.textContent ?? ''),
          );
          if (!value || badges.length < 2) return false;
          const v = value.getBoundingClientRect();
          return badges.every((b) => b.getBoundingClientRect().top >= v.bottom - 1);
        });
      const recurringBadge = rent.every((r) => r.text.includes('Recorrente'));
      check(
        `${tag}: selos de status, "Recorrente" e diferença embaixo do valor`,
        order && recurringBadge,
      );
      const values = await page
        .locator('li')
        .evaluateAll((lis) =>
          lis
            .filter((li) => li.querySelector('a'))
            .flatMap((li) =>
              [...li.querySelectorAll('*')]
                .filter(
                  (e) =>
                    e.children.length === 0 &&
                    /R\$/.test(e.textContent ?? '') &&
                    !/Economizou|Pagou|Recebeu/.test(e.textContent ?? ''),
                )
                .map((e) => e.textContent ?? ''),
            ),
        );
      const bad = values.map(plain).filter((v) => !MONEY.test(v));
      check(
        `${tag}: valores no locale do usuário, sem "+" nem "−"`,
        values.length > 0 && bad.length === 0,
        bad.length ? bad.join(' | ') : `${values.length} valores`,
      );
      const red = await noRed(page, 'main li');
      check(`${tag}: atraso e perda sem vermelho`, red.ok, red.sample.join(' | '));
    },
  },
  {
    name: 'Nova saída com parcelas no cartão',
    path: '/finance/transactions/new?kind=expense',
    combos: PAIR,
    run: async (page, tag) => {
      await page.getByRole('heading', { level: 1, name: 'Nova saída' }).waitFor();
      await page.getByLabel('Conta', { exact: true }).click();
      await page.getByRole('option', { name: 'Cartão Nu' }).click();
      const installments = page.getByRole('textbox', { name: /Parcelas/ });
      await installments.waitFor();
      await installments.fill('3');
      await settle(page);
      check(`${tag}: campo "Parcelas" no cartão`, await installments.isVisible());
    },
  },
  {
    name: 'Nova saída com recorrência',
    path: '/finance/transactions/new?kind=expense',
    combos: PAIR_ALT,
    run: async (page, tag) => {
      await page.getByRole('heading', { level: 1, name: 'Nova saída' }).waitFor();
      await page.getByRole('checkbox', { name: 'Repetir' }).check();
      await settle(page, 400);
      const editor = await page
        .getByText(/Repete|Frequência|mensal|Mensal/)
        .first()
        .isVisible();
      check(`${tag}: editor da recorrência aberto`, editor);
      await page.getByRole('checkbox', { name: 'Repetir' }).scrollIntoViewIfNeeded();
    },
  },
  {
    name: 'seletor próprio aberto',
    path: '/finance/transactions/new?kind=expense',
    combos: PAIR,
    run: async (page, tag) => {
      await page.getByRole('heading', { level: 1, name: 'Nova saída' }).waitFor();
      await page.getByLabel('Categoria', { exact: true }).click();
      const list = page.getByRole('listbox');
      await list.waitFor();
      await settle(page);
      const native = await page.locator('select').count();
      check(
        `${tag}: seletor próprio aberto, sem <select>`,
        (await list.isVisible()) && native === 0 && (await list.getByRole('option').count()) === 4,
        `${await list.getByRole('option').count()} opções · ${native} select(s)`,
      );
    },
  },
  {
    name: 'grupos segmentados de tipo e visibilidade',
    path: '/finance/categories/new?kind=expense',
    combos: PAIR_ALT,
    run: async (page, tag) => {
      await page.getByRole('heading', { level: 1, name: 'Nova categoria' }).waitFor();
      await settle(page);
      const kind = page.getByRole('radiogroup', { name: 'Tipo' });
      const vis = page.getByRole('radiogroup', { name: 'Visibilidade' });
      check(
        `${tag}: grupos segmentados de tipo e visibilidade`,
        (await kind.isVisible()) &&
          (await vis.isVisible()) &&
          (await page.locator('select, input[type="radio"]:not([class])').count()) === 0,
      );
    },
  },
  {
    name: 'detalhe com o cartão de liquidação',
    path: '/finance/transactions/t1',
    combos: PAIR,
    run: async (page, tag) => {
      await page.getByRole('heading', { level: 1, name: 'Feira' }).waitFor();
      const card = page.getByRole('heading', { name: 'Liquidação' });
      await card.scrollIntoViewIfNeeded();
      await settle(page);
      check(
        `${tag}: cartão de liquidação no detalhe`,
        (await card.isVisible()) &&
          (await page.getByRole('button', { name: 'Liquidar' }).isVisible()),
      );
    },
  },
  {
    name: 'detalhe da liquidada',
    path: '/finance/transactions/t2',
    combos: PAIR_ALT,
    run: async (page, tag) => {
      await page.getByRole('heading', { level: 1, name: 'Luz' }).waitFor();
      await settle(page);
      check(
        `${tag}: "Desfazer liquidação" visível`,
        await page.getByRole('button', { name: 'Desfazer liquidação' }).first().isVisible(),
      );
    },
  },
  {
    name: 'edição da liquidada',
    path: '/finance/transactions/t2/edit',
    combos: PAIR,
    run: async (page, tag) => {
      await page.getByRole('heading', { level: 1, name: 'Editar saída' }).waitFor();
      await settle(page);
      const amount = page.getByRole('textbox', { name: /Valor previsto/ });
      const account = page.getByLabel('Conta', { exact: true });
      const date = page.getByLabel('Data prevista', { exact: true });
      check(
        `${tag}: valor, data e conta desabilitados na edição da liquidada`,
        (await amount.isDisabled()) && (await account.isDisabled()) && (await date.isDisabled()),
      );
    },
  },
  {
    name: 'recorrente atrasada',
    path: '/finance/recurring-transactions/r1',
    combos: PAIR_ALT,
    run: async (page, tag) => {
      await page.getByRole('heading', { level: 1, name: 'Aluguel' }).waitFor();
      await settle(page);
      check(
        `${tag}: "Pular esta ocorrência" visível`,
        await page.getByRole('button', { name: 'Pular esta ocorrência' }).isVisible(),
      );
      const red = await noRed(page, 'main');
      check(`${tag}: atraso sem vermelho na recorrente`, red.ok, red.sample.join(' | '));
    },
  },
  {
    name: 'recorrente, aba Liquidações',
    path: '/finance/recurring-transactions/r1?tab=settlements',
    combos: PAIR,
    run: async (page, tag) => {
      await page.getByRole('heading', { level: 1, name: 'Aluguel' }).waitFor();
      const rows = page.locator('li').filter({ has: page.getByRole('link', { name: 'Aluguel' }) });
      await rows.first().waitFor();
      await settle(page);
      const count = await rows.count();
      check(
        `${tag}: aba "Liquidações" com as cópias`,
        count === 2 &&
          (await page.getByRole('tab', { name: 'Liquidações' }).getAttribute('aria-selected')) ===
            'true',
        `${count} cópia(s)`,
      );
    },
  },
  {
    name: 'Configurações · categorias',
    path: '/finance/settings',
    combos: PAIR_ALT,
    run: async (page, tag) => {
      await page.getByText('Salário').first().waitFor();
      await settle(page);
      const ok = await page.evaluate(() => {
        const headings = [...document.querySelectorAll('h2, h3')].map((h) => h.textContent?.trim());
        return headings.includes('Entradas') && headings.includes('Saídas');
      });
      check(
        `${tag}: categorias em Entradas e Saídas`,
        ok && (await page.getByText('Mercado').first().isVisible()),
      );
    },
  },
  {
    name: 'detalhe da conta, "Mais ações"',
    path: '/finance/accounts/a2',
    combos: PAIR,
    run: async (page, tag) => {
      await page.getByRole('heading', { level: 1, name: 'Carteira' }).waitFor();
      await page.getByRole('button', { name: 'Mais ações' }).click();
      const menu = page.getByRole('menu');
      await menu.waitFor();
      await settle(page);
      check(
        `${tag}: menu "Mais ações" aberto com "Excluir"`,
        await menu.getByRole('menuitem', { name: 'Excluir' }).isVisible(),
      );
    },
  },
  {
    name: 'aba Faturas',
    path: '/finance/statements?card_id=a3',
    combos: PAIR_ALT,
    run: async (page, tag) => {
      await page
        .getByText(/parcela 1 de 3/)
        .first()
        .waitFor();
      await settle(page);
      check(
        `${tag}: aba Faturas com as parcelas`,
        (await page
          .getByText(/parcela 1 de 3/)
          .first()
          .isVisible()) &&
          (await page.getByRole('button', { name: 'Pagar fatura' }).first().isVisible()),
      );
    },
  },
  {
    name: 'pagamento da fatura',
    path: '/finance/credit-cards/a3/statements/2026-11/pay',
    combos: PAIR,
    run: async (page, tag) => {
      await page.getByRole('heading', { level: 1, name: 'Pagar fatura' }).waitFor();
      await settle(page, 400);
      check(
        `${tag}: pagamento da fatura`,
        (await page.getByLabel('Conta de origem').isVisible()) &&
          (await page.getByRole('button', { name: 'Pagar', exact: true }).isVisible()),
      );
    },
  },
  {
    name: 'categoria em uso',
    path: '/finance/categories/c1',
    combos: PAIR_ALT,
    override: (call) =>
      call.method === 'DELETE' && !call.url.searchParams.has('replacement_id')
        ? problem(409, 'category_replacement_required')
        : undefined,
    run: async (page, tag) => {
      await page.getByRole('heading', { level: 1, name: 'Mercado' }).waitFor();
      await page.getByRole('button', { name: 'Mais ações' }).click();
      await page.getByRole('menuitem', { name: 'Excluir' }).click();
      await page.getByRole('alertdialog').getByRole('button', { name: 'Excluir' }).click();
      const dialog = page.getByRole('alertdialog', { name: 'Excluir esta categoria?' });
      await dialog.getByText('Esta categoria está em uso.').waitFor();
      await settle(page, 400);
      check(
        `${tag}: diálogo de categoria em uso`,
        await dialog.getByLabel('Categoria de destino').isVisible(),
      );
    },
  },
  {
    name: 'liquidação recusada',
    path: '/finance/transactions/t1',
    combos: PAIR,
    override: (call) =>
      call.method === 'POST' && call.path === '/transactions/t1/settlement'
        ? problem(409, 'transaction_already_settled')
        : undefined,
    run: async (page, tag) => {
      await page.getByRole('heading', { level: 1, name: 'Feira' }).waitFor();
      await page.getByRole('button', { name: 'Liquidar' }).click();
      // Tira o ponteiro de cima do botão: a captura mostra o estado de repouso, não o hover.
      await page.mouse.move(0, 0);
      const toast = page.getByText('Esta movimentação já foi liquidada. A tela foi atualizada.');
      await toast.waitFor();
      await page.getByRole('button', { name: 'Liquidar' }).waitFor();
      await settle(page);
      const red = await noRed(page, 'main');
      check(
        `${tag}: aviso de liquidação recusada`,
        (await toast.isVisible()) &&
          (await page.getByRole('button', { name: 'Desfazer liquidação' }).count()) === 0,
      );
      check(`${tag}: tela sem vermelho depois da recusa`, red.ok, red.sample.join(' | '));
    },
  },
  {
    name: 'aba Saídas vazia',
    path: '/finance/expenses',
    combos: PAIR_ALT,
    world: empty,
    run: async (page, tag) => {
      const title = page.getByText('Nada registrado neste período.');
      await title.waitFor();
      // Em 360 px o estado fica abaixo dos filtros: rola até ele para a captura mostrá-lo.
      await title.scrollIntoViewIfNeeded();
      await settle(page);
      check(
        `${tag}: estado vazio com texto explicativo`,
        await page
          .getByText('Use “Novo registro” para registrar uma entrada ou saída.')
          .isVisible(),
      );
    },
  },
  {
    name: 'aba Saídas carregando',
    path: '/finance/expenses',
    combos: PAIR,
    override: (call) => (call.path === '/transactions' ? HANG : undefined),
    run: async (page, tag) => {
      const status = page.locator('[role="status"][aria-busy="true"]').first();
      await status.waitFor();
      // Em 360 px o estado fica abaixo dos filtros: rola até ele para a captura mostrá-lo.
      await status.scrollIntoViewIfNeeded();
      await settle(page);
      check(`${tag}: estado carregando visível`, await status.isVisible());
    },
  },
  {
    name: 'aba Saídas com erro',
    path: '/finance/expenses',
    combos: PAIR_ALT,
    override: (call) =>
      call.path === '/transactions' ? problem(500, 'internal_error') : undefined,
    run: async (page, tag) => {
      const alert = page
        .getByRole('alert')
        .filter({ hasText: 'Não foi possível carregar a lista' });
      await alert.waitFor();
      // Em 360 px o estado fica abaixo dos filtros: rola até ele para a captura mostrá-lo.
      await alert.scrollIntoViewIfNeeded();
      await settle(page);
      check(
        `${tag}: erro com "Tentar de novo"`,
        await alert.getByRole('button', { name: 'Tentar de novo' }).isVisible(),
      );
    },
  },
  {
    name: 'Nova saída sem categoria',
    group: 'formulario',
    path: '/finance/transactions/new?kind=expense',
    combos: ALL,
    run: async (page, tag) => {
      await page.getByRole('heading', { level: 1, name: 'Nova saída' }).waitFor();
      const field = page.getByLabel('Categoria', { exact: true });
      check(
        `${tag}: categoria começa em "Sem categoria"`,
        /Sem categoria/.test(await field.innerText()),
      );
      const link = page.getByRole('link', { name: 'Criar categoria' });
      check(`${tag}: link "Criar categoria" visível`, await link.isVisible());
      await link.scrollIntoViewIfNeeded();
      await settle(page);
    },
  },
  {
    name: 'Nova saída sem nenhuma categoria',
    group: 'formulario',
    path: '/finance/transactions/new?kind=expense',
    combos: ALL,
    world: () => ({ ...empty(), categories: [] }),
    run: async (page, tag) => {
      await page.getByRole('heading', { level: 1, name: 'Nova saída' }).waitFor();
      const help = page.getByText('Nenhuma categoria deste tipo ainda.');
      check(`${tag}: ajuda de estado vazio visível`, await help.isVisible());
      check(
        `${tag}: link "Criar categoria" visível`,
        await page.getByRole('link', { name: 'Criar categoria' }).isVisible(),
      );
      await settle(page);
    },
  },
  {
    name: 'valor com máscara',
    group: 'formulario',
    path: '/finance/transactions/new?kind=expense',
    combos: ALL,
    run: async (page, tag) => {
      await page.getByRole('heading', { level: 1, name: 'Nova saída' }).waitFor();
      const amount = page.getByRole('textbox', { name: /Valor previsto/ });
      await amount.click();
      await page.keyboard.type('14500');
      await page.keyboard.press('Tab');
      check(
        `${tag}: digitar 14500 mostra R$ 14.500,00`,
        plain(await amount.inputValue()) === 'R$ 14.500,00',
        plain(await amount.inputValue()),
      );
      await amount.fill('');
      await amount.click();
      await amount.fill('14500,5');
      await page.keyboard.press('Tab');
      check(
        `${tag}: colar 14500,5 mostra R$ 14.500,50`,
        plain(await amount.inputValue()) === 'R$ 14.500,50',
        plain(await amount.inputValue()),
      );
      await amount.fill('14500');
      await page.keyboard.press('Tab');
      await settle(page);
    },
  },
  {
    name: 'salvar com Repetir',
    group: 'formulario',
    path: '/finance/transactions/new?kind=expense',
    combos: ALL,
    override: (call) => {
      if (call.method !== 'POST' || call.path !== '/recurring-transactions') return undefined;
      recurringPosts += 1;
      return {
        status: 201,
        body: {
          id: 'r9',
          currency: 'BRL',
          owner_id: 'u1',
          visibility: 'personal',
          open_occurrence: null,
          ...STAMP,
          ...call.body,
        },
      };
    },
    run: async (page, tag) => {
      recurringPosts = 0;
      await page.getByRole('heading', { level: 1, name: 'Nova saída' }).waitFor();
      await page.getByRole('textbox', { name: 'Descrição' }).fill('Aluguel');
      await page.getByLabel('Conta', { exact: true }).click();
      await page.getByRole('option').first().click();
      await page.getByRole('textbox', { name: /Valor previsto/ }).fill('2000');
      await page.getByRole('checkbox', { name: 'Repetir' }).check();
      await page.getByRole('button', { name: 'Salvar' }).dblclick();
      await page.getByRole('heading', { level: 1, name: 'Financeiro' }).waitFor();
      const notice = page.getByText(/Recorrência salva\./);
      await notice.waitFor();
      check(`${tag}: aviso "Recorrência salva." visível`, await notice.isVisible());
      check(
        `${tag}: tela de Saídas aberta`,
        (await page.evaluate(() => window.__evidence.href())).startsWith('/finance/expenses'),
      );
      const posts = recurringPosts;
      check(`${tag}: um único POST /recurring-transactions`, posts === 1, String(posts));
      await settle(page);
    },
  },
];

async function runScenarios(
  browser,
  base,
  list = scenarios.filter((sc) => !sc.group),
  { combos, suffix = '' } = {},
) {
  const shots = [];
  for (const sc of list) {
    for (const [theme, size] of combos ?? sc.combos) {
      const tag = `${sc.name} · ${SIZE_LABEL[size]} · ${THEME_LABEL[theme]}${suffix}`;
      const { page, context, errors } = await openPage(browser, { theme, size });
      try {
        const state = (sc.world ?? seed)();
        await mockApi(context, state, sc.override);
        await gotoHarness(page, base, sc.path);
        await sc.run(page, tag, { theme, size });
        await baseChecks(page, errors, tag, theme);
        shots.push({ size, label: tag, png: await page.screenshot() });
      } catch (e) {
        check(`${tag}: cenário executou`, false, String(e.message).split('\n')[0]);
      } finally {
        await context.close();
      }
    }
  }
  return shots;
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
  const context = await browser.newContext({ viewport: { width: 1640, height: 800 } });
  const page = await context.newPage();
  await page.setContent(html);
  await page.waitForFunction(() => [...document.images].every((i) => i.complete));
  mkdirSync(OUT, { recursive: true });
  const path = join(OUT, file);
  writeFileSync(path, await page.screenshot({ fullPage: true }));
  await context.close();
  console.log(`png: ${relative(ROOT, path)} (${shots.length} capturas)`);
}

/** Marcador do cursor no vídeo: o Playwright não desenha o ponteiro, então mostramos o `cursor` computado. */
const CURSOR_MARKER = () => {
  const dot = document.createElement('div');
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

async function recordFormVideo(browser, base) {
  mkdirSync(OUT, { recursive: true });
  const size = { width: 1280, height: 800 };
  const context = await browser.newContext({
    viewport: size,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    recordVideo: { dir: join(OUT, 'video-tmp'), size },
  });
  await context.clock.setFixedTime(NOW);
  await context.addInitScript((t) => {
    try {
      localStorage.setItem('atria_theme', t);
    } catch {
      /* sem armazenamento */
    }
  }, 'light');
  await context.addInitScript(CURSOR_MARKER);
  context.setDefaultTimeout(10000);
  const page = await context.newPage();
  const video = page.video();
  const pause = (ms) => page.waitForTimeout(ms);
  const clickAt = async (locator) => {
    const box = await locator.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 20 });
    await pause(400);
    await page.mouse.down();
    await page.mouse.up();
    await pause(500);
  };
  let posts = 0;
  const override = (call) => {
    if (call.method !== 'POST' || call.path !== '/recurring-transactions') return undefined;
    posts += 1;
    return {
      status: 201,
      body: {
        id: 'r9',
        currency: 'BRL',
        owner_id: 'u1',
        visibility: 'personal',
        open_occurrence: null,
        ...STAMP,
        ...call.body,
      },
    };
  };
  try {
    await mockApi(context, seed(), override);
    await gotoHarness(page, base, '/finance/transactions/new?kind=expense');
    await page.getByRole('heading', { level: 1, name: 'Nova saída' }).waitFor();
    await page.mouse.move(640, 760);
    await pause(1200);

    // 1. Descrição e conta, para o formulário ficar válido.
    await clickAt(page.getByRole('textbox', { name: 'Descrição' }));
    await page.keyboard.type('Aluguel', { delay: 140 });
    await pause(600);
    await clickAt(page.getByLabel('Conta', { exact: true }));
    await clickAt(page.getByRole('option').first());

    // 2. Valor com máscara: digita os dígitos e a máscara monta o R$.
    const amount = page.getByRole('textbox', { name: /Valor previsto/ });
    await clickAt(amount);
    await page.keyboard.type('14500', { delay: 450 });
    await pause(600);
    await page.keyboard.press('Tab');
    await pause(1400);
    check(
      'vídeo: digitar 14500 mostra R$ 14.500,00',
      plain(await amount.inputValue()) === 'R$ 14.500,00',
      plain(await amount.inputValue()),
    );

    // 3. Categoria: abre a lista e escolhe Mercado.
    const field = page.getByLabel('Categoria', { exact: true });
    await clickAt(field);
    await pause(900);
    await clickAt(page.getByRole('option', { name: /Mercado/ }));
    await pause(1000);
    check('vídeo: categoria Mercado escolhida', /Mercado/.test(await field.innerText()));

    // 4. Repetir e salvar: aviso de sucesso e tela de Saídas.
    const repeat = page.getByRole('checkbox', { name: 'Repetir' });
    await repeat.scrollIntoViewIfNeeded();
    await clickAt(repeat);
    await pause(1000);
    const save = page.getByRole('button', { name: 'Salvar' });
    await save.scrollIntoViewIfNeeded();
    await pause(600);
    await clickAt(save);
    await page.getByRole('heading', { level: 1, name: 'Financeiro' }).waitFor();
    const notice = page.getByText(/Recorrência salva\./);
    await notice.waitFor();
    check('vídeo: aviso "Recorrência salva." visível', await notice.isVisible());
    check('vídeo: um único POST /recurring-transactions', posts === 1, String(posts));
    await pause(2500);
  } catch (e) {
    check('vídeo: cenário executou', false, String(e.message).split('\n').slice(0, 3).join(' / '));
  } finally {
    await context.close();
  }
  const path = join(OUT, 'finance-formulario.webm');
  await video.saveAs(path);
  rmSync(join(OUT, 'video-tmp'), { recursive: true, force: true });
  console.log(`video: ${relative(ROOT, path)}`);
}

// ---------- principal ----------

const EVIDENCES = {
  formulario: async (browser, base) => {
    // As checagens (dois temas, duas larguras, axe) não gravam vídeo; o vídeo é um contexto à parte.
    await runScenarios(
      browser,
      base,
      scenarios.filter((sc) => sc.group === 'formulario'),
    );
    await recordFormVideo(browser, base);
  },
  painel: async (browser, base) => {
    const list = scenarios.filter((sc) => sc.group === 'painel');
    const shots = await runScenarios(browser, base, list);
    // O Firefox recortava mal o `caption` da tabela dos gráficos: confere o painel nele também.
    const gecko = await firefox.launch();
    try {
      const only = list.filter((sc) =>
        ['Painel com Cartões', 'tabela dos gráficos sem texto solto'].includes(sc.name),
      );
      const extra = await runScenarios(gecko, base, only, {
        combos: [
          ['light', 'desktop'],
          ['dark', 'desktop'],
        ],
        suffix: ' · Firefox',
      });
      shots.push(...extra);
    } finally {
      await gecko.close();
    }
    await sheet(browser, {
      title:
        'TASK-17 · painel e listas do Financeiro (RF-04, RF-05, RF-09, RF-10, RF-15) · Chromium e Firefox, API simulada, relógio em 05/11/2026',
      file: 'finance-painel.png',
      shots,
      scale: { desktop: 0.5, mobile: 0.62 },
    });
  },
  telas: async (browser, base) => {
    const shots = await runScenarios(browser, base);
    await sheet(browser, {
      title:
        'TASK-22 · telas do Financeiro (RNF-06, RNF-08, RNF-09, RNF-10, PD-48 a PD-59) · harness da feature, API simulada, relógio em 05/11/2026',
      file: 'finance-telas.png',
      shots,
      scale: { desktop: 0.5, mobile: 0.62 },
    });
  },
};

const wanted = process.argv.slice(2);
const names = wanted.length > 0 ? wanted : Object.keys(EVIDENCES);
const unknown = names.filter((n) => !(n in EVIDENCES));
if (unknown.length > 0) {
  console.error(`Evidência desconhecida: ${unknown.join(', ')}. Use telas, formulario ou painel.`);
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
