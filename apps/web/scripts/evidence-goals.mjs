// Evidências visuais da TASK-23 (telas de Metas), sem passo manual: sobe o Vite numa porta livre
// (createServer da API do Vite) com uma página virtual que carrega src/features/goals/evidence/
// harness.tsx, simula a API no Chromium do Playwright e fotografa os estados nos temas claro e
// escuro, em 1440 px e em 360 px, conferindo o DOM antes de cada captura.
// Uso: node apps/web/scripts/evidence-goals.mjs [telas]   (sem argumento, gera "telas")
// Imprime "ok" ou "FALHA" por verificação e o caminho do PNG; sai com código 1 se algo falhar.
import AxeBuilder from '@axe-core/playwright';
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createServer as createNetServer } from 'node:net';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer as createViteServer } from 'vite';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = join(WEB, '..', '..');
const OUT = join(ROOT, 'vostok', 'work', 'tasks', 'SPEC-001', 'evidence', 'TASK-23');
const PAGE_PATH = '/__evidence-goals';
const HARNESS = '/src/features/goals/evidence/harness.tsx';

const THEMES = ['light', 'dark'];
const SIZES = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 360, height: 760 },
};
const SIZE_LABEL = { desktop: 'desktop 1440', mobile: '360 px' };
const THEME_LABEL = { light: 'claro', dark: 'escuro' };

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

