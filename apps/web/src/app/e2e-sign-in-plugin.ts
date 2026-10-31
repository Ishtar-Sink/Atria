import { mkdir, readFile, writeFile } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { dirname, join } from 'node:path';
import type { Schemas } from '@atria/contracts';
import type { Plugin } from 'vite';
import { totpCode } from './e2e-totp';

const CSRF_COOKIE = 'atria_csrf';
export const E2E_PASSWORD = 'senha-de-teste-bem-longa';

export type TestRole = 'user' | 'elevated' | 'admin';

interface AdminCredentials {
  email: string;
  password: string;
  secret: string;
}

/** Cliente da API com os cookies de uma pessoa, guardados como o servidor os mandou. */
class ApiSession {
  private readonly raw = new Map<string, string>();

  constructor(private readonly api_url: string) {}

  /** Linhas `Set-Cookie` repassadas ao navegador, com os atributos do servidor. */
  setCookieLines(): string[] {
    return [...this.raw.values()];
  }

  private cookieHeader(): string {
    return [...this.raw.values()].map((line) => line.split(';')[0] ?? '').join('; ');
  }

  private cookie(name: string): string | undefined {
    const line = this.raw.get(name);
    return line?.split(';')[0]?.slice(name.length + 1);
  }

  async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (this.raw.size > 0) headers['Cookie'] = this.cookieHeader();
    if (method !== 'GET') {
      const token = this.cookie(CSRF_COOKIE);
      if (token) headers['X-CSRF-Token'] = token;
    }
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (path === '/transactions') headers['Idempotency-Key'] = crypto.randomUUID();
    const response = await fetch(`${this.api_url}${path}`, {
      method,
      headers,
      redirect: 'manual',
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    for (const line of response.headers.getSetCookie()) {
      const name = line.split('=')[0]?.trim();
      if (name) this.raw.set(name, line);
    }
    if (!response.ok) {
      throw new Error(`${method} ${path}: ${String(response.status)} ${await response.text()}`);
    }
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }

  get<T>(path: string): Promise<T> {
    return this.request<T>('GET', path);
  }

  post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('POST', path, body);
  }

  patch<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('PATCH', path, body);
  }
}

