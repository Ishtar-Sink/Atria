// Evidências visuais da TASK-26 (telas de Notas), sem passo manual: sobe o Vite numa porta livre
// (API `createServer`), serve uma página virtual que carrega `src/features/notes/evidence/harness.tsx`
// (as rotas da feature num roteador em memória, com os providers e o layout do app), simula a API no
// navegador com fixtures em memória, confere o estado no DOM antes de cada captura e monta a prancha
// (PNG) em vostok/work/tasks/SPEC-001/evidence/TASK-26/.
// Uso: node apps/web/scripts/evidence-notes.mjs telas
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
const OUT = join(ROOT, 'vostok', 'work', 'tasks', 'SPEC-001', 'evidence', 'TASK-26');

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
    <title>Atria · evidência das notas</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/features/notes/evidence/harness.tsx"></script>
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

function makeNote(id, title, body, extra = {}) {
  return {
    id,
    owner_id: 'u1',
    title,
    body,
    visibility: 'personal',
    created_at: '2026-10-20T13:00:00Z',
    updated_at: '2026-11-02T18:30:00Z',
    ...extra,
  };
}

function fixtures() {
  return [
    makeNote(
      '0b6f7d52-3c1e-4a50-9f7b-1d2a8e4c5a01',
      'Ideias para a viagem de janeiro',
      'Ver o roteiro de trem pela serra.\nReservar a pousada perto do rio.\nLevar o caderno de desenho.',
      { updated_at: '2026-11-04T10:15:00Z' },
    ),
    makeNote(
      '5c2a9e11-7d34-4b86-a1c0-3f9e6b7d2a02',
      'Receita do pão de casa',
      'Misturar a farinha com a água morna e deixar descansar por uma hora. Assar em forno bem quente.',
      { visibility: 'shared', updated_at: '2026-11-03T08:00:00Z' },
    ),
    makeNote('a91d4c07-2e8b-4f13-8c65-7b0d1e3f4a03', 'Lista do mercado', '', {
      updated_at: '2026-11-01T19:40:00Z',
    }),
    makeNote(
      'e3f8b620-6a49-4d72-b5e1-9c4a7d0b8a04',
      'Reunião de condomínio',
      'Pauta: reforma do telhado, orçamento da portaria e horário de silêncio. Levar as propostas impressas.',
      { visibility: 'shared', updated_at: '2026-10-28T21:05:00Z' },
    ),
    makeNote(
      '17d0a5e9-8c3f-4e24-96ab-2f5b9c1d6a05',
      'Livros para ler depois',
      'Um romance curto, um de ensaios e aquele sobre jardinagem que a Ana indicou.',
      { updated_at: '2026-10-22T07:30:00Z' },
    ),
  ];
}

const NOTE_ID = '0b6f7d52-3c1e-4a50-9f7b-1d2a8e4c5a01';

