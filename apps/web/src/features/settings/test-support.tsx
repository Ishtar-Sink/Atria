import { vi } from 'vitest';
import { rootRoute } from '../../app/router';
import { renderWithProviders } from '../../shared/test/render';
import { createSettingsRoutes } from './routes';
import type { InstanceSettings } from './use-instance-settings';
import type { UserPreferences } from './use-user-preferences';

export const PREFERENCES: UserPreferences = {
  theme: 'system',
  locale: 'pt-BR',
  timezone: 'America/Sao_Paulo',
  currency: 'BRL',
  palette_shortcut: 'mod+k',
  search_contexts: [
    'finance',
    'goals',
    'tasks',
    'reminders',
    'notes',
    'journal',
    'library',
    'projects',
  ],
};

export const INSTANCE: InstanceSettings = {
  invite_required: true,
  web_push_enabled: false,
  smtp_host: 'smtp.casa.test',
  smtp_port: 587,
  smtp_user: 'atria',
  smtp_from: 'atria@casa.test',
};

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': status >= 400 ? 'application/problem+json' : 'application/json' },
  });
}

export interface ApiStub {
  role?: string;
  user_id?: string;
  preferences?: UserPreferences;
  instance?: InstanceSettings | 'loading' | 'error';
  vapid_key?: boolean;
  /** Resposta do PATCH de /me/preferences; por padrão devolve a preferência já mudada. */
  patch_preferences?: Response;
  patch_instance?: Response;
}

export interface Call {
  method: string;
  path: string;
  body: unknown;
}

/** Simula a API de Configurações e devolve as chamadas feitas. */
export function stubApi(options: ApiStub = {}) {
  const calls: Call[] = [];
  let preferences = options.preferences ?? PREFERENCES;
  let instance = options.instance ?? INSTANCE;
  vi.stubGlobal(
    'fetch',
    vi.fn((input: string, init?: RequestInit) => {
      const path = new URL(input, 'http://x').pathname.replace('/api/v1', '');
      const method = init?.method ?? 'GET';
      const body: unknown = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
      calls.push({ method, path, body });
      if (path === '/me') {
        return Promise.resolve(
          json({
            id: options.user_id ?? 'u1',
            email: 'a@casa.test',
            role: options.role ?? 'admin',
          }),
        );
      }
      if (path === '/me/preferences') {
        if (method === 'PATCH') {
          if (options.patch_preferences) return Promise.resolve(options.patch_preferences);
          preferences = { ...preferences, ...(body as Partial<UserPreferences>) };
        }
        return Promise.resolve(json(preferences));
      }
      if (path === '/web-push/public-key') {
        return Promise.resolve(
          options.vapid_key === false
            ? json({ code: 'web_push_disabled', title: 'off' }, 404)
            : json({ public_key: 'BKEY' }),
        );
      }
      if (path === '/admin/instance/settings') {
        if (instance === 'loading') return new Promise<Response>(() => undefined);
        if (instance === 'error') return Promise.resolve(json({ code: 'boom', title: 'x' }, 500));
        if (method === 'PATCH') {
          if (options.patch_instance) return Promise.resolve(options.patch_instance);
          instance = { ...instance, ...(body as Partial<InstanceSettings>) };
        }
        return Promise.resolve(json(instance));
      }
      return Promise.resolve(json({}));
    }),
  );
  return calls;
}

export function renderSettings(route = '/settings') {
  return renderWithProviders(null, { route, routes: createSettingsRoutes(rootRoute) });
}

export function patches(calls: Call[], path: string): unknown[] {
  return calls.filter((call) => call.method === 'PATCH' && call.path === path).map((c) => c.body);
}
