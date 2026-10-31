import { mkdir, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import type { Browser, Page } from '@playwright/test';
import type { Schemas } from '@atria/contracts';
import { api, signIn, type TestRole } from '../../app/e2e-session';

// As configurações da instância (convite, Web Push, SMTP) valem para todo o banco dos e2e, e os
// projetos do Playwright rodam em paralelo. Quem muda uma delas segura esta trava (uma pasta,
// criada de forma atômica) e devolve os valores de antes no fim (TASK-35).

const LOCK_DIR = join(process.cwd(), 'node_modules/.cache/atria-e2e/instance-settings.lock');
/** Uma trava mais velha que isto sobrou de uma execução interrompida. */
const STALE_MS = 90_000;
const WAIT_MS = 2 * 60_000;

async function acquire(): Promise<void> {
  const deadline = Date.now() + WAIT_MS;
  for (;;) {
    try {
      await mkdir(LOCK_DIR, { recursive: false });
      return;
    } catch {
      const age = await stat(LOCK_DIR).then(
        (info) => Date.now() - info.mtimeMs,
        () => 0,
      );
      if (age > STALE_MS) await rm(LOCK_DIR, { recursive: true, force: true });
      if (Date.now() > deadline) throw new Error('trava das configurações da instância ocupada');
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
}

type InstanceSettings = Schemas['InstanceSettingsResponse'];

function restorable(settings: InstanceSettings): Schemas['UpdateInstanceSettingsRequest'] {
  return {
    invite_required: settings.invite_required,
    web_push_enabled: settings.web_push_enabled,
    smtp_host: settings.smtp_host ?? '',
    smtp_port: settings.smtp_port ?? null,
    smtp_user: settings.smtp_user ?? '',
    smtp_from: settings.smtp_from ?? '',
  };
}

/**
 * Roda `body` com a trava das configurações da instância e, no fim, devolve as configurações
 * de antes pela sessão do admin (num contexto à parte). O cadastro volta sempre a exigir convite.
 */
export async function withInstanceSettings(
  browser: Browser,
  body: (before: InstanceSettings, admin: Page) => Promise<void>,
): Promise<void> {
  await acquire();
  const context = await browser.newContext();
  try {
    const admin = await context.newPage();
    await signIn(admin, 'admin');
    const before = await api<InstanceSettings>(admin, 'GET', '/admin/instance/settings');
    try {
      await body(before, admin);
    } finally {
      await api(admin, 'PATCH', '/admin/instance/settings', {
        ...restorable(before),
        invite_required: true,
      });
    }
  } finally {
    await context.close();
    await rm(LOCK_DIR, { recursive: true, force: true });
  }
}

export interface Person {
  page: Page;
  me: Schemas['MeResponse'];
  close: () => Promise<void>;
}

/** Uma pessoa nova com o papel pedido, num contexto à parte da página do teste. */
export async function openPerson(browser: Browser, role: TestRole = 'user'): Promise<Person> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await signIn(page, role);
  const me = await api<Schemas['MeResponse']>(page, 'GET', '/me');
  return { page, me, close: () => context.close() };
}
