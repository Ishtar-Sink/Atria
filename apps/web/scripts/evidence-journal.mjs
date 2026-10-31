// Evidências visuais da TASK-27 (telas do Diário), sem passo manual: sobe o Vite numa porta livre
// (API `createServer`), serve uma página virtual que carrega `src/features/journal/evidence/harness.tsx`
// (as rotas da feature num roteador em memória, com os providers e o layout do app), simula a API no
// navegador com fixtures em memória, confere o estado no DOM antes de cada captura e monta a prancha
// (PNG) em vostok/work/tasks/SPEC-001/evidence/TASK-27/.
// Uso: node apps/web/scripts/evidence-journal.mjs themes-widths|states-focus
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
const OUT = join(ROOT, 'vostok', 'work', 'tasks', 'SPEC-001', 'evidence', 'TASK-27');

const THEMES = ['light', 'dark'];
const SIZES = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 360, height: 760 },
};
const TALL = { desktop: 1100, mobile: 1300 };
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
    <title>Atria · evidência das notas</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/features/journal/evidence/harness.tsx"></script>
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

const EMOTION_NAMES = [
  ['e0000001-0000-4000-8000-000000000001', 'joy'],
  ['e0000001-0000-4000-8000-000000000002', 'sadness'],
  ['e0000001-0000-4000-8000-000000000003', 'anger'],
  ['e0000001-0000-4000-8000-000000000004', 'fear'],
  ['e0000001-0000-4000-8000-000000000005', 'anxiety'],
  ['e0000001-0000-4000-8000-000000000006', 'calm'],
  ['e0000001-0000-4000-8000-000000000007', 'gratitude'],
];
const EMO = Object.fromEntries(EMOTION_NAMES.map(([id, key]) => [key, id]));

function emotionFixtures() {
  const base = {
    owner_id: 'u1',
    visibility: 'personal',
    created_at: '2026-10-01T10:00:00Z',
    updated_at: '2026-10-01T10:00:00Z',
  };
  return [
    ...EMOTION_NAMES.map(([id, key]) => ({ ...base, id, name: null, system_key: key })),
    { ...base, id: 'e0000001-0000-4000-8000-000000000008', name: 'Saudade', system_key: null },
  ];
}

const link = (key, intensity) => ({
  emotion_id: EMO[key],
  deleted: false,
  name: null,
  system_key: key,
  ...(intensity ? { intensity } : {}),
});

function makeEntry(id, occurred_at, text, emotions, extra = {}) {
  return {
    id,
    owner_id: 'u1',
    occurred_at,
    text,
    emotions,
    visibility: 'personal',
    created_at: occurred_at,
    updated_at: occurred_at,
    ...extra,
  };
}

const ENTRY_ID = 'a1000000-0000-4000-8000-000000000001';

function fixtures() {
  return [
    makeEntry(
      ENTRY_ID,
      '2026-11-04T21:30:00-03:00',
      'Dia longo, mas terminei o relatório e jantei com calma.\nAmanhã começo mais cedo.',
      [link('calm', 4), link('gratitude', 5), link('anxiety', 2)],
    ),
    makeEntry(
      'a1000000-0000-4000-8000-000000000002',
      '2026-11-04T08:10:00-03:00',
      'Acordei com a cabeça cheia, mas a caminhada ajudou.',
      [link('anxiety', 3)],
    ),
    makeEntry(
      'a1000000-0000-4000-8000-000000000003',
      '2026-11-02T19:00:00-03:00',
      'Almoço em família no domingo. Rimos muito.',
      [link('joy', 5)],
    ),
    makeEntry(
      'a1000000-0000-4000-8000-000000000004',
      '2026-10-28T22:15:00-03:00',
      'Saudade de casa hoje.',
      [
        {
          emotion_id: 'e0000001-0000-4000-8000-000000000008',
          deleted: false,
          name: 'Saudade',
          system_key: null,
        },
      ],
    ),
    makeEntry(
      'a1000000-0000-4000-8000-000000000005',
      '2026-10-20T07:45:00-03:00',
      'Primeira semana sem pressa.',
      [],
    ),
  ];
}

