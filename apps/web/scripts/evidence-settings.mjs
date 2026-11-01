// Evidências visuais da TASK-07 (SPEC-002: telas de Configurações), sem passo manual: sobe o Vite numa porta
// livre com uma página virtual que carrega o harness da feature, simula a API no navegador, confere
// o estado no DOM antes de cada captura e monta a prancha (PNG) em
// $VOSTOK_EVIDENCE (padrão vostok/work/tasks/SPEC-002/evidence/TASK-07/).
// Uso: node apps/web/scripts/evidence-settings.mjs temas|estados|tema
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
const OUT =
  process.env.VOSTOK_EVIDENCE ??
  join(ROOT, 'vostok', 'work', 'tasks', 'SPEC-002', 'evidence', 'TASK-07');
const PAGE_PATH = '/__evidence/settings';

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
    name: 'evidence-settings-page',
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
    <title>Atria · evidência de Configurações</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/features/settings/evidence/harness.tsx"></script>
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

const USER_ID = '00000000-0000-4000-8000-000000000001';
const USER_NAME = 'ana@atria.example';
const ME_BY_ROLE = {
  admin: { id: USER_ID, email: USER_NAME, role: 'admin' },
  user: { id: USER_ID, email: USER_NAME, role: 'user' },
};

const json = (route, status, body, contentType = 'application/json') =>
  route.fulfill({ status, contentType, body: JSON.stringify(body) });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PROBLEM = { title: 'Erro interno', code: 'internal_error', status: 500 };

/** Responde `/api/**` com fixtures em memória; `mode` escolhe o estado da instância. */
async function mockApi(
  context,
  { role = 'admin', mode = 'ok', patches = [], theme = 'light', server_theme = theme } = {},
) {
  let prefs = {
    theme: server_theme,
    locale: 'pt-BR',
    timezone: 'America/Sao_Paulo',
    currency: 'BRL',
    palette_shortcut: 'mod+k',
    search_contexts: ['finance', 'goals', 'tasks', 'reminders', 'notes', 'journal', 'library'],
  };
  let instance = {
    invite_required: true,
    web_push_enabled: false,
    smtp_host: 'smtp.casa.test',
    smtp_port: 587,
    smtp_user: 'atria',
    smtp_from: 'atria@casa.test',
  };
  await context.route(
    (url) => url.pathname.startsWith('/api/'),
    async (route) => {
      const url = new URL(route.request().url());
      const path = url.pathname.replace('/api/v1', '');
      const method = route.request().method();
      if (method === 'PATCH') patches.push(path);
      try {
        if (path === '/me') {
          return await json(route, 200, {
            ...ME_BY_ROLE[role],
            totp_enabled: true,
            account_complete: true,
          });
        }
        if (path === '/me/preferences') {
          if (method === 'PATCH') {
            prefs = { ...prefs, ...JSON.parse(route.request().postData() ?? '{}') };
          }
          return await json(route, 200, prefs);
        }
        if (path === '/admin/instance/settings') {
          if (mode === 'loading') {
            await sleep(30_000);
            return await json(route, 503, {});
          }
          if (mode === 'error') return await json(route, 500, PROBLEM, 'application/problem+json');
          if (method === 'PATCH') {
            instance = { ...instance, ...JSON.parse(route.request().postData() ?? '{}') };
          }
          return await json(route, 200, instance);
        }
        if (path === '/web-push/public-key') {
          return await json(route, 200, { public_key: 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9' });
        }
        return await json(route, 404, { title: 'Não encontrado', code: 'not_found', status: 404 });
      } catch {
        /* contexto fechado enquanto a resposta lenta esperava */
      }
    },
  );
}

// ---------- captura ----------

async function openPage(browser, { theme, size, role, mode, server_theme, prefers }) {
  const context = await browser.newContext({
    viewport: SIZES[size],
    reducedMotion: 'reduce',
    locale: 'pt-BR',
    colorScheme: prefers ?? theme,
  });
  await context.addInitScript((t) => {
    try {
      localStorage.setItem('atria_theme', t);
    } catch {
      /* sem armazenamento */
    }
  }, theme);
  const patches = [];
  await mockApi(context, { role, mode, patches, theme, server_theme: server_theme ?? theme });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  return { page, context, errors, patches };
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
    `${tag}: axe sem violações (inclui color-contrast; dias de fora do mês fora do contraste, DEC-010)`,
    result.violations.length === 0,
    summary,
  );
}

const outlineOf = (locator) =>
  locator.evaluate((el) => {
    const s = getComputedStyle(el);
    return { style: s.outlineStyle, width: parseFloat(s.outlineWidth) };
  });

const inViewport = (page, locator) =>
  locator.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return (
      r.left >= -1 &&
      r.right <= window.innerWidth + 1 &&
      r.top >= -1 &&
      r.bottom <= window.innerHeight + 1
    );
  });

