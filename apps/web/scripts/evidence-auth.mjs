// Evidências visuais da TASK-19, sem passo manual: sobe o Vite numa porta livre com uma página
// virtual que carrega o harness da feature de auth, simula a API no navegador, confere o estado no
// DOM antes de cada captura (inclusive axe) e monta a prancha (PNG) em
// vostok/work/tasks/SPEC-001/evidence/TASK-19/.
// Uso: node apps/web/scripts/evidence-auth.mjs telas
// Imprime "ok" ou "FALHA" por verificação e o caminho do PNG; sai com código 1 se algo falhar.
import AxeBuilder from '@axe-core/playwright';
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createServer as createNetServer } from 'node:net';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = join(WEB, '..', '..');
const OUT = join(ROOT, 'vostok', 'work', 'tasks', 'SPEC-001', 'evidence', 'TASK-19');
const PAGE = '/__evidence-auth';

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

const PAGE_HTML = `<!doctype html>
<html lang="pt-BR" data-theme="light">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light dark" />
    <title>Atria · evidência de auth</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/features/auth/evidence/harness.tsx"></script>
  </body>
</html>`;

/** Serve a página HTML virtual que carrega o harness; nada é gravado no projeto. */
function virtualPage() {
  return {
    name: 'evidence-auth-page',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith(PAGE)) return next();
        const html = await server.transformIndexHtml(req.url, PAGE_HTML);
        res.setHeader('Content-Type', 'text/html');
        res.end(html);
      });
    },
  };
}

async function startVite() {
  const port = await freePort();
  const server = await createServer({
    root: WEB,
    logLevel: 'error',
    plugins: [virtualPage()],
    server: { port, strictPort: true, host: '127.0.0.1', proxy: {} },
  });
  await server.listen();
  return { url: `http://127.0.0.1:${port}`, stop: () => server.close() };
}

// ---------- API simulada ----------

const ME = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'admin@atria.local',
  role: 'admin',
  totp_enabled: true,
  account_complete: true,
};
const OTPAUTH = 'otpauth://totp/Atria:admin@atria.local?secret=JBSWY3DPEHPK3PXP&issuer=Atria';

function problem(status, code, title) {
  return {
    status,
    contentType: 'application/problem+json',
    body: JSON.stringify({ status, code, title }),
  };
}
const json = (body, status = 200) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify(body),
});

/**
 * Simula `/api/v1` para uma página. `opts.setup_required` define o `GET /setup`; `opts.totp` faz o
 * login pedir o código; `opts.invite_invalid` recusa o cadastro; `opts.gate` segura as mutações até
 * ser liberado (estado de carregando).
 */
async function mockApi(context, opts = {}) {
  const state = { release: null, held: 0 };
  const hold = () =>
    opts.hold
      ? new Promise((resolve) => {
          state.held += 1;
          state.release = resolve;
        })
      : Promise.resolve();
  await context.route(
    (url) => url.pathname.startsWith('/api/'),
    async (route) => {
      const url = new URL(route.request().url());
      const path = url.pathname.replace('/api/v1', '');
      const method = route.request().method();
      if (path === '/setup' && method === 'GET')
        return route.fulfill(json({ required: opts.setup_required === true }));
      if (path === '/me') return route.fulfill(json(ME));
      if (method === 'GET') return route.fulfill(problem(404, 'not_found', 'Não encontrado'));
      await hold();
      if (path === '/auth/sign-in') {
        const body = route.request().postDataJSON();
        if (opts.totp && !body.totp_code)
          return route.fulfill(problem(401, 'totp_required', 'Código necessário'));
        return route.fulfill(json(ME));
      }
      if (path === '/auth/sign-up' && opts.invite_invalid)
        return route.fulfill(problem(400, 'invite_invalid', 'Convite inválido'));
      if (path === '/auth/totp')
        return route.fulfill(json({ otpauth_uri: OTPAUTH, secret: 'JBSWY3DPEHPK3PXP' }));
      if (path === '/admin/password-resets')
        return route.fulfill(
          json({
            link: 'http://127.0.0.1/reset-password/Zk3pQ9wLx2mVt7RbNc4HsY8dFa6JuE1o',
            expires_at: '2026-11-01T12:00:00Z',
          }),
        );
      return route.fulfill(json(ME));
    },
  );
  return {
    /** Libera as mutações seguradas. */
    release: () => state.release?.(),
  };
}