/** Plugin que serve a página HTML virtual carregando o harness, sem arquivo novo no app. */
function evidencePage() {
  return {
    name: 'atria-evidence-goals-page',
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
    <title>Atria · evidência de Metas</title>
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

// ---------- API simulada (fixtures em memória) ----------

const NOW = '2026-10-01T12:00:00Z';
const USER = {
  id: '00000000-0000-4000-8000-000000000001',
  email: 'ana@atria.test',
  display_name: 'Ana Souza',
};

function goal(n, over) {
  return {
    id: `00000000-0000-4000-8000-0000000001${String(n).padStart(2, '0')}`,
    owner_id: USER.id,
    title: '',
    description: null,
    deadline: null,
    status: 'planned',
    labels: [],
    visibility: 'personal',
    milestone_count: 0,
    completed_milestone_count: 0,
    progress_percent: 0,
    created_at: NOW,
    updated_at: NOW,
    ...over,
  };
}

const MAIN_ID = goal(1, {}).id;
const GOALS = [
  goal(1, {
    title: 'Aprender violão',
    description: 'Tocar três músicas inteiras até o fim do ano, sem pressa e com prazer.',
    deadline: '2027-03-15',
    status: 'in_progress',
    labels: ['música', 'casa'],
    milestone_count: 4,
    completed_milestone_count: 1,
    progress_percent: 25,
  }),
  goal(2, {
    title: 'Reformar o escritório',
    deadline: '2025-10-12',
    status: 'in_progress',
    labels: ['casa'],
  }),
  goal(3, { title: 'Ler doze livros neste ano' }),
  goal(4, {
    title: 'Correr uma meia maratona',
    deadline: '2027-06-20',
    labels: ['saúde', 'casa'],
    milestone_count: 2,
  }),
  goal(5, {
    title: 'Organizar os documentos',
    status: 'completed',
    progress_percent: 100,
  }),
];

const MILESTONES = [
  ['Aprender os acordes básicos', true],
  ['Trocar de acorde sem olhar', false],
  ['Tocar uma música inteira', false],
  ['Tocar para um amigo', false],
].map(([title, completed], i) => ({
  id: `00000000-0000-4000-8000-0000000002${String(i).padStart(2, '0')}`,
  goal_id: MAIN_ID,
  owner_id: USER.id,
  title,
  completed,
  completed_at: completed ? NOW : null,
  position: i,
  visibility: 'personal',
  created_at: NOW,
  updated_at: NOW,
}));

const json = (route, body, status = 200, contentType = 'application/json') =>
  route.fulfill({ status, contentType, body: JSON.stringify(body) });

/**
 * Instala a API simulada. `mode`: "normal" | "empty" | "loading" | "error". No modo "loading"
 * as listas só respondem quando `release()` é chamada; no "error", respondem problem+json.
 */
async function installApi(context, mode, unknown) {
  let release = () => {};
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  await context.route(
    (url) => url.pathname.startsWith('/api/'),
    async (route) => {
      const url = new URL(route.request().url());
      const method = route.request().method();
      const path = url.pathname.replace('/api/v1', '');
      if (method === 'GET' && path === '/me') return json(route, USER);
      const isData = path.startsWith('/goals');
      if (isData && mode === 'error') {
        return json(
          route,
          { title: 'Erro interno', code: 'internal_error', detail: 'Falha simulada.' },
          500,
          'application/problem+json',
        );
      }
      if (isData && mode === 'loading') await gate;
      if (method === 'GET' && path === '/goals') {
        const q = url.searchParams;
        let items = mode === 'empty' ? [] : GOALS;
        if (q.get('status')) items = items.filter((g) => g.status === q.get('status'));
        if (q.get('label'))
          items = items.filter((g) =>
            g.labels.some((l) => l.toLowerCase() === q.get('label').toLowerCase()),
          );
        if (q.get('has_deadline'))
          items = items.filter((g) => (g.deadline !== null) === (q.get('has_deadline') === 'true'));
        if (q.get('q'))
          items = items.filter((g) => g.title.toLowerCase().includes(q.get('q').toLowerCase()));
        return json(route, { items, next_cursor: null });
      }
      const one = path.match(/^\/goals\/([^/]+)$/);
      if (method === 'GET' && one) {
        const found = GOALS.find((g) => g.id === one[1]);
        return found
          ? json(route, found)
          : json(
              route,
              { title: 'Não encontrada', code: 'not_found' },
              404,
              'application/problem+json',
            );
      }
      if (method === 'GET' && /^\/goals\/[^/]+\/milestones$/.test(path)) {
        const id = path.split('/')[2];
        return json(route, { items: id === MAIN_ID ? MILESTONES : [], next_cursor: null });
      }
      unknown.push(`${method} ${path}`);
      return json(
        route,
        { title: 'Não simulada', code: 'not_found' },
        404,
        'application/problem+json',
      );
    },
  );
  return { release };
}

// ---------- captura ----------

async function openPage(browser, { theme, size, mode }) {
  const context = await browser.newContext({
    viewport: SIZES[size],
    reducedMotion: 'reduce',
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
  });
  await context.addInitScript((t) => {
    try {
      localStorage.setItem('atria_theme', t);
    } catch {
      /* sem armazenamento */
    }
  }, theme);
  const unknown = [];
  const api = await installApi(context, mode, unknown);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  return { page, context, errors, unknown, api };
}

const noOverflow = (page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const inViewport = (locator) =>
  locator.evaluate((el) => {
    const r = el.getBoundingClientRect();
    el.dataset.box = `l${Math.round(r.left)} t${Math.round(r.top)} r${Math.round(r.right)} b${Math.round(r.bottom)} / ${innerWidth}x${innerHeight}`;
    return r.left >= 0 && r.top >= 0 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 2;
  });
const routerHref = (page) => page.evaluate(() => window.__atria_router.state.location.href);

async function goto(page, base, path) {
  await page.goto(`${base}${PAGE_PATH}?path=${encodeURIComponent(path)}`);
  await page.locator('h1').first().waitFor();
  await page.evaluate(() => document.fonts.ready);
}

/** Verificações comuns a toda captura: tema, rolagem, erro de JS e axe (inclui color-contrast). */
async function baseChecks(page, errors, unknown, tag, theme) {
  const applied = await page.evaluate(() => document.documentElement.dataset.theme);
  check(`${tag}: tema ${THEME_LABEL[theme]} aplicado`, applied === theme);
  check(`${tag}: sem rolagem horizontal`, await noOverflow(page));
  check(`${tag}: sem erro de JS`, errors.length === 0, errors.join(' | '));
  check(`${tag}: só chamadas simuladas à API`, unknown.length === 0, unknown.join(' | '));
  const axe = await new AxeBuilder({ page }).analyze();
  // Dias de fora do mês fora do contraste (DEC-010): só os nós [data-outside], só na regra color-contrast.
  const violations = axe.violations
    .map((v) =>
      v.id === 'color-contrast'
        ? { ...v, nodes: v.nodes.filter((n) => !/data-outside/.test(n.html)) }
        : v,
    )
    .filter((v) => v.nodes.length > 0);
  const bad = violations.map(
    (v) =>
      `${v.id}(${v.nodes.length}) ${v.nodes
        .slice(0, 2)
        .map((n) => n.target.join(' '))
        .join(' ; ')}`,
  );
  check(`${tag}: axe sem violações (inclui color-contrast)`, bad.length === 0, bad.join(', '));
}

async function runScenarios(browser, base, scenarios) {
  const shots = [];
  for (const theme of THEMES) {
    for (const size of ['desktop', 'mobile']) {
      for (const sc of scenarios) {
        if (sc.sizes && !sc.sizes.includes(size)) continue;
        const tag = `${sc.name} · ${SIZE_LABEL[size]} · ${THEME_LABEL[theme]}`;
        const { page, context, errors, unknown, api } = await openPage(browser, {
          theme,
          size,
          mode: sc.mode ?? 'normal',
        });
        try {
          await goto(page, base, sc.path);
          await sc.run(page, tag, { theme, size, api });
          await baseChecks(page, errors, unknown, tag, theme);
          if (process.env.EVIDENCE_DUMP) {
            mkdirSync(process.env.EVIDENCE_DUMP, { recursive: true });
            writeFileSync(
              join(
                process.env.EVIDENCE_DUMP,
                `${theme}-${size}-${sc.name.replace(/\W+/g, '_')}.png`,
              ),
              await page.screenshot(),
            );
          }
          shots.push({
            size,
            row: `${theme}-${size}`,
            label: `${sc.name} · ${SIZE_LABEL[size]} · ${THEME_LABEL[theme]}`,
            png: await page.screenshot(),
          });
        } catch (e) {
          check(`${tag}: cenário executou`, false, String(e.message).split('\n')[0]);
        } finally {
          api.release();
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
  const figures = shots.map(figure).join('');
  const html = `<!doctype html><meta charset="utf-8"><style>
    body{margin:0;padding:24px;background:#1b1b20;color:#e8e8ee;font:13px/1.4 system-ui,sans-serif}
    h1{font-size:18px;margin:0 0 16px}
    main{display:flex;flex-wrap:wrap;gap:20px;align-items:flex-start}
    figure{margin:0}
    img{display:block;border:1px solid #444;border-radius:4px}
    figcaption{margin-top:6px;color:#b8b8c4}
  </style><h1>${title}</h1><main>${figures}</main>`;
  const context = await browser.newContext({ viewport: { width: 1480, height: 800 } });
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

const text = (page) => page.evaluate(() => document.body.innerText);
const dangerColor = (page) =>
  page.evaluate(() => {
    const probe = document.createElement('span');
    probe.style.color = 'var(--danger)';
    document.body.append(probe);
    const color = getComputedStyle(probe).color;
    probe.remove();
    return color;
  });

const scenarios = [
  {
    name: 'lista em lista',
    path: '/goals',
    run: async (page, tag) => {
      await page.getByText('Aprender violão').waitFor();
      const rows = await page.locator('main ul li, [role="main"] ul li').count();
      check(
        `${tag}: cinco metas listadas`,
        (await page
          .getByRole('link', { name: /./ })
          .filter({ hasText: /Aprender violão|Reformar|Ler doze|Correr|Organizar/ })
          .count()) === 5,
        String(rows),
      );
      const body = await text(page);
      check(
        `${tag}: prazo vencido sem "atrasada" e sem a cor de perigo`,
        await (async () => {
          const sub = page.getByText(/Prazo em 12 de out\./);
          const shown = (await sub.count()) === 1;
          const color = await sub.evaluate((el) => getComputedStyle(el).color);
          return shown && !/atrasad|vencid/i.test(body) && color !== (await dangerColor(page));
        })(),
      );
      check(
        `${tag}: tom calmo, sem gamificação`,
        !/parab[eé]ns|conquista|sequ[eê]ncia|streak|pontos|n[ií]vel/i.test(body),
      );
      check(
        `${tag}: nomes acessíveis Filtros, Busca e Visualização`,
        (await page.getByRole('group', { name: 'Filtros' }).count()) === 1 &&
          (await page.getByRole('searchbox', { name: 'Busca' }).count()) +
            (await page.getByRole('textbox', { name: 'Busca' }).count()) >=
            1 &&
          (await page.getByRole('group', { name: 'Visualização' }).count()) +
            (await page.getByRole('radiogroup', { name: 'Visualização' }).count()) +
            (await page.getByRole('tablist', { name: 'Visualização' }).count()) >=
            1,
      );
      check(
        `${tag}: botão Relatórios e Nova meta no cabeçalho`,
        (await page.getByRole('button', { name: 'Relatórios' }).isVisible()) &&
          (await page.getByRole('link', { name: 'Nova meta' }).first().isVisible()),
      );
    },
  },
  {
    name: 'grade com Relatórios aberto',
    path: '/goals?view=grid',
    run: async (page, tag) => {
      await page.getByText('Aprender violão').waitFor();
      check(
        `${tag}: grade ativa na URL`,
        (await routerHref(page)).includes('view=grid'),
        await routerHref(page),
      );
      await page.getByRole('button', { name: 'Relatórios' }).click();
      const menu = page.getByRole('menu', { name: 'Relatórios' });
      await menu.waitFor();
      const item = menu.getByRole('menuitem', { name: 'Progresso das metas' });
      check(
        `${tag}: menu "Relatórios" aberto · item "Progresso das metas"`,
        await item.isVisible(),
      );
      check(
        `${tag}: item aponta para /reports/goals-progress?from_module=goals`,
        (await item.getAttribute('href')) === '/reports/goals-progress?from_module=goals',
        String(await item.getAttribute('href')),
      );
      check(
        `${tag}: menu dentro da janela`,
        await inViewport(menu),
        await menu.getAttribute('data-box'),
      );
    },
  },
  {
    name: 'filtros e seletor de status aberto',
    path: '/goals',
    run: async (page, tag) => {
      await page.getByText('Aprender violão').waitFor();
      const filters = page.getByRole('group', { name: 'Filtros' });
      await filters.getByRole('button', { name: /^Prazo/ }).click();
      await page.getByRole('option', { name: 'Com prazo' }).click();
      const label = filters.getByRole('textbox', { name: 'Etiqueta' });
      await label.fill('casa');
      await label.press('Enter');
      await page.waitForFunction(() =>
        window.__atria_router.state.location.href.includes('label=casa'),
      );
      const href = await routerHref(page);
      check(
        `${tag}: ?has_deadline=true&label=casa na URL`,
        href.includes('has_deadline=true') && href.includes('label=casa'),
        href,
      );
      await page.getByText('Aprender violão').waitFor();
      const shown = await page
        .getByRole('link', { name: /Aprender violão|Correr uma meia/ })
        .count();
      check(
        `${tag}: lista filtrada para as 2 metas com prazo e etiqueta "casa"`,
        shown === 2,
        String(shown),
      );
      check(
        `${tag}: meta sem prazo fora da lista`,
        (await page.getByText('Ler doze livros neste ano').count()) === 0,
      );
      await filters.getByRole('button', { name: /^Status/ }).click();
      const list = page.getByRole('listbox');
      await list.waitFor();
      const options = (await list.getByRole('option').allTextContents()).map((s) => s.trim());
      check(
        `${tag}: filtro de status com Planejada, Em andamento, Concluída e Abandonada`,
        ['Todos', 'Planejada', 'Em andamento', 'Concluída', 'Abandonada'].every((o) =>
          options.includes(o),
        ),
        options.join(' | '),
      );
      check(`${tag}: lista de status dentro da janela`, await inViewport(list));
    },
  },
  {
    name: 'lista vazia',
    path: '/goals',
    mode: 'empty',
    run: async (page, tag) => {
      await page.getByText('Nenhuma meta por aqui').waitFor();
      const body = await text(page);
      check(
        `${tag}: lista vazia com texto explicativo`,
        body.includes('Nenhuma meta por aqui') && body.includes('Crie uma quando fizer sentido.'),
      );
      check(
        `${tag}: ação "Nova meta" no estado vazio`,
        (await page.getByRole('link', { name: 'Nova meta' }).count()) >= 1,
      );
    },
  },
  {
    name: 'carregando',
    path: '/goals',
    mode: 'loading',
    run: async (page, tag) => {
      const loading = page.getByText('Carregando metas…');
      await loading.waitFor();
      check(`${tag}: carregando visível`, await loading.isVisible());
    },
  },
  {
    name: 'erro ao carregar',
    path: '/goals',
    mode: 'error',
    run: async (page, tag) => {
      await page.getByText('Não foi possível carregar as metas').waitFor();
      const retry = page.getByRole('button', { name: 'Tentar de novo' });
      check(`${tag}: erro com "Tentar de novo"`, await retry.isVisible());
    },
  },
  {
    name: 'formulário com pills e calendário',
    path: '/goals/new',
    run: async (page, tag) => {
      await page.getByRole('textbox', { name: 'Título' }).fill('Aprender a tocar piano');
      const tags = page.getByRole('textbox', { name: 'Etiquetas' });
      for (const name of ['música', 'casa']) {
        await tags.fill(name);
        await tags.press('Enter');
      }
      const pills = await page
        .getByRole('list', { name: /Etiquetas/ })
        .getByRole('listitem')
        .count();
      check(`${tag}: etiquetas em pills · ${pills} pills`, pills === 2);
      await page.getByRole('button', { name: /^Prazo/ }).click();
      const dialog = page.getByRole('dialog', { name: 'Prazo' });
      await dialog.waitFor();
      await dialog.scrollIntoViewIfNeeded();
      check(
        `${tag}: calendário do prazo dentro da janela`,
        await inViewport(dialog),
        await dialog.getAttribute('data-box'),
      );
      const natives = await page
        .locator('select, input[type="date"], input[type="number"]')
        .count();
      check(`${tag}: nenhum <select> nem input date nativo`, natives === 0, String(natives));
      const cancel = await page.getByRole('button', { name: 'Cancelar' }).boundingBox();
      const save = await page.getByRole('button', { name: 'Salvar' }).boundingBox();
      const form = await page.locator('form').boundingBox();
      check(
        `${tag}: "Cancelar" antes de "Salvar", à direita`,
        cancel !== null &&
          save !== null &&
          form !== null &&
          cancel.x < save.x &&
          save.x + save.width >= form.x + form.width - 24,
        `cancelar x${Math.round(cancel?.x ?? 0)} salvar x${Math.round(save?.x ?? 0)}`,
      );
      const centered = await page.locator('form').evaluate((el) => {
        const r = el.getBoundingClientRect();
        const area = document.querySelector('[data-scroll-area]') ?? document.body;
        const a = area.getBoundingClientRect();
        return Math.abs(r.left - a.left - (a.right - r.right)) <= 40;
      });
      check(`${tag}: formulário numa coluna centralizada`, centered);
    },
  },
  {
    name: 'formulário com erro de validação',
    path: '/goals/new',
    run: async (page, tag) => {
      await page.getByRole('button', { name: 'Salvar' }).click();
      const alert = page.locator('form [role="alert"]').first();
      await alert.waitFor();
      check(
        `${tag}: erro de validação em role="alert" dentro do formulário`,
        (await alert.isVisible()) && (await alert.textContent())?.includes('Campo obrigatório'),
        String(await alert.textContent()),
      );
      check(
        `${tag}: campo Título marcado como inválido`,
        (await page.getByRole('textbox', { name: 'Título' }).getAttribute('aria-invalid')) ===
          'true',
      );
    },
  },
  {
    name: 'visão geral com Mais ações aberto',
    path: `/goals/${MAIN_ID}`,
    run: async (page, tag) => {
      await page.getByRole('heading', { level: 1, name: 'Aprender violão' }).waitFor();
      for (const card of ['Progresso', 'Descrição', 'Registro']) {
        await page.getByRole('heading', { level: 2, name: card }).waitFor();
      }
      check(`${tag}: cartões Progresso, Descrição e Registro`, true);
      const bar = page.getByRole('progressbar', { name: 'Progresso da meta' });
      check(
        `${tag}: barra de progresso aria-valuenow 25 · "25%"`,
        (await bar.getAttribute('aria-valuenow')) === '25' && (await text(page)).includes('25%'),
      );
      check(
        `${tag}: "Editar" com lápis e eyebrow "Metas · Meta"`,
        (await page.getByRole('link', { name: 'Editar' }).locator('svg').count()) === 1 &&
          /metas · meta/i.test(await text(page)),
        `links ${await page.getByRole('link', { name: 'Editar' }).count()} · svg ${await page.getByRole('link', { name: 'Editar' }).locator('svg').count()} · eyebrow ${/metas · meta/i.test(await text(page))}`,
      );
      await page.getByRole('button', { name: 'Mais ações' }).click();
      const menu = page.getByRole('menu', { name: 'Mais ações' });
      await menu.waitFor();
      const del = menu.getByRole('menuitem', { name: 'Excluir' });
      check(`${tag}: "Mais ações" aberto · "Excluir" visível`, await del.isVisible());
      check(
        `${tag}: "Excluir" em tom de perigo, depois do relatório`,
        (await del.getAttribute('data-tone')) === 'danger' &&
          (await menu.getByRole('menuitem').allTextContents()).map((s) => s.trim()).join('|') ===
            'Progresso das metas|Excluir',
      );
      check(
        `${tag}: relatório filtrado pela meta`,
        (await menu.getByRole('menuitem', { name: 'Progresso das metas' }).getAttribute('href')) ===
          `/reports/goals-progress?goal_id=${MAIN_ID}&run=1&from_module=goals`,
      );
      check(
        `${tag}: menu dentro da janela`,
        await inViewport(menu),
        await menu.getAttribute('data-box'),
      );
    },
  },
  {
    name: 'aba Marcos (25%)',
    path: `/goals/${MAIN_ID}?tab=milestones`,
    run: async (page, tag) => {
      const list = page.getByRole('list', { name: 'Marcos' });
      await list.waitFor();
      const boxes = list.getByRole('checkbox');
      const checked = await boxes.evaluateAll((els) => els.filter((e) => e.checked).length);
      check(
        `${tag}: quatro marcos, um concluído`,
        (await boxes.count()) === 4 && checked === 1,
        `${await boxes.count()} marcos, ${checked} concluído(s)`,
      );
      const bar = page.getByRole('progressbar', { name: 'Progresso' });
      check(
        `${tag}: barra de progresso aria-valuenow 25 · "25%"`,
        (await bar.getAttribute('aria-valuenow')) === '25' &&
          (await text(page)).includes('25% dos marcos concluídos'),
      );
    },
  },
  {
    name: 'foco na caixa de um marco',
    path: `/goals/${MAIN_ID}?tab=milestones`,
    sizes: ['desktop'],
    run: async (page, tag) => {
      const list = page.getByRole('list', { name: 'Marcos' });
      await list.waitFor();
      let reached = false;
      for (let i = 0; i < 40 && !reached; i += 1) {
        await page.keyboard.press('Tab');
        reached = await page.evaluate(
          () =>
            document.activeElement instanceof HTMLInputElement &&
            document.activeElement.type === 'checkbox' &&
            document.activeElement.closest('ul[aria-label="Marcos"]') !== null,
        );
      }
      const outline = await page.evaluate(() => {
        const s = getComputedStyle(document.activeElement);
        return { style: s.outlineStyle, width: parseFloat(s.outlineWidth), color: s.outlineColor };
      });
      check(
        `${tag}: foco na caixa de um marco por Tab · contorno de foco visível ≥ 2 px`,
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
      title:
        'TASK-23 · telas de Metas (RF-36, RF-37, CT-23, RNF-06, RNF-08, RNF-10, PD-11, PD-14, PD-19, PD-57, PD-59, PD-61, PD-62)',
      file: 'goals-telas.png',
      shots,
      scale: { desktop: 0.45, mobile: 0.62 },
    });
  },
};

const wanted = process.argv.slice(2);
const names = wanted.length > 0 ? wanted : Object.keys(EVIDENCES);
const unknownNames = names.filter((n) => !(n in EVIDENCES));
if (unknownNames.length > 0) {
  console.error(`Evidência desconhecida: ${unknownNames.join(', ')}. Use telas.`);
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
  if (vite) await vite.stop();
}
console.log(`\n${failures === 0 ? 'ok' : 'FALHA'}  ${failures} falha(s)`);
process.exit(failures === 0 ? 0 : 1);