function localDate(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${String(now.getFullYear())}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Dados do dashboard: tarefa e lembrete de hoje, uma movimentação, o diário e um livro. */
async function seedDashboard(session: ApiSession): Promise<void> {
  const accounts = await session.get<Schemas['AccountPage']>('/accounts');
  const emotions = await session.get<Schemas['EmotionList']>('/emotions');
  const account = accounts.items[0];
  const emotion = emotions.items[0];
  await session.post('/tasks', { title: 'Revisar o orçamento', due_on: localDate() });
  await session.post('/reminders', {
    title: 'Ligar para a clínica',
    remind_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });
  if (account) {
    await session.post('/transactions', {
      account_id: account.id,
      kind: 'expense',
      description: 'Mercado',
      expected_amount: 15_000,
      expected_date: localDate(),
    });
  }
  await session.post('/journal-entries', {
    text: 'Dia tranquilo.',
    occurred_at: new Date().toISOString(),
    emotions: emotion ? [{ emotion_id: emotion.id, intensity: 3 }] : [],
  });
  await session.post('/books', {
    title: 'Grande Sertão: Veredas',
    page_count: 600,
    reading_status: 'reading',
  });
}

function inviteToken(link: string): string {
  const token = new URL(link, 'http://localhost').searchParams.get('invite');
  if (!token) throw new Error('convite sem token');
  return token;
}

/** Sessões de teste: o admin é criado uma vez e reaproveitado entre execuções pelo cache. */
export class E2eSessions {
  private admin: Promise<AdminCredentials> | null = null;

  constructor(
    private readonly api_url: string,
    private readonly cache_file: string,
  ) {}

  private async createAdmin(): Promise<AdminCredentials> {
    const session = new ApiSession(this.api_url);
    const status = await session.get<Schemas['SetupStatus']>('/setup');
    if (!status.required) {
      try {
        return JSON.parse(await readFile(this.cache_file, 'utf8')) as AdminCredentials;
      } catch {
        throw new Error(
          `instância já configurada sem ${this.cache_file}: apague os volumes do projeto atria-e2e`,
        );
      }
    }
    const email = `admin-${crypto.randomUUID()}@atria.test`;
    await session.post('/setup', { email, password: E2E_PASSWORD });
    const enrollment = await session.post<Schemas['TotpEnrollmentResponse']>('/auth/totp');
    await session.post('/auth/totp/activation', { code: await totpCode(enrollment.secret) });
    const credentials = { email, password: E2E_PASSWORD, secret: enrollment.secret };
    await mkdir(dirname(this.cache_file), { recursive: true });
    await writeFile(this.cache_file, JSON.stringify(credentials));
    return credentials;
  }

  private async adminSession(): Promise<ApiSession> {
    this.admin ??= this.createAdmin();
    const credentials = await this.admin.catch((error: unknown) => {
      this.admin = null;
      throw error;
    });
    const session = new ApiSession(this.api_url);
    await session.get('/setup');
    await session.post('/auth/sign-in', {
      email: credentials.email,
      password: credentials.password,
      totp_code: await totpCode(credentials.secret),
    });
    return session;
  }

  /** Abre a sessão de uma pessoa nova com o papel pedido; o admin entra como ele mesmo. */
  async open(role: TestRole, seed: string | null): Promise<ApiSession> {
    const admin = await this.adminSession();
    if (role === 'admin') return admin;
    const invite = await admin.post<Schemas['InviteResponse']>('/admin/invites');
    const email = `e2e-${crypto.randomUUID()}@atria.test`;
    const user = new ApiSession(this.api_url);
    await user.get('/setup');
    const me = await user.post<Schemas['MeResponse']>('/auth/sign-up', {
      email,
      password: E2E_PASSWORD,
      invite_token: inviteToken(invite.link),
    });
    if (role === 'elevated') {
      await admin.patch(`/admin/users/${me.id}`, { role: 'elevated' });
      await user.post('/auth/sign-in', { email, password: E2E_PASSWORD });
    }
    if (seed === 'dashboard') await seedDashboard(user);
    return user;
  }
}

function parseRole(value: string | null): TestRole {
  return value === 'admin' || value === 'elevated' ? value : 'user';
}

/**
 * `/__test__/sign-in?role=<papel>&seed=<dados>`, a entrada dos e2e das features (TASK-35).
 * Responde com os cookies da sessão e o redirecionamento para `/`, para o `page.goto` voltar
 * já com a sessão aberta. Só existe no `vite preview --mode e2e`.
 */
export function e2eSignInPlugin(api_url = 'http://localhost:8080/api/v1'): Plugin {
  let sessions: E2eSessions | null = null;
  return {
    name: 'atria-e2e-sign-in',
    configResolved(config) {
      sessions = new E2eSessions(
        api_url,
        join(config.root, 'node_modules/.cache/atria-e2e/admin.json'),
      );
    },
    configurePreviewServer(server) {
      server.middlewares.use(
        '/__test__/sign-in',
        (request: IncomingMessage, response: ServerResponse) => {
          const query = new URL(request.url ?? '/', 'http://localhost').searchParams;
          if (!sessions) return;
          sessions.open(parseRole(query.get('role')), query.get('seed')).then(
            (session) => {
              response.statusCode = 302;
              response.setHeader('Set-Cookie', session.setCookieLines());
              response.setHeader('Location', '/');
              response.end();
            },
            (error: unknown) => {
              response.statusCode = 500;
              response.setHeader('Content-Type', 'text/plain; charset=utf-8');
              response.end(error instanceof Error ? error.message : String(error));
            },
          );
        },
      );
    },
  };
}