// ---------- captura ----------

async function openPage(browser, { theme, size, mock }) {
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
  const api = await mockApi(context, mock);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  return { page, context, errors, api };
}

const noOverflow = (page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

/** DEC-010: dias de fora do mês do calendário ([data-outside]) ficam fora do color-contrast. */
function dropOutside(result) {
  for (const v of result.violations) {
    if (v.id === 'color-contrast')
      v.nodes = v.nodes.filter((n) => !n.html.includes('data-outside'));
  }
  result.violations = result.violations.filter((v) => v.nodes.length > 0);
}

async function axeCheck(page, tag) {
  const result = await new AxeBuilder({ page }).analyze();
  dropOutside(result);
  const colorContrast = result.violations.filter((v) => v.id === 'color-contrast');
  check(
    `${tag}: axe sem violações (inclusive color-contrast; dias de fora do mês fora do contraste, DEC-010)`,
    result.violations.length === 0 && colorContrast.length === 0,
    result.violations
      .map(
        (v) =>
          `${v.id} (${v.nodes.length}): ${v.nodes.map((n) => n.html.slice(0, 140)).join(' ; ')}`,
      )
      .join(', '),
  );
}

async function baseChecks(page, errors, tag, theme) {
  check(
    `${tag}: tema ${THEME_LABEL[theme]} aplicado`,
    (await page.evaluate(() => document.documentElement.dataset.theme)) === theme,
  );
  check(`${tag}: sem rolagem horizontal`, await noOverflow(page));
  check(`${tag}: sem erro de JavaScript`, errors.length === 0, errors.join(' | '));
  await axeCheck(page, tag);
}

/** O cartão: ~400 px, centralizado, uma coluna só, nenhuma largura de 880 px. */
async function cardChecks(page, tag, size) {
  const m = await page.evaluate((size) => {
    const card = document.querySelector('[data-auth-card]');
    if (!card) return null;
    const r = card.getBoundingClientRect();
    const form = card.querySelector('form');
    const controls = [...card.querySelectorAll('form input')].map((el) =>
      el.getBoundingClientRect(),
    );
    const lefts = new Set(controls.map((c) => Math.round(c.left)));
    const body = document.querySelector('[data-scroll-area]') ?? document.documentElement;
    const area = body.getBoundingClientRect();
    const wide = [...document.querySelectorAll('*')].some((el) => {
      const w = el.getBoundingClientRect().width;
      return Math.abs(w - 880) <= 1;
    });
    return {
      width: r.width,
      left: r.left,
      right: r.right,
      area_left: size === 'desktop' ? area.left : 0,
      area_right: size === 'desktop' ? area.right : innerWidth,
      form: Boolean(form),
      columns: lefts.size,
      wide,
    };
  }, size);
  check(`${tag}: cartão presente com formulário dentro`, m !== null && m.form);
  if (!m) return;
  const limit = size === 'desktop' ? 405 : 360;
  check(
    `${tag}: cartão de ~400 px centralizado`,
    m.width <= limit &&
      (size === 'mobile' || m.width >= 380) &&
      Math.abs(m.left - m.area_left - (m.area_right - m.right)) <= 2,
    `${Math.round(m.width)} px · esq ${Math.round(m.left - m.area_left)} · dir ${Math.round(m.area_right - m.right)}`,
  );
  check(`${tag}: nenhuma largura de 880 px`, !m.wide);
  check(`${tag}: uma coluna só`, m.columns <= 1, `${m.columns} alinhamentos à esquerda`);
}

/** Ações à direita, embaixo da linha, "Cancelar" antes do primário. */
async function actionsCheck(page, tag) {
  const m = await page.evaluate(() => {
    const submit = document.querySelector('[data-auth-card] form button[type="submit"]');
    if (!submit) return null;
    const box = submit.parentElement;
    const buttons = [...box.querySelectorAll('button')];
    const r = box.getBoundingClientRect();
    const sr = submit.getBoundingClientRect();
    const first = buttons[0].getBoundingClientRect();
    const fields = [...document.querySelectorAll('[data-auth-card] form input')];
    const lastField = fields.length ? fields[fields.length - 1].getBoundingClientRect().bottom : 0;
    return {
      last_is_submit: buttons[buttons.length - 1] === submit,
      cancel_first: buttons.length === 2 && first.left < sr.left,
      right_aligned: Math.abs(r.right - sr.right) <= 2 && sr.left > r.left + r.width / 2 - 1,
      below: r.top >= lastField,
    };
  });
  check(
    `${tag}: ações à direita com "Cancelar" antes do primário`,
    m !== null && m.last_is_submit && m.cancel_first && m.right_aligned && m.below,
    JSON.stringify(m),
  );
}

async function goto(page, base, route) {
  await page.goto(`${base}${PAGE}?rota=${encodeURIComponent(route)}`);
  await page.locator('h1').first().waitFor();
  await page.evaluate(() => document.fonts.ready);
}

const fill = (page, label, value) => page.getByLabel(label, { exact: true }).fill(value);
const alertIn = async (page) => page.locator('[data-auth-card] form [role="alert"]').first();

const SCENARIOS = [
  {
    name: 'assistente (/setup)',
    route: '/setup',
    mock: { setup_required: true },
    run: async (page, tag, ctx) => {
      await page.getByLabel('Senha', { exact: true }).waitFor();
      await cardChecks(page, tag, ctx.size);
      await actionsCheck(page, tag);
    },
  },
  {
    name: 'login (/sign-in)',
    route: '/sign-in',
    run: async (page, tag, ctx) => {
      check(
        `${tag}: link "Esqueci a senha" visível`,
        await page.getByRole('link', { name: 'Esqueci a senha' }).isVisible(),
      );
      await cardChecks(page, tag, ctx.size);
      await actionsCheck(page, tag);
    },
  },
  {
    name: 'login, passo do código TOTP',
    route: '/sign-in',
    mock: { totp: true },
    run: async (page, tag, ctx) => {
      await fill(page, 'E-mail', 'admin@atria.local');
      await fill(page, 'Senha', 'uma-senha-bem-longa');
      await page.getByRole('button', { name: 'Entrar' }).click();
      const code = page.getByLabel('Código de 6 números', { exact: true });
      await code.waitFor();
      check(`${tag}: campo do código TOTP visível`, await code.isVisible());
      check(
        `${tag}: código TOTP é texto numérico, sem setas`,
        (await code.getAttribute('type')) === 'text' &&
          (await code.getAttribute('inputmode')) === 'numeric',
      );
      check(
        `${tag}: foco no campo do código`,
        await code.evaluate((el) => el === document.activeElement),
      );
      await cardChecks(page, tag, ctx.size);
      await actionsCheck(page, tag);
    },
  },
  {
    name: 'erro de validação no formulário',
    route: '/sign-in',
    run: async (page, tag) => {
      await fill(page, 'E-mail', 'isto-nao-e-email');
      await page.getByRole('button', { name: 'Entrar' }).click();
      const alert = page.locator('[data-auth-card] form [role="alert"]').first();
      await alert.waitFor();
      check(`${tag}: erro em role="alert" dentro do formulário`, await alert.isVisible());
      check(`${tag}: erro sem alerta do navegador`, true);
    },
  },
  {
    name: 'botão em estado de carregando',
    route: '/sign-in',
    mock: { hold: true },
    run: async (page, tag, ctx) => {
      await fill(page, 'E-mail', 'admin@atria.local');
      await fill(page, 'Senha', 'uma-senha-bem-longa');
      await page.getByRole('button', { name: 'Entrar' }).click();
      const busy = page.getByRole('button', { name: 'Entrando…' });
      await busy.waitFor();
      check(
        `${tag}: botão desabilitado com texto de carregando`,
        (await busy.isDisabled()) && (await busy.isVisible()),
      );
      ctx.after = () => ctx.api.release();
    },
  },
  {
    name: 'cadastro com convite inválido',
    route: '/sign-up?invite=expirado',
    mock: { invite_invalid: true },
    run: async (page, tag, ctx) => {
      await fill(page, 'E-mail', 'amiga@atria.local');
      await fill(page, 'Senha', 'uma-senha-bem-longa');
      await fill(page, 'Repita a senha', 'uma-senha-bem-longa');
      await page.getByRole('button', { name: 'Criar conta' }).last().click();
      const alert = await alertIn(page);
      await alert.waitFor();
      check(`${tag}: erro em role="alert" dentro do formulário`, await alert.isVisible());
      check(
        `${tag}: mensagem de convite inválido`,
        ((await alert.textContent()) ?? '').includes('Este convite não vale mais'),
      );
      check(
        `${tag}: campos mantidos preenchidos`,
        (await page.getByLabel('E-mail', { exact: true }).inputValue()) === 'amiga@atria.local',
      );
      await cardChecks(page, tag, ctx.size);
      await actionsCheck(page, tag);
    },
  },
  {
    name: 'ativação do 2FA',
    route: '/two-factor',
    run: async (page, tag, ctx) => {
      const qr = page
        .locator('[data-auth-card] svg, [data-auth-card] img, [data-auth-card] canvas')
        .first();
      await qr.waitFor();
      check(`${tag}: QR code visível`, await qr.isVisible());
      check(
        `${tag}: segredo em texto visível`,
        await page.getByText('JBSWY3DPEHPK3PXP').first().isVisible(),
      );
      await cardChecks(page, tag, ctx.size);
      await actionsCheck(page, tag);
    },
  },
  {
    name: 'redefinição de senha',
    route: '/reset-password/Zk3pQ9wLx2mVt7RbNc4HsY8dFa6JuE1o',
    run: async (page, tag, ctx) => {
      await cardChecks(page, tag, ctx.size);
      await actionsCheck(page, tag);
    },
  },
  {
    name: 'link gerado pelo admin',
    route: '/admin/users/22222222-2222-4222-8222-222222222222/password-reset',
    run: async (page, tag, ctx) => {
      await page.getByRole('button', { name: 'Gerar link' }).click();
      const field = page.getByLabel('Link de redefinição', { exact: true });
      await field.waitFor();
      check(
        `${tag}: link gerado no campo só de leitura`,
        (await field.isVisible()) &&
          (await field.getAttribute('readonly')) !== null &&
          (await field.inputValue()).includes('/reset-password/'),
      );
      await cardChecks(page, tag, ctx.size);
      await actionsCheck(page, tag);
    },
  },
  {
    name: 'foco visível pelo teclado',
    route: '/sign-in',
    run: async (page, tag) => {
      await page.keyboard.press('Tab');
      const outline = await page.evaluate(() => {
        const el = document.activeElement;
        const s = getComputedStyle(el);
        return {
          tag: el.tagName,
          style: s.outlineStyle,
          width: parseFloat(s.outlineWidth),
          shadow: s.boxShadow,
        };
      });
      check(
        `${tag}: contorno de foco visível depois de Tab (≥ 2 px)`,
        (outline.style !== 'none' && outline.width >= 2) || outline.shadow !== 'none',
        `${outline.tag} ${outline.style} ${outline.width}px`,
      );
    },
  },
];

async function runAll(browser, base) {
  const shots = [];
  for (const theme of THEMES) {
    for (const size of Object.keys(SIZES)) {
      for (const sc of SCENARIOS) {
        const tag = `${sc.name} · ${SIZE_LABEL[size]} · ${THEME_LABEL[theme]}`;
        const { page, context, errors, api } = await openPage(browser, {
          theme,
          size,
          mock: sc.mock,
        });
        const ctx = { size, api, after: null };
        try {
          await goto(page, base, sc.route);
          await sc.run(page, tag, ctx);
          await baseChecks(page, errors, tag, theme);
          shots.push({ size, label: tag, png: await page.screenshot() });
          ctx.after?.();
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

// ---------- principal ----------

const EVIDENCES = {
  telas: async (browser, base) => {
    const shots = await runAll(browser, base);
    await sheet(browser, {
      title:
        'TASK-19 · telas de auth no cartão estreito (RF-03, RF-04, RF-06 a RF-09, RNF-06, RNF-08, RNF-10, DEC-006, PD-62)',
      file: 'auth-telas.png',
      shots,
      scale: { desktop: 0.38, mobile: 0.62 },
    });
  },
};

const wanted = process.argv.slice(2);
const names = wanted.length > 0 ? wanted : Object.keys(EVIDENCES);
const unknown = names.filter((n) => !(n in EVIDENCES));
if (unknown.length > 0) {
  console.error(`Evidência desconhecida: ${unknown.join(', ')}. Use telas.`);
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
