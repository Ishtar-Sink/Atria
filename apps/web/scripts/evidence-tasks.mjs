// Evidências visuais da TASK-24 (telas de Tarefas), sem passo manual: sobe o Vite numa porta livre
// (API `createServer`), serve uma página virtual que carrega `src/features/tasks/evidence/harness.tsx`
// (as rotas da feature num roteador em memória, com os providers e o layout do app), simula a API no
// navegador com fixtures em memória, confere o estado no DOM antes de cada captura e monta a prancha
// (PNG) em vostok/work/tasks/SPEC-001/evidence/TASK-24/.
// Uso: node apps/web/scripts/evidence-tasks.mjs telas
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
const OUT = join(ROOT, 'vostok', 'work', 'tasks', 'SPEC-001', 'evidence', 'TASK-24');

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
    <title>Atria · evidência das tarefas</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/features/tasks/evidence/harness.tsx"></script>
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

const RULE_BASE = { interval: 1, starts_on: '2026-11-01', time: '', timezone: ZONE, weekdays: [] };

function makeTask(id, title, extra = {}) {
  return {
    id,
    owner_id: 'u1',
    title,
    description: null,
    due_on: null,
    labels: [],
    is_recurring: false,
    recurrence: null,
    completed_at: null,
    visibility: 'personal',
    created_at: '2026-10-28T13:00:00Z',
    updated_at: '2026-11-02T18:30:00Z',
    ...extra,
  };
}

function fixtures() {
  return [
    makeTask('t-luz', 'Pagar a conta de luz', { due_on: '2026-11-03', labels: ['casa', 'contas'] }),
    makeTask('t-dentista', 'Marcar consulta no dentista', {
      due_on: TODAY,
      labels: ['saúde'],
    }),
    makeTask('t-lampada', 'Trocar a lâmpada da sala', { labels: ['casa'] }),
    makeTask('t-carro', 'Renovar o documento do carro', {
      due_on: '2026-11-04',
      completed_at: '2026-11-04T13:10:00Z',
    }),
    makeTask('r-alonga', 'Alongamento da manhã', {
      description: 'Cinco minutos ao acordar, sem pressa.',
      labels: ['saúde', 'rotina'],
      is_recurring: true,
      recurrence: { ...RULE_BASE, frequency: 'daily' },
    }),
    makeTask('r-agua', 'Beber dois litros de água', {
      is_recurring: true,
      recurrence: { ...RULE_BASE, frequency: 'daily' },
    }),
    makeTask('r-revisao', 'Revisão da semana', {
      labels: ['rotina'],
      is_recurring: true,
      recurrence: { ...RULE_BASE, frequency: 'weekly', weekdays: ['thu'] },
    }),
  ];
}

