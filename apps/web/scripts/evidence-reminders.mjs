// Evidências visuais de Lembretes (TASK-25 e TASK-19), sem passo manual: sobe o Vite numa porta livre
// (API `createServer`), serve uma página virtual que carrega `src/features/reminders/evidence/harness.tsx`
// (as rotas da feature num roteador em memória, com os providers e o layout do app), simula a API no
// navegador com fixtures em memória, confere o estado no DOM antes de cada captura e monta a prancha
// (PNG) em $VOSTOK_EVIDENCE (padrão vostok/work/tasks/SPEC-002/evidence/TASK-19/).
// Uso: node apps/web/scripts/evidence-reminders.mjs telas|push
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
const OUT =
  process.env.VOSTOK_EVIDENCE ??
  join(ROOT, 'vostok', 'work', 'tasks', 'SPEC-002', 'evidence', 'TASK-19');

const THEMES = ['light', 'dark'];
const SIZES = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 360, height: 760 },
};
const TALL = { desktop: 1400, mobile: 1900 };
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
    <title>Atria · evidência dos lembretes</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/features/reminders/evidence/harness.tsx"></script>
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

// ---------- API e navegador simulados ----------

const RULE = {
  interval: 1,
  starts_on: '2026-11-01',
  timezone: ZONE,
  weekdays: [],
  month_day: null,
  ends_on: null,
};
const MINUTE_AHEAD = new Date(NOW.getTime() + 60_000).toISOString();

function makeReminder(id, title, extra = {}) {
  return {
    id,
    owner_id: 'u1',
    kind: 'one_off',
    title,
    notes: null,
    remind_at: null,
    next_fire_at: null,
    rule: null,
    timezone: ZONE,
    visibility: 'personal',
    created_at: '2026-10-28T13:00:00Z',
    updated_at: '2026-11-02T18:30:00Z',
    ...extra,
  };
}

function fixtures() {
  return [
    makeReminder('rem-vitamina', 'Tomar a vitamina', {
      remind_at: MINUTE_AHEAD,
      next_fire_at: MINUTE_AHEAD,
    }),
    makeReminder('rem-encomenda', 'Buscar a encomenda na portaria', {
      remind_at: '2026-11-05T21:00:00Z',
      next_fire_at: '2026-11-05T21:00:00Z',
    }),
    makeReminder('rem-agua', 'Beber um copo de água', {
      kind: 'recurring',
      notes: 'Um copo a cada pausa, sem pressa.',
      next_fire_at: '2026-11-05T18:00:00Z',
      rule: { ...RULE, frequency: 'daily', time: '15:00' },
    }),
    makeReminder('rem-orcamento', 'Revisar o orçamento do mês', {
      kind: 'recurring',
      next_fire_at: '2026-11-09T12:00:00Z',
      rule: { ...RULE, frequency: 'weekly', weekdays: ['mon'], time: '09:00' },
    }),
    makeReminder('rem-marina', 'Ligar para a Marina no aniversário', {
      remind_at: '2026-11-12T11:00:00Z',
      next_fire_at: '2026-11-12T11:00:00Z',
    }),
  ];
}