/** Modos: normal, empty (sem notas), loading (respostas seguradas) e error (500 na listagem). */
async function installApi(context, mode, gate) {
  const notes = fixtures();
  const state = { deleted: 0 };
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
      if (path.startsWith('/notes') && mode === 'loading') {
        await gate;
        return reply({ title: 'Indisponível', code: 'unavailable' }, 503);
      }
      if (path.startsWith('/notes') && mode === 'error') {
        return reply({ title: 'Erro interno', code: 'internal_error' }, 500);
      }
      const q = url.searchParams;
      if (path === '/search' && method === 'GET') {
        return reply({ groups: [{ context: 'notes', items: [] }] });
      }
      if (path === '/notes' && method === 'GET') {
        let items = mode === 'empty' ? [] : [...notes];
        if (q.get('visibility')) items = items.filter((n) => n.visibility === q.get('visibility'));
        return reply({ items, next_cursor: null });
      }
      const detail = path.match(/^\/notes\/([^/]+)$/);
      if (detail && method === 'GET') {
        const note = notes.find((n) => n.id === detail[1]);
        return note ? reply(note) : reply({ title: 'Não encontrada', code: 'note_not_found' }, 404);
      }
      if (detail && method === 'DELETE') {
        state.deleted += 1;
        return route.fulfill({ status: 204 });
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
const openMenu = async (page) => {
  await page.getByRole('button', { name: 'Mais ações' }).click();
  const del = page.getByRole('menuitem', { name: 'Excluir' });
  await del.waitFor();
  return del;
};

const scenarios = [
  {
    name: 'lista de notas em lista',
    path: '/notes',
    run: async (page, tag) => {
      await page.getByRole('link', { name: 'Receita do pão de casa' }).waitFor();
      const items = main(page)
        .locator('ul > li')
        .filter({ has: page.getByRole('link') });
      check(`${tag}: lista em lista · ${await items.count()} notas`, (await items.count()) === 5);
      check(
        `${tag}: começo do texto e data de atualização`,
        (await items.first().getByText('Atualizada em').count()) === 1 &&
          (await main(page).getByText('Ver o roteiro de trem pela serra.').count()) === 1,
      );
      check(
        `${tag}: nota sem texto mostra "Sem texto ainda."`,
        (await main(page).getByText('Sem texto ainda.').count()) === 1,
      );
      for (const name of ['Filtros', 'Busca', 'Visualização']) {
        check(
          `${tag}: controle "${name}" presente`,
          (await page.getByRole(name === 'Busca' ? 'searchbox' : 'group', { name }).count()) >= 1,
        );
      }
      check(`${tag}: nenhum <select> nativo`, (await page.locator('select').count()) === 0);
    },
  },
  {
    name: 'lista de notas em grade',
    path: '/notes?view=grid',
    run: async (page, tag) => {
      await page.getByRole('link', { name: 'Receita do pão de casa' }).waitFor();
      const first = main(page)
        .locator('ul > li')
        .filter({ has: page.getByRole('link') });
      const xs = await first.evaluateAll(
        (els) => new Set(els.map((el) => Math.round(el.getBoundingClientRect().left))).size,
      );
      const pressed = await page
        .getByRole('group', { name: 'Visualização' })
        .getByRole('button', { name: 'Grade' })
        .getAttribute('aria-pressed');
      check(
        `${tag}: lista em grade · ${xs} coluna(s)`,
        (await first.count()) === 5 && xs >= 1 && pressed === 'true',
        `aria-pressed ${pressed}`,
      );
    },
  },
  {
    name: 'lista vazia',
    path: '/notes',
    mode: 'empty',
    run: async (page, tag) => {
      const title = page.getByText('Nenhuma nota ainda');
      await title.waitFor();
      check(
        `${tag}: lista vazia com texto explicativo`,
        (await title.isVisible()) &&
          (await page.getByText('Anote o que quiser guardar.').isVisible()),
      );
    },
  },
  {
    name: 'carregando',
    path: '/notes',
    mode: 'loading',
    run: async (page, tag) => {
      const status = page.getByRole('status').filter({ hasText: 'Carregando' });
      await status.waitFor();
      check(`${tag}: carregando visível`, await status.isVisible());
    },
  },
  {
    name: 'erro',
    path: '/notes',
    mode: 'error',
    run: async (page, tag) => {
      const retry = page.getByRole('button', { name: 'Tentar de novo' });
      await retry.waitFor();
      check(
        `${tag}: erro com "Tentar de novo"`,
        (await retry.isVisible()) &&
          (await page.getByText('Não foi possível carregar as notas').isVisible()),
      );
    },
  },
  {
    name: 'busca sem resultado',
    path: '/notes?q=zebra',
    run: async (page, tag) => {
      const title = page.getByText('Nenhuma nota com esse texto');
      await title.waitFor();
      check(
        `${tag}: busca sem resultado com texto explicativo`,
        (await title.isVisible()) &&
          (await page.getByText('Mude a busca para ver mais notas.').isVisible()) &&
          (await page.getByRole('searchbox').inputValue()) === 'zebra',
      );
    },
  },
  {
    name: 'visão geral com Mais ações',
    path: `/notes/${NOTE_ID}`,
    run: async (page, tag) => {
      await page
        .getByRole('heading', { level: 1, name: 'Ideias para a viagem de janeiro' })
        .waitFor();
      const cards = [];
      for (const name of ['Texto', 'Registro']) {
        cards.push(await page.getByRole('heading', { level: 2, name, exact: true }).isVisible());
      }
      check(
        `${tag}: visão geral em cartões Texto e Registro`,
        cards.every(Boolean),
        cards.join(','),
      );
      const edit = page.getByRole('link', { name: 'Editar' });
      check(
        `${tag}: "Editar" com o ícone de lápis`,
        (await edit.isVisible()) && (await edit.locator('svg').count()) === 1,
      );
      const del = await openMenu(page);
      check(
        `${tag}: "Mais ações" aberto · "Excluir" visível`,
        (await del.isVisible()) && (await inViewport(del)),
        await page.evaluate(() => window.__box),
      );
      const outside = await main(page).getByRole('button', { name: 'Excluir' }).count();
      check(`${tag}: nenhum botão "Excluir" fora do menu`, outside === 0);
    },
  },
  {
    name: 'formulário com erro de validação',
    path: '/notes/new',
    run: async (page, tag, { size }) => {
      await page.getByRole('button', { name: 'Salvar' }).click();
      const alert = page
        .locator('form')
        .getByRole('alert')
        .filter({ hasText: 'Campo obrigatório' });
      await alert.first().waitFor();
      check(
        `${tag}: erro de validação em role="alert" dentro do formulário`,
        await alert.first().isVisible(),
      );
      check(
        `${tag}: título marcado como inválido`,
        (await page.locator('form [aria-invalid="true"]').count()) >= 1,
      );
      const group = page.getByRole('radiogroup');
      check(
        `${tag}: visibilidade em grupo segmentado (Pessoal e Compartilhada)`,
        (await group.getByRole('radio', { name: 'Pessoal' }).isChecked()) &&
          (await group.getByRole('radio', { name: 'Compartilhada' }).count()) === 1,
      );
      check(
        `${tag}: nenhum <select> nativo`,
        (await page.locator('select, input[type="date"], input[type="number"]').count()) === 0,
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
    name: 'diálogo de exclusão',
    path: `/notes/${NOTE_ID}`,
    run: async (page, tag, { state }) => {
      await page
        .getByRole('heading', { level: 1, name: 'Ideias para a viagem de janeiro' })
        .waitFor();
      await (await openMenu(page)).click();
      const dialog = page.getByRole('alertdialog');
      await dialog.waitFor();
      check(
        `${tag}: diálogo de exclusão aberto, nada excluído antes de confirmar`,
        (await dialog.isVisible()) &&
          (await dialog.getByText('Excluir esta nota?').isVisible()) &&
          state.deleted === 0,
        `${state.deleted} exclusão(ões)`,
      );
      check(`${tag}: diálogo dentro da janela`, await inViewport(dialog));
    },
  },
  {
    name: 'foco no diálogo de exclusão',
    path: `/notes/${NOTE_ID}`,
    sizes: ['desktop'],
    run: async (page, tag) => {
      await page
        .getByRole('heading', { level: 1, name: 'Ideias para a viagem de janeiro' })
        .waitFor();
      await (await openMenu(page)).click();
      const dialog = page.getByRole('alertdialog');
      await dialog.waitFor();
      const inside = () => page.evaluate(() => document.activeElement?.closest('dialog') !== null);
      let ok = await inside();
      for (let i = 0; i < 3; i += 1) {
        await page.keyboard.press('Tab');
        ok = ok && (await inside());
      }
      const outline = await page.evaluate(() => {
        const s = getComputedStyle(document.activeElement);
        return { style: s.outlineStyle, width: parseFloat(s.outlineWidth), color: s.outlineColor };
      });
      check(
        `${tag}: foco dentro do diálogo por Tab · contorno de foco visível ≥ 2 px`,
        ok && outline.style !== 'none' && outline.width >= 2,
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
      title: 'TASK-26 · telas de Notas (RF-43, CT-26, RNF-06, RNF-08, RNF-10)',
      file: 'notes-telas.png',
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