function addDaysIso(iso, days) {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function occurrencesOf(tasks, done, from, to) {
  const items = [];
  for (let day = from; day <= to; day = addDaysIso(day, 1)) {
    const weekday = new Date(`${day}T00:00:00Z`).getUTCDay();
    for (const task of tasks.filter((item) => item.is_recurring)) {
      const { frequency, weekdays } = task.recurrence;
      if (
        frequency === 'weekly' &&
        !weekdays.includes(['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][weekday])
      )
        continue;
      items.push({
        task_id: task.id,
        occurrence_date: day,
        completed: done.has(`${task.id}:${day}`),
      });
    }
  }
  return items;
}

/** Modos: normal, empty (sem tarefas), loading (respostas seguradas) e error (500 na listagem). */
function installApi(context, mode, gate) {
  const tasks = fixtures();
  const done = new Set([`r-agua:${TODAY}`]);
  return context.route(
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
      if (path === '/me')
        return reply({ id: 'u1', email: 'ana@exemplo.com', display_name: 'Ana Maria Souza' });
      if (path === '/me/preferences') return reply({});
      if (path.startsWith('/tasks') && mode === 'loading') {
        await gate;
        return reply({ title: 'Indisponível', code: 'unavailable' }, 503);
      }
      if (path.startsWith('/tasks') && mode === 'error') {
        return reply({ title: 'Erro interno', code: 'internal_error' }, 500);
      }
      const q = url.searchParams;
      if (path === '/tasks/occurrences' && method === 'GET') {
        const list = mode === 'empty' ? [] : tasks;
        return reply({ items: occurrencesOf(list, done, q.get('from'), q.get('to')) });
      }
      if (path === '/tasks' && method === 'GET') {
        let items = mode === 'empty' ? [] : tasks;
        if (q.get('recurring') !== null)
          items = items.filter((t) => String(t.is_recurring) === q.get('recurring'));
        if (q.get('status') === 'open') items = items.filter((t) => t.completed_at === null);
        if (q.get('status') === 'completed') items = items.filter((t) => t.completed_at !== null);
        if (q.get('label')) items = items.filter((t) => t.labels.includes(q.get('label')));
        if (q.get('q'))
          items = items.filter((t) => t.title.toLowerCase().includes(q.get('q').toLowerCase()));
        return reply({ items, next_cursor: null });
      }
      const detail = path.match(/^\/tasks\/([^/]+)$/);
      if (detail && method === 'GET') {
        const task = tasks.find((t) => t.id === detail[1]);
        return task ? reply(task) : reply({ title: 'Não encontrada', code: 'not_found' }, 404);
      }
      const completion = path.match(/^\/tasks\/([^/]+)\/completion$/);
      if (completion) {
        const date =
          q.get('occurrence_date') ?? JSON.parse(request.postData() ?? '{}').occurrence_date;
        if (date) done[method === 'DELETE' ? 'delete' : 'add'](`${completion[1]}:${date}`);
        return route.fulfill({ status: 204 });
      }
      return reply({ title: 'Não encontrada', code: 'not_found' }, 404);
    },
  );
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
  await installApi(context, mode, gate);
  const page = await context.newPage();
  await page.clock.setFixedTime(NOW);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  return { page, context, errors, release };
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
        const { page, context, errors, release } = await openPage(browser, {
          theme,
          size,
          mode: sc.mode,
          tall: sc.tall,
        });
        try {
          await gotoApp(page, base, sc.path);
          await sc.run(page, tag, { theme, size });
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

const scenarios = [
  {
    name: 'lista',
    path: '/tasks?status=all',
    run: async (page, tag) => {
      await page.getByRole('link', { name: 'Alongamento da manhã' }).waitFor();
      check(
        `${tag}: nenhuma caixa de seleção para concluir`,
        (await main(page).locator('input[type="checkbox"], [role="checkbox"]').count()) === 0,
      );
      const button = page.getByRole('button', { name: 'Concluir hoje: Alongamento da manhã' });
      const text = ((await button.textContent()) ?? '').trim();
      check(
        `${tag}: botão "Concluir hoje: Alongamento da manhã" só com o ícone e aria-pressed`,
        text === '' &&
          (await button.locator('svg').count()) === 1 &&
          (await button.getAttribute('aria-pressed')) === 'false',
        `texto "${text}"`,
      );
      check(
        `${tag}: selos "Aberta hoje" e "Feita hoje"`,
        (await page.getByText('Aberta hoje', { exact: true }).first().isVisible()) &&
          (await page.getByText('Feita hoje', { exact: true }).first().isVisible()),
      );
      const done = page.getByRole('link', { name: 'Renovar o documento do carro' });
      const style = await done.evaluate((el) => {
        const s = getComputedStyle(el);
        return { line: s.textDecorationLine, color: s.color };
      });
      const muted = await tokenColor(page, '--text-muted');
      check(
        `${tag}: concluída riscada em token neutro`,
        style.line.includes('line-through') && style.color === muted,
        `${style.line} ${style.color}`,
      );
      const danger = [
        await tokenColor(page, '--danger'),
        await tokenColor(page, '--danger-soft', 'background-color'),
      ];
      const row = page.getByRole('listitem').filter({ hasText: 'Pagar a conta de luz' }).last();
      const colors = await row.evaluate((el) =>
        [el, ...el.querySelectorAll('*')].flatMap((n) => {
          const s = getComputedStyle(n);
          return [s.color, s.backgroundColor, s.borderTopColor];
        }),
      );
      const body = (await main(page).innerText()).toLowerCase();
      check(
        `${tag}: pendência sem a cor de perigo e sem contador`,
        !colors.some((c) => danger.includes(c)) && !/atrasad|\d+\s+(pendente|vencid)/.test(body),
      );
      check(
        `${tag}: etiquetas em pills · ${await page.getByRole('list', { name: 'Etiquetas' }).count()} grupos`,
        (await page.getByRole('list', { name: 'Etiquetas' }).count()) >= 2,
      );
    },
  },
  {
    name: 'por dia com Relatórios',
    path: '/tasks?view=day&status=all&range=week',
    run: async (page, tag) => {
      await page.getByRole('heading', { level: 2, name: 'Hoje' }).waitFor();
      const groups = await main(page).locator('section[aria-label]').count();
      check(`${tag}: lista agrupada por dia · ${groups} grupos`, groups >= 2);
      await page.getByRole('button', { name: 'Relatórios' }).click();
      const item = page.getByRole('menuitem', { name: 'Tarefas concluídas e abertas' });
      await item.waitFor();
      check(
        `${tag}: menu "Relatórios" aberto · item "Tarefas concluídas e abertas"`,
        (await item.isVisible()) && (await inViewport(item)),
        await page.evaluate(() => window.__box),
      );
    },
  },
  {
    name: 'filtro de etiqueta',
    path: '/tasks?label=casa',
    run: async (page, tag) => {
      await page.getByRole('link', { name: 'Pagar a conta de luz' }).waitFor();
      const href = await hrefOf(page);
      check(`${tag}: ?label=casa na URL`, href.includes('label=casa'), href);
      const items = page.locator('main#conteudo ul > li').filter({ has: page.getByRole('link') });
      const total = await items.count();
      const withLabel = await items.filter({ hasText: 'casa' }).count();
      check(
        `${tag}: só tarefas com a etiqueta "casa"`,
        total >= 1 && total === withLabel,
        `${withLabel} de ${total}`,
      );
    },
  },
  {
    name: 'lista vazia',
    path: '/tasks',
    mode: 'empty',
    run: async (page, tag) => {
      const title = page.getByText('Nada marcado para hoje.');
      await title.waitFor();
      check(
        `${tag}: lista vazia com texto explicativo`,
        (await title.isVisible()) &&
          (await page
            .getByText('Quando houver uma tarefa para hoje, ela aparece aqui.')
            .isVisible()),
      );
    },
  },
  {
    name: 'carregando',
    path: '/tasks',
    mode: 'loading',
    run: async (page, tag) => {
      const status = page.getByRole('status').filter({ hasText: 'Carregando' });
      await status.waitFor();
      check(`${tag}: carregando visível`, await status.isVisible());
    },
  },
  {
    name: 'erro',
    path: '/tasks',
    mode: 'error',
    run: async (page, tag) => {
      const retry = page.getByRole('button', { name: 'Tentar de novo' });
      await retry.waitFor();
      check(
        `${tag}: erro com "Tentar de novo"`,
        (await retry.isVisible()) &&
          (await page.getByText('Não foi possível carregar as tarefas.').isVisible()),
      );
    },
  },
  {
    name: 'detalhe com Mais ações',
    path: '/tasks/r-alonga',
    run: async (page, tag) => {
      await page.getByRole('heading', { level: 1, name: 'Alongamento da manhã' }).waitFor();
      const cards = [];
      for (const name of ['Tarefa', 'Anotações', 'Registro']) {
        cards.push(await page.getByRole('heading', { level: 2, name, exact: true }).isVisible());
      }
      check(`${tag}: cartões Tarefa, Anotações e Registro`, cards.every(Boolean), cards.join(','));
      const complete = page.getByRole('button', { name: 'Concluir hoje', exact: true });
      const text = ((await complete.textContent()) ?? '').trim();
      check(`${tag}: botão "Concluir hoje" com texto no detalhe`, text === 'Concluir hoje', text);
      await page.getByRole('button', { name: 'Mais ações' }).click();
      const del = page.getByRole('menuitem', { name: 'Excluir' });
      await del.waitFor();
      check(
        `${tag}: "Mais ações" aberto · "Excluir" visível`,
        (await del.isVisible()) && (await inViewport(del)),
        await page.evaluate(() => window.__box),
      );
    },
  },
  {
    name: 'aba Ocorrências',
    path: '/tasks/r-alonga?tab=occurrences',
    run: async (page, tag) => {
      const panel = page.getByRole('tabpanel');
      await panel.getByText('Cada dia é concluído separadamente.', { exact: false }).waitFor();
      const days = await panel
        .locator('li')
        .filter({ has: page.getByRole('button') })
        .count();
      check(`${tag}: Ocorrências com hoje e os seis dias seguintes · ${days} dias`, days === 7);
    },
  },
  {
    name: 'formulário com etiquetas e recorrência semanal',
    path: '/tasks/new',
    tall: true,
    run: async (page, tag, { size }) => {
      await page.getByRole('textbox', { name: 'Título' }).fill('Revisão da semana');
      await page.getByRole('radio', { name: 'Recorrente' }).click();
      await page.getByRole('button', { name: /^Frequência/ }).click();
      await page.getByRole('option', { name: 'Semanal' }).click();
      await page.getByRole('checkbox', { name: 'segunda-feira' }).click();
      await page.getByRole('checkbox', { name: 'quarta-feira' }).click();
      const labels = page.getByRole('textbox', { name: 'Etiquetas' });
      await labels.fill('casa');
      await labels.press('Enter');
      await labels.fill('saúde');
      await labels.press(',');
      const pills = await page
        .getByRole('list', { name: 'Etiquetas adicionadas' })
        .getByRole('listitem')
        .count();
      check(`${tag}: etiquetas em pills · ${pills} pills`, pills === 2);
      const days = page.getByText('Dias da semana');
      check(
        `${tag}: recorrência semanal com os dias da semana`,
        (await days.isVisible()) &&
          (await page.getByRole('checkbox', { name: 'segunda-feira' }).isChecked()) &&
          (await page.getByRole('checkbox', { name: 'quarta-feira' }).isChecked()),
      );
      const native = await page
        .locator('select, input[type="date"], input[type="time"], input[type="datetime-local"]')
        .count();
      check(
        `${tag}: nenhum <select> nem input date ou time nativo`,
        native === 0,
        `${native} nativo(s)`,
      );
      const save = await page.getByRole('button', { name: 'Salvar' }).boundingBox();
      const cancel = await page.getByRole('button', { name: 'Cancelar' }).boundingBox();
      check(
        `${tag}: "Cancelar" antes de "Salvar", à direita`,
        cancel.x < save.x && save.x + save.width > SIZES[size].width / 2,
      );
    },
  },
  {
    name: 'formulário com o calendário aberto',
    path: '/tasks/new',
    run: async (page, tag) => {
      const trigger = page.getByRole('button', { name: /^Data/ });
      await trigger.evaluate((el) => el.scrollIntoView({ block: 'center' }));
      await page.waitForTimeout(200);
      await trigger.click();
      const dialog = page.getByRole('dialog', { name: /Data/ });
      await dialog.waitFor();
      await dialog.evaluate((el) => el.scrollIntoView({ block: 'center' }));
      await page.waitForTimeout(250);
      check(
        `${tag}: calendário dentro da janela`,
        (await dialog.isVisible()) && (await inViewport(dialog)),
        await page.evaluate(() => window.__box),
      );
    },
  },
  {
    name: 'foco no botão de concluir',
    path: '/tasks',
    sizes: ['desktop'],
    run: async (page, tag) => {
      const focused = () =>
        page.evaluate(() => {
          const el = document.activeElement;
          const name = el?.getAttribute('aria-label') ?? '';
          return /^Concluir/.test(name) && el.getAttribute('aria-pressed') !== null;
        });
      await page.getByRole('link', { name: 'Alongamento da manhã' }).waitFor();
      for (let i = 0; i < 60 && !(await focused()); i += 1) await page.keyboard.press('Tab');
      const reached = await focused();
      const outline = await page.evaluate(() => {
        const s = getComputedStyle(document.activeElement);
        return { style: s.outlineStyle, width: parseFloat(s.outlineWidth), color: s.outlineColor };
      });
      check(
        `${tag}: foco no botão de concluir por Tab · contorno de foco visível ≥ 2 px`,
        reached && outline.style !== 'none' && outline.width >= 2,
        `${outline.style} ${outline.width}px ${outline.color}`,
      );
    },
  },
];

// ---------- principal ----------

const EVIDENCES = {
  telas: async (browser, base) => {
    const shots = await runScenarios(browser, base, scenarios);
    await sheet(browser, {
      title: 'TASK-24 · telas de Tarefas (RF-38, RF-39, CT-24, RNF-06, RNF-08, RNF-10)',
      file: 'tasks-telas.png',
      shots,
      scale: { desktop: 0.5, mobile: 0.62 },
    });
  },
};

const names = process.argv.slice(2);
const unknown = names.filter((n) => !(n in EVIDENCES));
if (names.length === 0 || unknown.length > 0) {
  console.error(
    `Evidência desconhecida ou ausente: ${unknown.join(', ') || '(nenhuma)'}. Use telas.`,
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