/** Modos: normal, empty (sem lembretes), loading (respostas seguradas) e error (500 na listagem). */
function installApi(context, mode, gate, { push = 'on', role = 'user' } = {}) {
  const reminders = fixtures();
  const calls = { upcoming: 0, subscriptions: 0 };
  context.route(
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
        return reply({
          id: 'u1',
          email: 'ana@exemplo.com',
          display_name: 'Ana Maria Souza',
          role,
        });
      if (path === '/me/preferences') return reply({});
      if (path === '/reminders/upcoming') {
        calls.upcoming += 1;
        return reply({
          items:
            mode === 'empty'
              ? []
              : [{ reminder_id: 'rem-vitamina', fire_at: MINUTE_AHEAD, title: 'Tomar a vitamina' }],
        });
      }
      if (path === '/web-push/public-key') {
        if (push === 'off')
          return reply({ title: 'Web Push desligado', code: 'web_push_disabled' }, 404);
        return reply({ public_key: 'AQIDBAUGBwgJCg' });
      }
      if (path === '/push-subscriptions' && method === 'POST') {
        calls.subscriptions += 1;
        return reply(
          { id: 'sub-1', endpoint: 'https://push.exemplo.com/abc', created_at: NOW.toISOString() },
          201,
        );
      }
      if (path.startsWith('/push-subscriptions')) return route.fulfill({ status: 204 });
      if (path.startsWith('/reminders') && mode === 'loading') {
        await gate;
        return reply({ title: 'Indisponível', code: 'unavailable' }, 503);
      }
      if (path.startsWith('/reminders') && mode === 'error') {
        return reply({ title: 'Erro interno', code: 'internal_error' }, 500);
      }
      const q = url.searchParams;
      if (path === '/reminders' && method === 'GET') {
        let items = mode === 'empty' ? [] : reminders;
        if (q.get('kind')) items = items.filter((r) => r.kind === q.get('kind'));
        if (q.get('q'))
          items = items.filter((r) => r.title.toLowerCase().includes(q.get('q').toLowerCase()));
        return reply({ items, next_cursor: null });
      }
      const detail = path.match(/^\/reminders\/([^/]+)$/);
      if (detail && method === 'GET') {
        const found = reminders.find((r) => r.id === detail[1]);
        return found ? reply(found) : reply({ title: 'Não encontrado', code: 'not_found' }, 404);
      }
      return reply({ title: 'Não encontrado', code: 'not_found' }, 404);
    },
  );
  return calls;
}

/**
 * `Notification`, service worker e `pushManager` simulados: deixam escolher a permissão e contar os
 * pedidos e os disparos. A notificação real do sistema não aparece numa captura do Chromium sem interface.
 */
function installBrowserFakes(context, permission, { push_support = true } = {}) {
  return context.addInitScript(
    ([initial, supported]) => {
      const state = { permission: initial, requests: 0, shown: [], subscribes: 0 };
      class FakeNotification {
        constructor(title, options) {
          state.shown.push({ title, tag: options?.tag ?? null });
        }
        static get permission() {
          return state.permission;
        }
        static requestPermission() {
          state.requests += 1;
          state.permission = 'granted';
          return Promise.resolve('granted');
        }
      }
      window.Notification = FakeNotification;
      if (!supported) {
        // Navegador sem Web Push: nem `PushManager` nem service worker.
        delete window.PushManager;
        window.__fakes = state;
        return;
      }
      if (!('PushManager' in window)) window.PushManager = class PushManager {};
      const pushManager = {
        getSubscription: async () => null,
        subscribe: async () => {
          state.subscribes += 1;
          return {
            endpoint: 'https://push.exemplo.com/abc',
            toJSON: () => ({
              endpoint: 'https://push.exemplo.com/abc',
              keys: { p256dh: 'p256', auth: 'auth' },
            }),
            unsubscribe: async () => true,
          };
        },
      };
      const registration = { pushManager };
      Object.defineProperty(navigator, 'serviceWorker', {
        configurable: true,
        value: {
          register: async () => registration,
          getRegistration: async () => registration,
        },
      });
      window.__fakes = state;
    },
    [permission, push_support],
  );
}

const fakes = (page) => page.evaluate(() => window.__fakes);

// ---------- captura ----------