/** Modos: normal, empty (sem entradas), loading (listagem segurada) e error (500 na listagem). */
async function installApi(context, mode, gate) {
  const entries = fixtures();
  const emotions = emotionFixtures();
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
      if (path === '/search' && method === 'GET') {
        return reply({ groups: [{ context: 'journal', items: [] }] });
      }
      if (path === '/emotions' && method === 'GET')
        return reply({ items: emotions, next_cursor: null });
      if (path.startsWith('/journal-entries') && mode === 'loading') {
        await gate;
        return reply({ title: 'Indisponível', code: 'unavailable' }, 503);
      }
      if (path.startsWith('/journal-entries') && mode === 'error') {
        return reply({ title: 'Erro interno', code: 'internal_error' }, 500);
      }
      if (path === '/journal-entries' && method === 'GET') {
        const q = url.searchParams;
        let items = mode === 'empty' ? [] : [...entries];
        if (q.get('from'))
          items = items.filter((e) => Date.parse(e.occurred_at) >= Date.parse(q.get('from')));
        if (q.get('to'))
          items = items.filter((e) => Date.parse(e.occurred_at) < Date.parse(q.get('to')));
        if (q.get('emotion_id'))
          items = items.filter((e) => e.emotions.some((m) => m.emotion_id === q.get('emotion_id')));
        return reply({ items, next_cursor: null });
      }
      const detail = path.match(/^\/journal-entries\/([^/]+)$/);
      if (detail && method === 'GET') {
        const found = entries.find((e) => e.id === detail[1]);
        return found
          ? reply(found)
          : reply({ title: 'Não encontrada', code: 'journal_entry_not_found' }, 404);
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

async function baseChecks(page, errors, tag, theme) {
  const current = await page.evaluate(() => document.documentElement.dataset.theme);
  check(`${tag}: tema ${THEME_LABEL[theme]} aplicado`, current === theme);
  check(`${tag}: sem rolagem horizontal`, await noOverflow(page));
  check(`${tag}: sem erro de JS`, errors.length === 0, errors.join(' | '));
  const result = await new AxeBuilder({ page }).analyze();
  // Dias de fora do mês fora do contraste (DEC-010): só os nós [data-outside], só na regra color-contrast.
  const violations = result.violations
    .map((v) =>
      v.id === 'color-contrast'
        ? { ...v, nodes: v.nodes.filter((n) => !/data-outside/.test(n.html)) }
        : v,
    )
    .filter((v) => v.nodes.length > 0);
  const summary = violations
    .map(
      (v) =>
        `${v.id} (${v.nodes
          .slice(0, 2)
          .map((n) => `${n.target.join(' ')} ${(n.any[0]?.message ?? '').slice(0, 160)}`)
          .join('; ')})`,
    )
    .join(' | ');
  check(`${tag}: axe sem violações (inclui color-contrast)`, violations.length === 0, summary);
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

/** Rola a área até o popover (como a pessoa faria), tira o mouse de cima e confere que ele cabe na janela. */
async function popoverBox(page, locator) {
  await page.mouse.move(0, 0);
  for (const block of ['center', 'start', 'end']) {
    await locator.evaluate((el, b) => el.scrollIntoView({ block: b }), block);
    await page.waitForTimeout(200);
    if (await inViewport(locator)) return true;
  }
  return false;
}

/** Nenhuma emoção (chip, ponto ou selo) usa a cor de perigo nem o fundo de perigo ([project/frontend-14]). */
async function noDangerColor(page, scope) {
  const danger = [await tokenColor(page, '--danger'), await tokenColor(page, '--danger-soft')];
  const used = await scope.evaluateAll((els) => {
    const out = new Set();
    for (const root of els) {
      for (const el of [root, ...root.querySelectorAll('*')]) {
        const s = getComputedStyle(el);
        out.add(s.color);
        out.add(s.backgroundColor);
        out.add(s.borderTopColor);
      }
    }
    return [...out];
  });
  const bad = used.filter((c) => danger.includes(c));
  check(`nenhuma emoção com a cor de perigo`, bad.length === 0, bad.join(' | '));
}

const themesWidths = [
  {
    name: 'lista com PeriodField aberto',
    path: '/journal',
    run: async (page, tag) => {
      await page.getByRole('link', { name: /Dia longo/ }).waitFor();
      const groups = await main(page).locator('section h2').count();
      check(`${tag}: entradas agrupadas por dia · ${groups} dias`, groups === 4, String(groups));
      await page.getByRole('button', { name: /Período/ }).click();
      const dialog = page.getByRole('dialog', { name: 'Escolher período' });
      await dialog.waitFor();
      await page.waitForTimeout(250);
      const presets = await dialog.locator('[aria-pressed]:not([data-day])').allTextContents();
      const names = presets.map((p) => p.trim());
      check(
        `${tag}: PeriodField aberto · 5 presets`,
        names.length === 5 &&
          ['Este mês', 'Mês passado', 'Últimos 30 dias', 'Este ano', 'Qualquer período'].every(
            (n) => names.includes(n),
          ) &&
          !names.includes('Próximos 30 dias'),
        names.join(' | '),
      );
      check(
        `${tag}: PeriodField dentro da janela`,
        await popoverBox(page, dialog),
        await page.evaluate(() => window.__box),
      );
      await noDangerColor(page, main(page).locator('ul[aria-label="Emoções da entrada"]'));
    },
  },
  {
    name: 'lista com menu Relatórios aberto',
    path: '/journal',
    run: async (page, tag) => {
      await page.getByRole('link', { name: /Dia longo/ }).waitFor();
      await page.getByRole('button', { name: 'Relatórios' }).click();
      const item = page.getByRole('menuitem', { name: 'Emoções no período' });
      await item.waitFor();
      const href = await item.getAttribute('href');
      const inside = await popoverBox(page, item);
      check(
        `${tag}: menu Relatórios aberto · item "Emoções no período"`,
        (await item.isVisible()) && inside && href === '/reports/journal-emo?from_module=journal',
        `${href} · ${await page.evaluate(() => window.__box)}`,
      );
    },
  },
  {
    name: 'formulário com emoções e calendário',
    path: '/journal/new',
    tall: true,
    run: async (page, tag) => {
      const fieldset = page.getByRole('group', { name: 'Emoções' });
      await fieldset.waitFor();
      const chips = await fieldset.locator('input[type="checkbox"]').count();
      check(`${tag}: emoções em chips · ${chips} chips`, chips === 8, String(chips));
      const disabledBefore = await fieldset
        .getByRole('radiogroup', { name: 'Intensidade de Ansiedade' })
        .getByRole('radio')
        .evaluateAll((els) => els.every((e) => e.disabled));
      check(`${tag}: intensidade desabilitada até marcar a emoção`, disabledBefore);
      for (const [emotion, level] of [
        ['Ansiedade', 4],
        ['Gratidão', 2],
      ]) {
        await fieldset.getByRole('checkbox', { name: emotion }).check();
        await fieldset
          .getByRole('radiogroup', { name: `Intensidade de ${emotion}` })
          .getByRole('radio', { name: `${level} de 5` })
          .check({ force: true });
      }
      const marked = await fieldset
        .locator('input[type="radio"]:checked')
        .evaluateAll((els) => els.map((e) => e.value));
      check(
        `${tag}: duas emoções marcadas com intensidade`,
        marked.length === 2 && marked.includes('4') && marked.includes('2'),
        marked.join(','),
      );
      await noDangerColor(page, fieldset);
      check(
        `${tag}: nenhum controle nativo de data, hora ou seleção`,
        (await page
          .locator('select, input[type="date"], input[type="time"], input[type="datetime-local"]')
          .count()) === 0,
      );
      await page
        .getByRole('button', { name: /Data e hora/ })
        .first()
        .click();
      const calendar = page
        .getByRole('dialog')
        .filter({ has: page.getByRole('button', { name: 'Hoje', exact: true }) });
      await calendar.first().waitFor();
      await page.waitForTimeout(250);
      check(
        `${tag}: calendário da data dentro da janela`,
        await popoverBox(page, calendar.first()),
        await page.evaluate(() => window.__box),
      );
    },
  },
  {
    name: 'entrada em cartões com Mais ações',
    path: `/journal/${ENTRY_ID}`,
    run: async (page, tag) => {
      await page.getByRole('heading', { level: 1 }).waitFor();
      const cards = [];
      for (const name of ['Entrada', 'Emoções', 'Registro']) {
        cards.push(await page.getByRole('heading', { level: 2, name, exact: true }).isVisible());
      }
      check(`${tag}: cartões Entrada, Emoções e Registro`, cards.every(Boolean), cards.join(','));
      check(
        `${tag}: "Ansiedade · 2/5" no cartão Emoções`,
        (await main(page).getByText('Ansiedade · 2/5').count()) === 1,
      );
      await noDangerColor(page, page.locator('section[aria-labelledby="journal-card-emotions"]'));
      await page.getByRole('button', { name: 'Mais ações' }).click();
      const del = page.getByRole('menuitem', { name: 'Excluir' });
      await del.waitFor();
      check(
        `${tag}: Mais ações aberto · item "Excluir"`,
        (await del.isVisible()) && (await popoverBox(page, del)),
        await page.evaluate(() => window.__box),
      );
    },
  },
];

const statesFocus = [
  {
    name: 'lista vazia',
    path: '/journal',
    mode: 'empty',
    run: async (page, tag) => {
      const title = page.getByText('Seu diário está em branco.');
      await title.waitFor();
      check(
        `${tag}: estado vazio · texto explicativo visível`,
        (await title.isVisible()) &&
          (await page
            .getByText('Quando quiser, registre a primeira entrada', { exact: false })
            .isVisible()),
      );
    },
  },
  {
    name: 'lista carregando',
    path: '/journal',
    mode: 'loading',
    run: async (page, tag) => {
      const status = page.getByRole('status').filter({ hasText: 'Carregando o diário' });
      await status.waitFor();
      check(`${tag}: estado carregando · indicador visível`, await status.isVisible());
    },
  },
  {
    name: 'lista com erro',
    path: '/journal',
    mode: 'error',
    run: async (page, tag) => {
      const retry = page.getByRole('button', { name: 'Tentar de novo' });
      await retry.waitFor();
      check(
        `${tag}: estado de erro · mensagem visível`,
        (await retry.isVisible()) &&
          (await page.getByText('Não foi possível carregar o diário.').isVisible()),
      );
    },
  },
  {
    name: 'formulário com foco por Tab',
    path: '/journal/new',
    tall: true,
    run: async (page, tag) => {
      await page.getByRole('group', { name: 'Emoções' }).waitFor();
      const seen = new Set();
      let last = null;
      for (let i = 0; i < 40; i += 1) {
        await page.keyboard.press('Tab');
        const info = await page.evaluate(() => {
          const el = document.activeElement;
          if (!el || el === document.body) return null;
          const s = getComputedStyle(el);
          const mark = el.closest('label')?.querySelector('span');
          const ms = mark ? getComputedStyle(mark) : null;
          return {
            tag: el.tagName,
            type: el.getAttribute('type') ?? '',
            name: el.getAttribute('aria-label') ?? el.textContent?.trim().slice(0, 20) ?? '',
            outline: `${s.outlineStyle} ${parseFloat(s.outlineWidth)}px`,
            outlineWidth: s.outlineStyle === 'none' ? 0 : parseFloat(s.outlineWidth),
            // controles escondidos (checkbox do chip, rádio do ponto): o anel vai no marcador do rótulo
            wrapperRing: ms
              ? ms.outlineStyle !== 'none' && parseFloat(ms.outlineWidth) >= 2
              : false,
            boxRing: (() => {
              const box = el.closest('label');
              const bs = box ? getComputedStyle(box) : null;
              return bs ? bs.outlineStyle !== 'none' && parseFloat(bs.outlineWidth) >= 2 : false;
            })(),
            ring: s.boxShadow !== 'none',
          };
        });
        if (info) {
          seen.add(`${info.tag}:${info.type}:${info.name}`);
          last = info;
        }
      }
      check(
        `${tag}: formulário navegado por Tab · ${seen.size} controles alcançados`,
        seen.size >= 8,
      );
      // foco no primeiro chip de emoção e no campo de texto, com o anel medido
      await page.getByRole('textbox', { name: 'Texto' }).focus();
      await page.keyboard.press('Tab');
      await page.keyboard.press('Shift+Tab');
      const ring = await page.evaluate(() => {
        const el = document.activeElement;
        const s = getComputedStyle(el);
        return {
          style: s.outlineStyle,
          width: parseFloat(s.outlineWidth),
          color: s.outlineColor,
          shadow: s.boxShadow,
        };
      });
      check(
        `${tag}: formulário navegado por Tab · contorno de foco visível (≥ 2 px)`,
        (ring.style !== 'none' && ring.width >= 2) || ring.shadow !== 'none',
        `${ring.style} ${ring.width}px ${ring.color} ${ring.shadow === 'none' ? '' : 'sombra'}`,
      );
      // foco num chip de emoção
      const chip = page.getByRole('group', { name: 'Emoções' }).getByRole('checkbox').first();
      await chip.focus();
      await page.keyboard.press('Tab');
      await page.keyboard.press('Shift+Tab');
      const chipRing = await chip.evaluate((el) => {
        const label = el.closest('label');
        const cs = getComputedStyle(label);
        const fs = getComputedStyle(el);
        return {
          focused: document.activeElement === el,
          label: `${cs.outlineStyle} ${parseFloat(cs.outlineWidth)}px`,
          labelOk: cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 2,
          own: fs.outlineStyle !== 'none' && parseFloat(fs.outlineWidth) >= 2,
        };
      });
      check(
        `${tag}: chip de emoção com foco · contorno de foco visível (≥ 2 px)`,
        chipRing.focused && (chipRing.labelOk || chipRing.own),
        chipRing.label,
      );
      await chip.focus();
    },
  },
];

// ---------- principal ----------

const EVIDENCES = {
  'themes-widths': async (browser, base) => {
    const shots = await runScenarios(browser, base, themesWidths);
    await sheet(browser, {
      title:
        'TASK-27 · telas do Diário nos dois temas e larguras (RF-44, RF-45, CT-27, RNF-08, RNF-10)',
      file: 'journal-themes-widths.png',
      shots,
      scale: { desktop: 0.5, mobile: 0.62 },
    });
  },
  'states-focus': async (browser, base) => {
    const shots = await runScenarios(browser, base, statesFocus);
    await sheet(browser, {
      title: 'TASK-27 · estados da lista e foco por teclado (RF-44, RNF-06, RNF-08, RNF-10)',
      file: 'journal-states-focus.png',
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