/** Abre a gaveta da sidebar em 360 px (no desktop a sidebar já está à vista). */
async function openSidebar(page, size) {
  if (size !== 'mobile') return;
  await page.locator('#menu-button').click();
  await page.waitForFunction(
    () => document.querySelector('#menu-button')?.getAttribute('aria-expanded') === 'true',
  );
  await page.waitForTimeout(300);
}

/** Cabeçalho e formulário na coluna centralizada na largura do FormGrid (PD-19). */
async function checkColumn(page, tag, size) {
  const geometry = await page.evaluate(() => {
    const heading = document.querySelector('h1');
    const form = document.querySelector('main form, form');
    let col = heading;
    while (col && form && !col.contains(form)) col = col.parentElement;
    const area = document.querySelector('[data-scroll-area]');
    const a = area.getBoundingClientRect();
    const cs = getComputedStyle(area);
    const pad = parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const c = col.getBoundingClientRect();
    return {
      colWidth: c.width,
      offset: Math.abs((c.left + c.right) / 2 - (a.left + a.right + pad) / 2),
      areaWidth: a.width,
      sameColumn: col !== area && col !== document.body,
    };
  });
  check(
    `${tag}: formulário centralizado na largura do FormGrid`,
    geometry.sameColumn &&
      geometry.colWidth <= 881 &&
      (size === 'mobile' || geometry.colWidth < geometry.areaWidth - 40) &&
      geometry.offset <= 8,
    `coluna ${Math.round(geometry.colWidth)} px, desvio ${Math.round(geometry.offset)} px`,
  );
}

/** Nenhum campo, caixa ou botão do conteúdo passa da janela (campos sem corte em 360 px). */
async function checkNoClip(page, tag) {
  const clipped = await page.evaluate(() => {
    const area = document.querySelector('[data-scroll-area]');
    return [...area.querySelectorAll('input, button, [role="radiogroup"], label')]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && (r.left < -1 || r.right > window.innerWidth + 1);
      })
      .map((el) => el.tagName.toLowerCase())
      .slice(0, 3);
  });
  check(`${tag}: campos sem corte`, clipped.length === 0, clipped.join(', '));
}

