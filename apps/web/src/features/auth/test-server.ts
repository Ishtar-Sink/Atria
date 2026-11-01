import { within } from '@testing-library/react';
import { expect, vi } from 'vitest';
import { rootRoute } from '../../app/router';
import { renderWithProviders } from '../../shared/test/render';
import { createAuthRoutes } from './routes';

export interface MockCall {
  method: string;
  path: string;
  body: unknown;
}

export interface MockReply {
  status: number;
  body?: unknown;
  /** A resposta nunca chega: mantém a tela no estado de envio. */
  hang?: boolean;
}

export type MockHandler = MockReply | ((call: MockCall) => MockReply);

/** Servidor simulado das telas de auth: troca o `fetch` global e registra as chamadas. */
export function mockApi(routes: Record<string, MockHandler>) {
  const calls: MockCall[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((input: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      const path = input.replace(/^\/api\/v1/, '').replace(/\?.*$/, '');
      const body: unknown = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
      const call = { method, path, body };
      if (path !== '/me/preferences') calls.push(call);
      const handler = routes[`${method} ${path}`];
      const reply: MockReply =
        handler === undefined
          ? { status: 404, body: { code: 'not_found', title: 'not found' } }
          : typeof handler === 'function'
            ? handler(call)
            : handler;
      if (reply.hang) return new Promise<Response>(() => undefined);
      const payload = reply.body === undefined ? null : JSON.stringify(reply.body);
      return Promise.resolve(
        new Response(reply.status === 204 ? null : payload, {
          status: reply.status,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    }),
  );
  return { calls };
}

export function problem(status: number, code: string): MockReply {
  return { status, body: { code, title: code } };
}

/** Monta o app com as rotas de auth reais, num roteador em memória. */
export function renderAuthRoute(path: string) {
  return renderWithProviders(null, { routes: createAuthRoutes(rootRoute, rootRoute), route: path });
}

/** O primário (submit) é o último botão do `FormActions`, à direita da linha (PD-62). */
export function expectPrimaryLast(form: HTMLElement) {
  const actions = form.querySelector<HTMLElement>('[data-span="full"]');
  expect(actions).not.toBeNull();
  const buttons = within(actions as HTMLElement).getAllByRole('button');
  expect(buttons.length).toBeGreaterThan(1);
  expect(buttons.at(-1)).toHaveAttribute('type', 'submit');
}

/** O formulário fica no cartão estreito e não usa a grade de 880 px (DEC-006). */
export function expectInNarrowCard(form: HTMLElement) {
  const card = form.closest<HTMLElement>('[data-auth-card]');
  expect(card).not.toBeNull();
  expect((card as HTMLElement).querySelector('.grid')).toBeNull();
}
