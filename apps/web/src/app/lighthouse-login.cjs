// Login do Lighthouse CI (`puppeteerScript` do lighthouserc.json, TASK-35): prepara pela API o
// usuário de auditoria (ATRIA_LHCI_EMAIL e ATRIA_LHCI_PASSWORD) e entra antes das telas
// autenticadas. Com `disableStorageReset`, a sessão vale para todas as URLs.
const { createHmac, randomUUID } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const ORIGIN = 'http://localhost:4173';
const API = `${ORIGIN}/api/v1`;
const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
let signed_in = false;

function totpCode(secret, now = Date.now()) {
  let bits = '';
  for (const char of secret.replace(/=+$/, '').toUpperCase()) {
    bits += BASE32.indexOf(char).toString(2).padStart(5, '0');
  }
  const key = Buffer.from((bits.match(/.{8}/g) ?? []).map((byte) => parseInt(byte, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(now / 30000)));
  const mac = createHmac('sha1', key).update(counter).digest();
  const offset = mac[mac.length - 1] & 0x0f;
  return String((mac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).padStart(6, '0');
}

/** Cliente da API com cookies e o token CSRF, como o frontend faz. */
function session() {
  const cookies = new Map();
  return async function call(method, path, body) {
    const headers = { Accept: 'application/json' };
    if (cookies.size > 0) headers.Cookie = [...cookies].map(([k, v]) => `${k}=${v}`).join('; ');
    if (method !== 'GET' && cookies.has('atria_csrf'))
      headers['X-CSRF-Token'] = cookies.get('atria_csrf');
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const response = await fetch(`${API}${path}`, {
      method,
      headers,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    for (const line of response.headers.getSetCookie()) {
      const [pair] = line.split(';');
      const index = pair.indexOf('=');
      cookies.set(pair.slice(0, index).trim(), pair.slice(index + 1));
    }
    if (!response.ok)
      throw new Error(`${method} ${path}: ${response.status} ${await response.text()}`);
    return response.status === 204 ? undefined : response.json();
  };
}

/** Admin dos e2e (`e2e-sign-in-plugin.ts`), gravado no cache quando eles rodam antes. */
const E2E_ADMIN = join(__dirname, '../../node_modules/.cache/atria-e2e/admin.json');

/** O usuário de auditoria já entra? */
async function canSignIn(email, password) {
  const user = session();
  await user('GET', '/setup');
  try {
    await user('POST', '/auth/sign-in', { email, password });
    return true;
  } catch {
    return false;
  }
}

/**
 * Prepara o usuário de auditoria. Numa instância vazia (CI), cria o admin com TOTP; numa já
 * configurada pelos e2e (Verificação local), entra com o admin do cache deles. Depois, convida e
 * cadastra o usuário de auditoria.
 */
async function prepareAuditUser(email, password) {
  const admin = session();
  const status = await admin('GET', '/setup');
  if (status.required) {
    await admin('POST', '/setup', { email: `admin-${randomUUID()}@atria.test`, password });
    const enrollment = await admin('POST', '/auth/totp');
    await admin('POST', '/auth/totp/activation', { code: totpCode(enrollment.secret) });
  } else {
    if (await canSignIn(email, password)) return;
    let cached;
    try {
      cached = JSON.parse(readFileSync(E2E_ADMIN, 'utf8'));
    } catch {
      throw new Error(`instância já configurada, sem ${email} e sem ${E2E_ADMIN}`);
    }
    await admin('POST', '/auth/sign-in', {
      email: cached.email,
      password: cached.password,
      totp_code: totpCode(cached.secret),
    });
  }
  const invite = await admin('POST', '/admin/invites');
  const token = new URL(invite.link, ORIGIN).searchParams.get('invite');
  const user = session();
  await user('GET', '/setup');
  await user('POST', '/auth/sign-up', { email, password, invite_token: token });
}

module.exports = async (browser) => {
  const email = process.env.ATRIA_LHCI_EMAIL;
  const password = process.env.ATRIA_LHCI_PASSWORD;
  if (!email || !password) throw new Error('defina ATRIA_LHCI_EMAIL e ATRIA_LHCI_PASSWORD');
  const page = await browser.newPage();
  if (signed_in) {
    await page.goto(`${ORIGIN}/`);
    const ok = await page.evaluate(async () => (await fetch('/api/v1/me')).ok);
    await page.close();
    if (ok) return;
  }
  await prepareAuditUser(email, password);
  await page.goto(`${ORIGIN}/sign-in`);
  await page.waitForSelector('input[type="email"]');
  await page.type('input[type="email"]', email);
  await page.type('input[type="password"]', password);
  await Promise.all([
    page.waitForSelector('nav[aria-label="Principal"]'),
    page.click('button[type="submit"]'),
  ]);
  signed_in = true;
  await page.close();
};