const scenarios = {
  temas: [
    {
      name: 'preferências',
      to: '/settings',
      run: async (page, tag, theme, size) => {
        const group = page.getByRole('radiogroup', { name: 'Tema' });
        await group.waitFor();
        // Troca de tema na hora, sem recarregar, e volta para o tema sob teste.
        const other = theme === 'light' ? 'dark' : 'light';
        await group
          .getByRole('radio', { name: other === 'dark' ? 'Escuro' : 'Claro' })
          .check({ force: true });
        await page.waitForFunction((t) => document.documentElement.dataset.theme === t, other);
        check(`${tag}: tema trocado na hora pelo grupo segmentado`, true, `${theme} → ${other}`);
        await group
          .getByRole('radio', { name: theme === 'dark' ? 'Escuro' : 'Claro' })
          .check({ force: true });
        await page.waitForFunction((t) => document.documentElement.dataset.theme === t, theme);
        const layout = page.getByRole('radiogroup', { name: 'Opções do botão de criar' });
        const names = (
          await layout
            .getByRole('radio')
            .evaluateAll((els) => els.map((e) => e.closest('label')?.textContent?.trim()))
        ).join('|');
        check(
          `${tag}: "Opções do botão de criar" com "Em grade" e "Em lista"`,
          names === 'Em grade|Em lista',
          names,
        );
        check(
          `${tag}: cartão com o título "Suas preferências"`,
          await page.getByRole('heading', { level: 2, name: 'Suas preferências' }).isVisible(),
        );
        await checkColumn(page, tag, size);
        await checkNoClip(page, tag);
        const zone = page.getByRole('button', { name: /^Fuso horário/ });
        await zone.click();
        const list = page.getByRole('listbox');
        await list.waitFor();
        await list.getByRole('option').first().waitFor();
        await page.waitForTimeout(150);
        check(
          `${tag}: seletor do fuso aberto, sem <select> nativo`,
          (await page.locator('select').count()) === 0 &&
            (await list.getByRole('option').count()) > 10,
        );
      },
    },
    {
      name: 'dashboard',
      to: '/settings/dashboard',
      run: async (page, tag, _theme, size) => {
        const group = page.getByRole('group', { name: 'Blocos visíveis' });
        await group.waitFor();
        const boxes = await group.getByRole('checkbox').count();
        const checked = await group.locator('input[type="checkbox"]:checked').count();
        check(
          `${tag}: blocos visíveis com uma caixa por bloco`,
          boxes === 6 && checked === 6,
          `${checked}/${boxes}`,
        );
        check(
          `${tag}: dica do olho dos blocos sensíveis`,
          await page.getByText(/o olho esconde o conteúdo/).isVisible(),
        );
        await checkColumn(page, tag, size);
        await checkNoClip(page, tag);
      },
    },
    {
      name: 'menu do perfil',
      to: '/settings',
      run: async (page, tag, _theme, size) => {
        await openSidebar(page, size);
        await page.getByRole('button', { name: USER_NAME }).click();
        const menu = page.getByRole('menu', { name: 'Conta' });
        await menu.waitFor();
        await page.waitForTimeout(150);
        const items = (await menu.getByRole('menuitem').allTextContents()).map((t) => t.trim());
        check(
          `${tag}: menu do perfil com Configurações`,
          items[0] === 'Configurações',
          items.join(' | '),
        );
        check(`${tag}: menu dentro da janela`, await inViewport(page, menu));
      },
    },
    {
      name: 'instância',
      to: '/settings/instance',
      run: async (page, tag, _theme, size) => {
        const form = page.getByRole('form', { name: 'Instância' });
        await form.waitFor();
        await form.getByLabel('Servidor SMTP').waitFor();
        check(
          `${tag}: sem campo de senha`,
          (await page.locator('input[type="password"]').count()) === 0,
        );
        const cancel = await form.getByRole('button', { name: 'Cancelar' }).boundingBox();
        const submit = await form.getByRole('button', { name: 'Salvar' }).boundingBox();
        const formBox = await form.boundingBox();
        check(
          `${tag}: "Cancelar" antes de "Salvar" à direita`,
          cancel.x < submit.x && formBox.x + formBox.width - (submit.x + submit.width) <= 24,
          `cancelar x ${Math.round(cancel.x)}, salvar x ${Math.round(submit.x)}`,
        );
        await checkColumn(page, tag, size);
        await checkNoClip(page, tag);
        const titles = ['Instância', 'E-mail (SMTP)', 'Papéis'];
        const visible = [];
        for (const name of titles) {
          visible.push(await page.getByRole('heading', { level: 2, name }).isVisible());
        }
        const boxes = [];
        for (const name of titles) {
          boxes.push(
            await page.getByRole('heading', { level: 2, name }).evaluate((el) => {
              const r = el.closest('[class*="grid"]').getBoundingClientRect();
              return { top: r.top, bottom: r.bottom };
            }),
          );
        }
        const gaps = [boxes[1].top - boxes[0].bottom, boxes[2].top - boxes[1].bottom];
        check(
          `${tag}: três cartões com título e 16 px entre eles`,
          visible.every(Boolean) && gaps.every((g) => g >= 15 && g <= 17),
          `espaços ${gaps.map((g) => g.toFixed(1)).join(' e ')}`,
        );
        check(
          `${tag}: seção Papéis com o link de usuários`,
          await page.getByRole('link', { name: 'Gerenciar usuários e papéis' }).isVisible(),
        );
      },
    },
  ],
  tema: [
    {
      name: 'abrir Configurações não muda o tema',
      to: '/settings',
      prefers: (theme) => (theme === 'light' ? 'dark' : 'light'),
      run: async (page, tag, theme, _size, patches) => {
        await page.getByRole('radiogroup', { name: 'Tema' }).waitFor();
        await page.waitForTimeout(300);
        const applied = await page.evaluate(() => document.documentElement.dataset.theme);
        check(`${tag}: tema do servidor mantido ao abrir`, applied === theme, applied);
        check(`${tag}: nenhum PATCH ao abrir`, patches.length === 0, patches.join(','));
      },
    },
    {
      name: 'Seguir o sistema acompanha o sistema',
      to: '/settings',
      run: async (page, tag, _theme, _size, patches) => {
        const group = page.getByRole('radiogroup', { name: 'Tema' });
        await group.waitFor();
        await group.getByRole('radio', { name: 'Seguir o sistema' }).check({ force: true });
        await page.waitForFunction(() => document.documentElement.dataset.theme);
        await page.waitForTimeout(200);
        check(
          `${tag}: PATCH em /me/preferences`,
          patches.includes('/me/preferences'),
          patches.join(','),
        );
        await page.emulateMedia({ colorScheme: 'dark' });
        await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
        check(`${tag}: sistema escuro, tema escuro sem recarregar`, true);
        await page.emulateMedia({ colorScheme: 'light' });
        await page.waitForFunction(() => document.documentElement.dataset.theme === 'light');
        check(`${tag}: sistema claro, tema claro sem recarregar`, true);
      },
      // O sistema termina claro: é o tema que a captura final mostra.
      expected: () => 'light',
    },
    {
      name: 'alternar tema grava no servidor',
      to: '/settings',
      run: async (page, tag, theme, size, patches) => {
        await openSidebar(page, size);
        await page
          .getByRole('button', { name: 'Menu da conta' })
          .or(page.getByRole('button', { name: USER_NAME }))
          .first()
          .click();
        await page.getByRole('menuitem', { name: 'Alternar tema' }).click();
        const other = theme === 'light' ? 'dark' : 'light';
        await page.waitForFunction((t) => document.documentElement.dataset.theme === t, other);
        await page.waitForTimeout(200);
        check(
          `${tag}: PATCH em /me/preferences e tema trocado`,
          patches.includes('/me/preferences'),
          patches.join(','),
        );
      },
      expected: (theme) => (theme === 'light' ? 'dark' : 'light'),
    },
  ],
  estados: [
    {
      name: 'instância · carregando',
      to: '/settings/instance',
      mode: 'loading',
      run: async (page, tag) => {
        const loading = page.getByText('Carregando as configurações…').first();
        await loading.waitFor({ state: 'attached' });
        await page.waitForTimeout(200);
        check(
          `${tag}: instância: indicador de carregamento visível`,
          (await page.locator('[aria-busy="true"], [role="status"]').count()) >= 1,
        );
      },
    },
    {
      name: 'instância · erro',
      to: '/settings/instance',
      mode: 'error',
      run: async (page, tag) => {
        const retry = page.getByRole('button', { name: 'Tentar de novo' });
        await retry.waitFor();
        check(
          `${tag}: instância: mensagem de erro visível`,
          (await page.getByText('Não foi possível carregar as configurações.').isVisible()) &&
            (await retry.isVisible()),
        );
      },
    },
    {
      name: 'instância · sem acesso',
      to: '/settings/instance',
      role: 'user',
      run: async (page, tag, _theme, _size, patches) => {
        const text = page.getByText('Só o administrador altera as configurações da instância.');
        await text.waitFor();
        await page.waitForTimeout(300);
        const editable = await page
          .locator('[data-scroll-area]')
          .locator('input, textarea, select')
          .count();
        check(
          `${tag}: usuário comum: texto de sem acesso e nenhum campo editável`,
          (await text.isVisible()) && editable === 0,
          `${editable} campo(s)`,
        );
        check(
          `${tag}: nenhum PATCH enviado pelo usuário comum`,
          patches.length === 0,
          patches.join(', '),
        );
        check(
          `${tag}: seção Instância fora da navegação`,
          (await page.getByRole('link', { name: 'Instância' }).count()) === 0,
        );
      },
    },
    {
      name: 'atalho · foco por teclado',
      to: '/settings',
      run: async (page, tag) => {
        const target = page.getByRole('button', { name: 'Gravar' });
        await target.waitFor();
        let reached = false;
        for (let i = 0; i < 80 && !reached; i += 1) {
          await page.keyboard.press('Tab');
          reached = await target.evaluate((el) => el === document.activeElement);
        }
        check(`${tag}: foco no botão "Gravar" depois de Tab`, reached);
        const outline = await outlineOf(target);
        check(
          `${tag}: contorno de foco visível · ≥ 2px`,
          outline.style !== 'none' && outline.width >= 2,
          `${outline.style} ${outline.width}px`,
        );
      },
    },
    {
      name: 'atalho · gravando',
      to: '/settings',
      run: async (page, tag) => {
        const target = page.getByRole('button', { name: 'Gravar' });
        await target.waitFor();
        let reached = false;
        for (let i = 0; i < 80 && !reached; i += 1) {
          await page.keyboard.press('Tab');
          reached = await target.evaluate((el) => el === document.activeElement);
        }
        await page.keyboard.press('Enter');
        await page.getByText('Pressione a combinação…').waitFor();
        await page.keyboard.press('Control+j');
        await page.getByText('Ctrl + J', { exact: true }).waitFor();
        const outline = await outlineOf(target);
        check(
          `${tag}: atalho gravado só pelo teclado (Ctrl + J) com o foco visível`,
          reached && outline.style !== 'none' && outline.width >= 2,
          `${outline.style} ${outline.width}px`,
        );
      },
    },
  ],
};

