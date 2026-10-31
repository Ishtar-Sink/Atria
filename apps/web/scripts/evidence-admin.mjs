// Evidências visuais da TASK-20 (telas de administração), sem passo manual: sobe o Vite numa porta
// livre com uma página virtual que carrega o harness da feature, simula a API no navegador, confere
// o estado no DOM antes de cada captura e monta a prancha (PNG) em
// vostok/work/tasks/SPEC-001/evidence/TASK-20/.
// Uso: node apps/web/scripts/evidence-admin.mjs telas
// Imprime "ok" ou "FALHA" por verificação e o caminho do PNG; sai com código 1 se algo falhar.
import { mkdirSync, writeFileSync } from 'node:fs';
import { createServer as createNetServer } from 'node:net';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import AxeBuilder from '@axe-core/playwright';
import { chromium } from '@playwright/test';
import { createServer as createViteServer } from 'vite';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = join(WEB, '..', '..');
const OUT = join(ROOT, 'vostok', 'work', 'tasks', 'SPEC-001', 'evidence', 'TASK-20');
const PAGE_PATH = '/__evidence/admin';

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

/** Serve uma página HTML virtual que carrega o harness; não existe no build de produção. */
function evidencePage() {
  return {
    name: 'evidence-admin-page',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith(PAGE_PATH)) return next();
        const html = await server.transformIndexHtml(
          req.url,
          `<!doctype html>
<html lang="pt-BR" data-theme="light">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light dark" />
    <title>Atria · evidência da administração</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/features/admin/evidence/harness.tsx"></script>
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
    logLevel: 'error',
    plugins: [evidencePage()],
    server: { port, strictPort: true, host: '127.0.0.1' },
  });
  await server.listen();
  return { url: `http://127.0.0.1:${port}`, stop: () => server.close() };
}

// ---------- API simulada ----------

const ADMIN_ID = '00000000-0000-4000-8000-000000000001';
const user = (n, email, role, is_active, totp_enabled, created_at) => ({
  id: `00000000-0000-4000-8000-00000000000${n}`,
  email,
  role,
  is_active,
  totp_enabled,
  created_at,
});
const USERS = [
  user(1, 'ana@atria.example', 'admin', true, true, '2026-01-12T10:00:00Z'),
  user(2, 'bruno@atria.example', 'elevated', true, true, '2026-02-03T14:30:00Z'),
  user(3, 'carla@atria.example', 'user', true, false, '2026-03-21T09:15:00Z'),
  user(4, 'davi@atria.example', 'user', false, false, '2026-04-08T18:45:00Z'),
  user(5, 'elisa@atria.example', 'user', true, true, '2026-05-30T08:00:00Z'),
];
const INACTIVE_EMAIL = 'davi@atria.example';
const ME_BY_ROLE = {
  admin: { id: ADMIN_ID, email: 'ana@atria.example', role: 'admin' },
  elevated: { id: USERS[1].id, email: 'bruno@atria.example', role: 'elevated' },
};

const json = (route, status, body, contentType = 'application/json') =>
  route.fulfill({ status, contentType, body: JSON.stringify(body) });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Responde `/api/**` com fixtures em memória; `mode` escolhe o estado da lista e da instância. */
async function mockApi(context, { role = 'admin', mode = 'ok' } = {}) {
  let invite_required = true;
  await context.route(
    (url) => url.pathname.startsWith('/api/'),
    async (route) => {
      const url = new URL(route.request().url());
      const path = url.pathname.replace('/api/v1', '');
      const method = route.request().method();
      try {
        if (path === '/me') {
          return await json(route, 200, {
            ...ME_BY_ROLE[role],
            totp_enabled: true,
            account_complete: true,
          });
        }
        if (path === '/admin/users' && method === 'GET') {
          if (mode === 'loading') {
            await sleep(30_000);
            return await json(route, 503, {});
          }
          if (mode === 'error') {
            return await json(
              route,
              500,
              { title: 'Erro interno', code: 'internal_error', status: 500 },
              'application/problem+json',
            );
          }
          if (mode === 'empty') return await json(route, 200, { items: [], next_cursor: null });
          const q = url.searchParams.get('q');
          const r = url.searchParams.get('role');
          const items = USERS.filter((u) => (!r || u.role === r) && (!q || u.email.includes(q)));
          return await json(route, 200, { items, next_cursor: null });
        }
        if (path === '/admin/instance/settings') {
          if (method === 'PATCH') {
            invite_required = JSON.parse(route.request().postData() ?? '{}').invite_required;
          }
          return await json(route, 200, { invite_required, web_push_enabled: false });
        }
        if (path === '/admin/invites' && method === 'POST') {
          return await json(route, 201, {
            id: '00000000-0000-4000-8000-0000000000aa',
            link: 'https://atria.example/signup?invite=3f9c1a7e5b2d4c60a8e1',
            expires_at: '2026-11-07T12:00:00Z',
          });
        }
        if (path === '/admin/instance') {
          if (mode === 'error') {
            return await json(
              route,
              500,
              { title: 'Erro interno', code: 'internal_error', status: 500 },
              'application/problem+json',
            );
          }
          return await json(route, 200, {
            version: '0.1.0',
            database_bytes: 48_234_496,
            storage_bytes: 1_288_490_188,
            healthy: true,
            invite_required,
            web_push_enabled: false,
          });
        }
        return await json(route, 404, { title: 'Não encontrado', code: 'not_found', status: 404 });
      } catch {
        /* contexto fechado enquanto a resposta lenta esperava */
      }
    },
  );
}

// ---------- captura ----------

async function openPage(browser, { theme, size, role, mode, to }) {
  const context = await browser.newContext({
    viewport: SIZES[size],
    reducedMotion: 'reduce',
    locale: 'pt-BR',
  });
  await context.addInitScript((t) => {
    try {
      localStorage.setItem('atria_theme', t);
    } catch {
      /* sem armazenamento */
    }
  }, theme);
  await mockApi(context, { role, mode });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  return { page, context, errors, to };
}

const noOverflow = (page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

/** Verificações comuns a toda captura: tema, rolagem, erro de JS e axe (inclusive contraste). */
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
  check(`${tag}: sem erro de JS`, errors.length === 0, errors.join(' | '));
  const result = await new AxeBuilder({ page }).analyze();
  dropOutside(result);
  const summary = result.violations
    .map((v) => `${v.id} (${v.nodes.length}): ${v.nodes[0]?.target.join(' ')}`)
    .join(' | ');
  check(
    `${tag}: axe sem violações (inclusive color-contrast; dias de fora do mês fora do contraste, DEC-010)`,
    result.violations.length === 0,
    summary,
  );
}

const outlineOf = (locator) =>
  locator.evaluate((el) => {
    const s = getComputedStyle(el);
    return { style: s.outlineStyle, width: parseFloat(s.outlineWidth) };
  });

const isReddish = (rgb) => {
  const m = rgb.match(/\d+(\.\d+)?/g)?.map(Number) ?? [];
  const [r = 0, g = 0, b = 0] = m;
  return r > g + 40 && r > b + 40;
};

const scenarios = [
  {
    name: 'usuários · lista',
    to: '/admin/users?view=list',
    run: async (page, tag) => {
      const list = page.getByRole('list', { name: 'Contas' });
      await list.waitFor();
      check(`${tag}: visualização em lista`, (await list.getByRole('listitem').count()) === 5);
      check(
        `${tag}: filtros, busca e visualização com nome acessível`,
        (await page.getByRole('group', { name: 'Filtros' }).count()) === 1 &&
          (await page.getByRole('searchbox').count()) + (await page.getByRole('search').count()) >=
            1,
      );
      const row = list.getByRole('listitem').filter({ hasText: INACTIVE_EMAIL });
      const badge = row.getByText('Desativada', { exact: true });
      const colors = await badge.evaluate((el) => {
        const s = getComputedStyle(el);
        return [s.backgroundColor, s.color, getComputedStyle(el.closest('li')).backgroundColor];
      });
      check(`${tag}: conta desativada sem vermelho`, !colors.some(isReddish), colors.join(' | '));
      check(
        `${tag}: ações do admin presentes`,
        (await page.getByRole('button', { name: /Conceder elevado/ }).count()) >= 1,
      );
    },
  },
  {
    name: 'usuários · tabela',
    to: '/admin/users?view=table',
    run: async (page, tag, _theme, size) => {
      const table = page.getByRole('table', { name: 'Contas' });
      await table.waitFor();
      const headVisible = await table.locator('thead').evaluate((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 2 && r.height > 2;
      });
      if (size === 'desktop') {
        check(`${tag}: visualização em tabela`, headVisible);
      } else {
        const rowDisplay = await table
          .locator('tbody tr')
          .first()
          .evaluate((el) => getComputedStyle(el).display);
        check(
          `${tag}: tabela vira lista em 360 px`,
          !headVisible && rowDisplay === 'block',
          `tr ${rowDisplay}`,
        );
      }
    },
  },
  {
    name: 'usuários · vazio',
    to: '/admin/users',
    mode: 'empty',
    run: async (page, tag) => {
      const text = page.getByText('Nenhuma conta encontrada com esses filtros.');
      await text.waitFor();
      check(`${tag}: estado vazio com texto explicativo`, await text.isVisible());
    },
  },
  {
    name: 'usuários · carregando',
    to: '/admin/users',
    mode: 'loading',
    run: async (page, tag) => {
      const loading = page.getByText('Carregando as contas…').first();
      await loading.waitFor({ state: 'attached' });
      await page.waitForTimeout(200);
      check(
        `${tag}: estado carregando visível`,
        (await page.locator('[aria-busy="true"], [role="status"]').count()) >= 1,
      );
    },
  },
  {
    name: 'usuários · erro',
    to: '/admin/users',
    mode: 'error',
    run: async (page, tag) => {
      const retry = page.getByRole('button', { name: 'Tentar de novo' });
      await retry.waitFor();
      check(`${tag}: erro com "Tentar de novo"`, await retry.isVisible());
    },
  },
  {
    name: 'usuários · filtro por papel aberto',
    to: '/admin/users',
    run: async (page, tag) => {
      await page.getByRole('list', { name: 'Contas' }).waitFor();
      await page.getByRole('button', { name: /Papel/ }).click();
      const list = page.getByRole('listbox');
      await list.waitFor();
      await list.getByRole('option').first().waitFor();
      await page.waitForTimeout(150);
      const options = (await list.getByRole('option').allTextContents()).map((t) => t.trim());
      check(
        `${tag}: seletor próprio do papel aberto, sem <select>`,
        (await page.locator('select').count()) === 0 &&
          options.join('|') === 'Todos os papéis|Administrador|Elevado|Usuário',
        options.join(' | '),
      );
    },
  },
  {
    name: 'usuários · foco numa ação',
    to: '/admin/users',
    run: async (page, tag) => {
      const list = page.getByRole('list', { name: 'Contas' });
      await list.waitFor();
      const target = list.getByRole('button').first();
      let reached = false;
      for (let i = 0; i < 40 && !reached; i += 1) {
        await page.keyboard.press('Tab');
        reached = await target.evaluate((el) => el === document.activeElement);
      }
      const outline = await outlineOf(target);
      check(
        `${tag}: contorno de foco visível depois de Tab (≥ 2 px)`,
        reached && outline.style !== 'none' && outline.width >= 2,
        `${outline.style} ${outline.width}px`,
      );
    },
  },
  {
    name: 'convites · interruptor',
    to: '/admin/invites',
    run: async (page, tag) => {
      const sw = page.getByRole('switch', { name: 'Exigir convite para cadastro' });
      await sw.waitFor();
      check(`${tag}: interruptor "Exigir convite para cadastro" visível`, await sw.isVisible());
    },
  },
  {
    name: 'convite · gerar',
    to: '/admin/invites/new',
    run: async (page, tag, _theme, size) => {
      const h1 = page.getByRole('heading', { level: 1, name: 'Gerar convite' });
      await h1.waitFor();
      const form = page.getByRole('form', { name: 'Gerar convite' });
      const geometry = await page.evaluate(() => {
        const heading = document.querySelector('h1');
        const form = document.querySelector('form');
        let col = heading;
        while (col && !col.contains(form)) col = col.parentElement;
        const area = document.querySelector('[data-scroll-area]');
        const a = area.getBoundingClientRect();
        const pad =
          parseFloat(getComputedStyle(area).paddingLeft) -
          parseFloat(getComputedStyle(area).paddingRight);
        const c = col.getBoundingClientRect();
        const aInner = (a.left + a.right + pad) / 2;
        return {
          colWidth: c.width,
          offset: Math.abs((c.left + c.right) / 2 - aInner),
          areaWidth: a.width,
          sameColumn: col !== area && col !== document.body,
        };
      });
      check(
        `${tag}: cabeçalho e formulário na coluna centralizada`,
        geometry.sameColumn &&
          geometry.colWidth <= 881 &&
          (size === 'mobile' || geometry.colWidth < geometry.areaWidth - 40) &&
          geometry.offset <= 8,
        `coluna ${Math.round(geometry.colWidth)} px, desvio ${Math.round(geometry.offset)} px`,
      );
      const cancel = await form.getByRole('button', { name: 'Cancelar' }).boundingBox();
      const submit = await form.getByRole('button', { name: 'Gerar', exact: true }).boundingBox();
      const formBox = await form.boundingBox();
      check(
        `${tag}: ações à direita com "Cancelar" antes de "Gerar"`,
        cancel.x < submit.x &&
          cancel.y + 4 >= formBox.y &&
          formBox.x + formBox.width - (submit.x + submit.width) <= 24 &&
          submit.y >= (await form.getByRole('textbox').boundingBox()).y,
        `cancelar x ${Math.round(cancel.x)}, gerar x ${Math.round(submit.x)}`,
      );
      await form.getByRole('button', { name: 'Gerar', exact: true }).click();
      await page.getByRole('button', { name: 'Copiar link' }).waitFor();
      check(
        `${tag}: link do convite exibido`,
        (await form.getByRole('textbox').inputValue()).includes('invite='),
      );
    },
  },
  {
    name: 'instância',
    to: '/admin/instance',
    run: async (page, tag) => {
      await page.getByText('0.1.0', { exact: true }).waitFor();
      const space = await page.getByText(/Banco de dados .* arquivos /).textContent();
      const health = await page.getByText('Saudável', { exact: true }).isVisible();
      const icon = await page
        .getByText('Saudável', { exact: true })
        .locator('svg[aria-hidden="true"]')
        .count();
      check(
        `${tag}: versão, espaço usado e saúde visíveis`,
        health && icon === 1 && /\d/.test(space ?? ''),
        space ?? '',
      );
    },
  },
];

async function runScenarios(browser, base) {
  const shots = [];
  for (const sc of scenarios) {
    for (const size of ['desktop', 'mobile']) {
      for (const theme of THEMES) {
        const tag = `${sc.name} · ${SIZE_LABEL[size]} · ${THEME_LABEL[theme]}`;
        const { page, context, errors } = await openPage(browser, {
          theme,
          size,
          role: sc.role ?? 'admin',
          mode: sc.mode ?? 'ok',
        });
        try {
          await page.goto(`${base}${PAGE_PATH}?to=${encodeURIComponent(sc.to)}`);
          await page.locator('h1').first().waitFor();
          await page.evaluate(() => document.fonts.ready);
          await sc.run(page, tag, theme, size);
          await baseChecks(page, errors, tag, theme);
          shots.push({
            group: sc.name,
            size,
            label: `${sc.name} · ${SIZE_LABEL[size]} · ${THEME_LABEL[theme]}`,
            png: await page.screenshot(),
          });
        } catch (e) {
          check(`${tag}: cenário executou`, false, String(e.message).split('\n')[0]);
        } finally {
          await context.close();
        }
      }
    }
  }
  return shots;
}

// ---------- prancha ----------

const SCALE = { desktop: 0.45, mobile: 0.55 };

async function sheet(browser, { title, file, shots }) {
  const figure = (s) => {
    const w = Math.round(SIZES[s.size].width * SCALE[s.size]);
    return `<figure style="width:${w}px"><img style="width:${w}px" src="data:image/png;base64,${s.png.toString('base64')}"><figcaption>${s.label}</figcaption></figure>`;
  };
  const groups = [];
  for (const s of shots) {
    const last = groups[groups.length - 1];
    if (last?.group === s.group) last.items.push(s);
    else groups.push({ group: s.group, items: [s] });
  }
  const rows = groups.map((g) => `<div class="row">${g.items.map(figure).join('')}</div>`).join('');
  const html = `<!doctype html><meta charset="utf-8"><style>
    body{margin:0;padding:24px;background:#1b1b20;color:#e8e8ee;font:13px/1.4 system-ui,sans-serif}
    h1{font-size:18px;margin:0 0 16px}
    main{display:grid;gap:24px}
    figure{margin:0}
    .row{display:flex;gap:20px;align-items:flex-start}
    img{display:block;border:1px solid #444;border-radius:4px}
    figcaption{margin-top:6px;color:#b8b8c4}
  </style><h1>${title}</h1><main>${rows}</main>`;
  const context = await browser.newContext({ viewport: { width: 1800, height: 800 } });
  const page = await context.newPage();
  await page.setContent(html);
  await page.waitForFunction(() => [...document.images].every((i) => i.complete));
  mkdirSync(OUT, { recursive: true });
  const path = join(OUT, file);
  writeFileSync(path, await page.screenshot({ fullPage: true }));
  await context.close();
  console.log(`png: ${relative(ROOT, path)} (${shots.length} capturas)`);
}

// ---------- principal ----------

const EVIDENCES = {
  telas: async (browser, base) => {
    const shots = await runScenarios(browser, base);
    await sheet(browser, {
      title: 'TASK-20 · telas de administração (RNF-06, RNF-08, RNF-10, PD-19, PD-62)',
      file: 'admin-telas.png',
      shots,
    });
  },
};

const names = process.argv.slice(2);
const unknown = names.filter((n) => !(n in EVIDENCES));
if (names.length === 0 || unknown.length > 0) {
  console.error(`Evidência desconhecida ou ausente: ${unknown.join(', ')}. Use telas.`);
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