async function openPage(
  browser,
  {
    theme,
    size,
    mode = 'normal',
    tall = false,
    permission = 'default',
    push = 'on',
    role = 'user',
    push_support = true,
  },
) {
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
  const calls = installApi(context, mode, gate, { push, role });
  await installBrowserFakes(context, permission, { push_support });
  const page = await context.newPage();
  await page.clock.install({ time: NOW });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  return { page, context, errors, release, calls };
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

/** Espera o agendador consultar `/reminders/upcoming` e deixa o relógio do navegador chegar ao disparo. */
async function reachFireTime(page, calls) {
  for (let i = 0; i < 100 && calls.upcoming === 0; i += 1) await page.waitForTimeout(50);
  await page.waitForTimeout(150);
  await page.clock.fastForward(61_000);
  await page.waitForTimeout(200);
}

async function runScenarios(browser, base, scenarios) {
  const shots = [];
  for (const sc of scenarios) {
    for (const size of sc.sizes ?? ['desktop', 'mobile']) {
      for (const theme of THEMES) {
        const tag = `${sc.name} · ${SIZE_LABEL[size]} · ${THEME_LABEL[theme]}`;
        const { page, context, errors, release, calls } = await openPage(browser, {
          theme,
          size,
          mode: sc.mode,
          tall: sc.tall,
          permission: sc.permission,
          push: sc.push,
          role: sc.role,
          push_support: sc.push_support,
        });
        try {
          await gotoApp(page, base, sc.path);
          await sc.run(page, tag, { theme, size, calls });
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
const enableButton = (page) => page.getByRole('button', { name: 'Ativar notificações' });
const nativeControls = (page) =>
  page
    .locator('select, input[type="date"], input[type="time"], input[type="datetime-local"]')
    .count();

const scenarios = [
  {
    name: 'lista com notificações não pedidas',
    path: '/reminders',
    run: async (page, tag) => {
      await page.getByRole('link', { name: 'Tomar a vitamina' }).waitFor();
      const asked = (await fakes(page)).requests;
      check(
        `${tag}: nenhum pedido de permissão antes do clique · requestPermission ${asked} vez(es)`,
        asked === 0,
      );
      check(
        `${tag}: botão "Ativar notificações" visível com a permissão não pedida`,
        await enableButton(page).isVisible(),
      );
      const links = await main(page).locator('ul > li').getByRole('link').count();
      const repeats = await main(page).getByText('Repete', { exact: true }).count();
      check(
        `${tag}: lista de lembretes · ${links} lembretes, ${repeats} recorrentes`,
        links === 5 && repeats === 2,
      );
      const tone = await main(page).innerText();
      check(`${tag}: tom calmo, sem contador de atraso`, !/atrasad|vencid|urgente/i.test(tone));
    },
  },
  {
    name: 'lista agrupada por dia',
    path: '/reminders?view=day',
    run: async (page, tag) => {
      await page.getByRole('heading', { level: 2 }).first().waitFor();
      const groups = await main(page).locator('section[aria-label]').count();
      check(`${tag}: lista agrupada por dia · ${groups} grupos`, groups >= 3);
    },
  },
  {
    name: 'lista vazia',
    path: '/reminders',
    mode: 'empty',
    run: async (page, tag) => {
      const title = page.getByText('Nenhum lembrete por aqui.');
      await title.waitFor();
      check(
        `${tag}: lista vazia com texto explicativo`,
        (await title.isVisible()) &&
          (await page.getByText('Crie um lembrete e o Atria avisa na hora marcada.').isVisible()),
      );
    },
  },
  {
    name: 'carregando',
    path: '/reminders',
    mode: 'loading',
    run: async (page, tag) => {
      const status = page.getByRole('status').filter({ hasText: 'Carregando' });
      await status.waitFor();
      check(`${tag}: carregando visível`, await status.isVisible());
    },
  },
  {
    name: 'erro',
    path: '/reminders',
    mode: 'error',
    run: async (page, tag) => {
      const retry = page.getByRole('button', { name: 'Tentar de novo' });
      await retry.waitFor();
      check(
        `${tag}: erro com "Tentar de novo"`,
        (await retry.isVisible()) &&
          (await page.getByText('Não foi possível carregar os lembretes.').isVisible()),
      );
    },
  },
  {
    name: 'formulário com a recorrência aberta',
    path: '/reminders/new',
    tall: true,
    run: async (page, tag, { size }) => {
      await page.getByRole('textbox', { name: 'Título' }).fill('Beber um copo de água');
      await page.getByRole('radio', { name: 'Recorrente' }).click();
      const time = page.getByRole('textbox', { name: /^Horário/ });
      await time.waitFor();
      await time.fill('1500');
      await time.blur();
      const value = await time.inputValue();
      check(
        `${tag}: recorrência aberta com o horário · "${value}"`,
        (await time.isVisible()) &&
          value === '15:00' &&
          (await page.getByRole('button', { name: /^Frequência/ }).isVisible()),
      );
      check(
        `${tag}: nenhum <select> nem input date ou time nativo`,
        (await nativeControls(page)) === 0,
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
    path: '/reminders/new',
    run: async (page, tag) => {
      const trigger = page.getByRole('button', { name: /^Data e hora/ }).first();
      await trigger.evaluate((el) => el.scrollIntoView({ block: 'center' }));
      await page.waitForTimeout(200);
      await trigger.click();
      const dialog = page.getByRole('dialog').first();
      await dialog.waitFor();
      await dialog.evaluate((el) => el.scrollIntoView({ block: 'center' }));
      // O ponteiro fica longe do calendário: um dia sob o mouse ficaria no estado de hover.
      await page.mouse.move(2, 2);
      await page.waitForTimeout(250);
      check(
        `${tag}: calendário dentro da janela`,
        (await dialog.isVisible()) && (await inViewport(dialog)),
        await page.evaluate(() => window.__box),
      );
    },
  },
  {
    name: 'detalhe com Mais ações',
    path: '/reminders/rem-agua',
    run: async (page, tag) => {
      await page.getByRole('heading', { level: 1, name: 'Beber um copo de água' }).waitFor();
      const cards = [];
      for (const name of ['Lembrete', 'Anotações', 'Registro']) {
        cards.push(await page.getByRole('heading', { level: 2, name, exact: true }).isVisible());
      }
      check(
        `${tag}: cartões Lembrete, Anotações e Registro`,
        cards.every(Boolean),
        cards.join(','),
      );
      check(
        `${tag}: lembrete só avisa, sem ação de concluir`,
        (await page.getByText('Lembretes só avisam: não têm conclusão.').isVisible()) &&
          (await page.getByRole('button', { name: /Concluir/ }).count()) === 0,
      );
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
    name: 'notificações bloqueadas',
    path: '/reminders',
    permission: 'denied',
    run: async (page, tag) => {
      const text = page.getByText(/notificações do navegador estão bloqueadas/);
      await text.waitFor();
      const asked = (await fakes(page)).requests;
      check(
        `${tag}: bloqueada: texto de bloqueio sem botão de pedir de novo · requestPermission ${asked} vez(es)`,
        (await text.isVisible()) && (await enableButton(page).count()) === 0 && asked === 0,
      );
    },
  },
  {
    name: 'notificações ativas com Web Push',
    path: '/reminders',
    permission: 'granted',
    run: async (page, tag, { calls }) => {
      await page.getByText(/Notificações ativas/).waitFor();
      const toggle = page.getByRole('switch', { name: 'Receber com o Atria fechado' });
      await toggle.waitFor();
      await toggle.click();
      await page.waitForFunction(
        () => document.querySelector('[role="switch"]')?.getAttribute('aria-checked') === 'true',
      );
      const state = await fakes(page);
      check(
        `${tag}: ativa com Web Push: inscrição feita e interruptor ligado · ${calls.subscriptions} inscrição(ões)`,
        calls.subscriptions === 1 && state.subscribes === 1,
      );
      await reachFireTime(page, calls);
      const after = await fakes(page);
      check(
        `${tag}: notificação do navegador disparada uma vez com a aba aberta`,
        after.shown.length === 1 &&
          after.shown[0].title === 'Tomar a vitamina' &&
          after.shown[0].tag.startsWith('rem-vitamina:'),
        JSON.stringify(after.shown),
      );
    },
  },
  {
    name: 'aviso dentro do app',
    path: '/reminders',
    permission: 'denied',
    run: async (page, tag, { calls }) => {
      await page.getByRole('link', { name: 'Tomar a vitamina' }).waitFor();
      await reachFireTime(page, calls);
      const toast = page.locator('[aria-live="polite"]').filter({ hasText: 'Lembrete às' });
      await toast.waitFor();
      check(
        `${tag}: aviso dentro do app em aria-live="polite"`,
        (await toast.isVisible()) && (await toast.innerText()).includes('Tomar a vitamina'),
        (await toast.innerText()).replace(/\s+/g, ' '),
      );
      check(
        `${tag}: sem notificação do navegador com a permissão negada`,
        (await fakes(page)).shown.length === 0,
      );
    },
  },
  {
    name: 'foco no botão Ativar notificações',
    path: '/reminders',
    sizes: ['desktop'],
    run: async (page, tag) => {
      const focused = () =>
        page.evaluate(() => document.activeElement?.textContent?.trim() === 'Ativar notificações');
      await enableButton(page).waitFor();
      for (let i = 0; i < 60 && !(await focused()); i += 1) await page.keyboard.press('Tab');
      const reached = await focused();
      const outline = await page.evaluate(() => {
        const s = getComputedStyle(document.activeElement);
        return { style: s.outlineStyle, width: parseFloat(s.outlineWidth), color: s.outlineColor };
      });
      check(
        `${tag}: foco em "Ativar notificações" por Tab · contorno de foco visível ≥ 2 px`,
        reached && outline.style !== 'none' && outline.width >= 2,
        `${outline.style} ${outline.width}px ${outline.color}`,
      );
    },
  },
];

const NOTICE = 'p, div';
const instanceLink = (page) => page.getByRole('link', { name: 'Abrir Configurações › Instância' });

/** O aviso do cartão: calmo, com a cor do texto fora do vermelho de perigo. */
async function checkCalmNotice(page, tag, text) {
  const notice = page.locator(NOTICE).filter({ hasText: text }).last();
  await notice.waitFor();
  const colors = await notice.evaluate((el) => {
    const probe = document.createElement('span');
    probe.style.color = 'var(--danger)';
    document.body.append(probe);
    const danger = getComputedStyle(probe).color;
    probe.remove();
    const style = getComputedStyle(el);
    return { text: style.color, background: style.backgroundColor, danger };
  });
  check(
    `${tag}: aviso sem vermelho`,
    colors.text !== colors.danger && colors.background !== colors.danger,
    `texto ${colors.text} · fundo ${colors.background} · perigo ${colors.danger}`,
  );
}

const pushScenarios = [
  {
    name: 'push desligado · pessoa comum',
    path: '/reminders',
    permission: 'granted',
    push: 'off',
    run: async (page, tag) => {
      const text = page.getByText(/está desligado nesta instância/);
      await text.waitFor();
      check(
        `${tag}: aviso de push desligado visível, sem link para o administrador`,
        (await text.isVisible()) && (await instanceLink(page).count()) === 0,
      );
      await checkCalmNotice(page, tag, 'está desligado nesta instância');
    },
  },
  {
    name: 'push desligado · administrador',
    path: '/reminders',
    permission: 'granted',
    push: 'off',
    role: 'admin',
    run: async (page, tag) => {
      const link = instanceLink(page);
      await link.waitFor();
      const href = await link.getAttribute('href');
      check(
        `${tag}: link para Configurações › Instância · href ${href}`,
        (await link.isVisible()) && href === '/settings/instance',
      );
      await checkCalmNotice(page, tag, 'está desligado nesta instância');
    },
  },
  {
    name: 'navegador sem Web Push',
    path: '/reminders',
    permission: 'granted',
    push_support: false,
    run: async (page, tag) => {
      const text = page.getByText(/Este navegador não oferece o aviso/);
      await text.waitFor();
      check(
        `${tag}: aviso de navegador sem suporte visível, sem link`,
        (await text.isVisible()) && (await instanceLink(page).count()) === 0,
      );
      await checkCalmNotice(page, tag, 'Este navegador não oferece o aviso');
    },
  },
  {
    name: 'aparelho não inscrito',
    path: '/reminders',
    permission: 'granted',
    run: async (page, tag) => {
      const toggle = page.getByRole('switch', { name: 'Receber com o Atria fechado' });
      await toggle.waitFor();
      const text = page.getByText(/Este aparelho ainda não recebe/);
      check(
        `${tag}: interruptor desligado e pedido para ligar`,
        (await toggle.getAttribute('aria-checked')) === 'false' && (await text.isVisible()),
      );
      await checkCalmNotice(page, tag, 'Este aparelho ainda não recebe');
    },
  },
];

// ---------- principal ----------

const EVIDENCES = {
  telas: async (browser, base) => {
    const shots = await runScenarios(browser, base, scenarios);
    await sheet(browser, {
      title: 'TASK-25 · telas de Lembretes (RF-40, RF-41, RF-42, CT-25, RNF-06, RNF-08, RNF-10)',
      file: 'reminders-telas.png',
      shots,
      scale: { desktop: 0.5, mobile: 0.62 },
    });
  },
  push: async (browser, base) => {
    const shots = await runScenarios(browser, base, pushScenarios);
    await sheet(browser, {
      title: 'TASK-19 · avisos do Web Push em Lembretes (RF-16, CT-15, CB-07, FA-05, RNF-03)',
      file: 'reminders-push.png',
      shots,
      scale: { desktop: 0.5, mobile: 0.62 },
    });
  },
};

const names = process.argv.slice(2);
const unknown = names.filter((n) => !(n in EVIDENCES));
if (names.length === 0 || unknown.length > 0) {
  console.error(
    `Evidência desconhecida ou ausente: ${unknown.join(', ') || '(nenhuma)'}. Use telas ou push.`,
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