async function runScenarios(browser, base, group) {
  const shots = [];
  for (const sc of scenarios[group]) {
    for (const size of ['desktop', 'mobile']) {
      for (const theme of THEMES) {
        const label = `${sc.name} · ${SIZE_LABEL[size]} · ${THEME_LABEL[theme]}`;
        const tag = label;
        const { page, context, errors, patches } = await openPage(browser, {
          theme,
          size,
          role: sc.role ?? 'admin',
          mode: sc.mode ?? 'ok',
          ...(sc.prefers ? { prefers: sc.prefers(theme) } : {}),
        });
        try {
          await page.goto(`${base}${PAGE_PATH}?to=${encodeURIComponent(sc.to)}`);
          await page.locator('h1').first().waitFor();
          await page.evaluate(() => document.fonts.ready);
          await sc.run(page, tag, theme, size, patches);
          await baseChecks(page, errors, tag, sc.expected ? sc.expected(theme) : theme);
          shots.push({ group: sc.name, size, label, png: await page.screenshot() });
        } catch (e) {
          check(
            `${tag}: cenário executou`,
            false,
            String(e.message).split('\n').slice(0, 3).join(' '),
          );
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
  temas: async (browser, base) => {
    const shots = await runScenarios(browser, base, 'temas');
    await sheet(browser, {
      title: 'TASK-07 (SPEC-002) · Configurações: temas e larguras (RF-18, CT-17, RNF-02, RNF-03)',
      file: 'settings-themes-widths.png',
      shots,
    });
  },
  tema: async (browser, base) => {
    const shots = await runScenarios(browser, base, 'tema');
    await sheet(browser, {
      title: 'TASK-07 (SPEC-002) · Configurações: tema do servidor e do sistema (RF-17, CB-08)',
      file: 'settings-tema.png',
      shots,
    });
  },
  estados: async (browser, base) => {
    const shots = await runScenarios(browser, base, 'estados');
    await sheet(browser, {
      title: 'TASK-07 (SPEC-002) · Configurações: estados, acesso e foco (RN-12, RNF-06)',
      file: 'settings-states-focus.png',
      shots,
    });
  },
};

const names = process.argv.slice(2);
const unknown = names.filter((n) => !(n in EVIDENCES));
if (names.length === 0 || unknown.length > 0) {
  console.error(
    `Evidência desconhecida ou ausente: ${unknown.join(', ')}. Use temas, estados ou tema.`,
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
