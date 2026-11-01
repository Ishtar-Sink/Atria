import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { rootRoute } from '../../app/router';
import { renderWithProviders } from '../../shared/test/render';
import { clearToasts } from '../../shared/toast/toast-store';
import { createJournalRoutes } from './routes';
import type { Emotion } from './use-emotions';
import type { JournalEntry } from './use-journal-entries';

interface Call {
  method: string;
  url: URL;
  body: unknown;
}

interface World {
  entries: JournalEntry[];
  emotions: Emotion[];
  calls: Call[];
  intercept?: (call: Call) => Response | Promise<Response> | undefined;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

function emotion(
  id: string,
  system_key: Emotion['system_key'],
  name: string | null = null,
): Emotion {
  return {
    id,
    owner_id: 'u1',
    name,
    system_key,
    visibility: 'personal',
    created_at: '2026-10-01T10:00:00Z',
    updated_at: '2026-10-01T10:00:00Z',
  };
}

function entry(overrides: Partial<JournalEntry> & Pick<JournalEntry, 'id' | 'text'>): JournalEntry {
  return {
    owner_id: 'u1',
    occurred_at: '2026-11-04T23:30:00Z',
    emotions: [],
    visibility: 'personal',
    created_at: '2026-11-04T23:31:00Z',
    updated_at: '2026-11-04T23:31:00Z',
    ...overrides,
  };
}

function world(): World {
  return {
    entries: [
      entry({
        id: 'e1',
        text: 'Dia leve no parque.',
        occurred_at: '2026-11-04T23:30:00Z',
        emotions: [
          { emotion_id: 'em-joy', intensity: 4, name: null, system_key: 'joy', deleted: false },
          { emotion_id: 'em-calm', name: null, system_key: 'calm', deleted: false },
        ],
      }),
      entry({ id: 'e2', text: 'Fim de tarde corrido.', occurred_at: '2026-11-04T20:00:00Z' }),
      entry({ id: 'e3', text: 'Uma conversa difícil.', occurred_at: '2026-10-10T15:00:00Z' }),
    ],
    emotions: [
      emotion('em-joy', 'joy'),
      emotion('em-anxiety', 'anxiety'),
      emotion('em-calm', 'calm'),
    ],
    calls: [],
  };
}

function handle(state: World, call: Call): Response {
  const path = call.url.pathname.replace('/api/v1', '');
  const params = call.url.searchParams;
  if (path === '/emotions') {
    if (call.method === 'GET') return json({ items: state.emotions });
    const created = emotion(
      `em-${String(state.emotions.length + 1)}`,
      null,
      (call.body as { name: string }).name,
    );
    state.emotions.push(created);
    return json(created, 201);
  }
  const one_emotion = /^\/emotions\/([^/]+)$/.exec(path);
  if (one_emotion?.[1] !== undefined) {
    const index = state.emotions.findIndex((item) => item.id === one_emotion[1]);
    const found = state.emotions[index];
    if (found === undefined) return json({ code: 'not_found', title: 'x' }, 404);
    if (call.method === 'DELETE') {
      state.emotions.splice(index, 1);
      return new Response(null, { status: 204 });
    }
    found.name = (call.body as { name: string }).name;
    return json(found);
  }
  if (path === '/journal-entries') {
    if (call.method === 'GET') {
      const from = params.get('from');
      const to = params.get('to');
      const emotion_id = params.get('emotion_id');
      const items = state.entries.filter(
        (item) =>
          (from === null || item.occurred_at >= from) &&
          (to === null || item.occurred_at < to) &&
          (emotion_id === null || item.emotions.some((e) => e.emotion_id === emotion_id)),
      );
      return json({ items });
    }
    const body = call.body as {
      occurred_at: string;
      text: string;
      emotions: { emotion_id: string; intensity?: number }[];
    };
    const created = entry({
      id: `e${String(state.entries.length + 1)}`,
      text: body.text,
      occurred_at: new Date(body.occurred_at).toISOString(),
      emotions: body.emotions.map((item) => ({
        emotion_id: item.emotion_id,
        intensity: item.intensity ?? null,
        name: null,
        system_key: null,
        deleted: false,
      })),
    });
    state.entries.push(created);
    return json(created, 201);
  }
  const one = /^\/journal-entries\/([^/]+)$/.exec(path);
  if (one?.[1] !== undefined) {
    const index = state.entries.findIndex((item) => item.id === one[1]);
    const found = state.entries[index];
    if (found === undefined) return json({ code: 'not_found', title: 'x' }, 404);
    if (call.method === 'GET') return json(found);
    if (call.method === 'DELETE') {
      state.entries.splice(index, 1);
      return new Response(null, { status: 204 });
    }
    Object.assign(found, call.body);
    return json(found);
  }
  return json({ code: 'not_found', title: 'x' }, 404);
}

function install(state: World) {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: string, init?: RequestInit) => {
      const call: Call = {
        method: init?.method ?? 'GET',
        url: new URL(input, 'http://localhost'),
        body: typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : undefined,
      };
      state.calls.push(call);
      return Promise.resolve(state.intercept?.(call) ?? handle(state, call));
    }),
  );
}

function open(route: string, state: World = world(), options: { extra?: boolean } = {}) {
  install(state);
  const routes = createJournalRoutes(
    rootRoute,
    options.extra
      ? { extra_tabs: [{ id: 'links', label: 'Conexões', render: () => <p>Ligações</p> }] }
      : {},
  );
  const view = renderWithProviders(null, { routes, route });
  return { state, ...view };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-11-05T12:00:00Z') });
  clearToasts();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const posts = (state: World) => state.calls.filter((call) => call.method === 'POST');

async function writeEntry(user: ReturnType<typeof userEvent.setup>, text: string) {
  await user.type(await screen.findByRole('textbox', { name: 'Texto' }), text);
}

describe('journal entry form', () => {
  it('creates an entry with date, time, text and two emotions', async () => {
    const user = userEvent.setup();
    const { state, router } = open('/journal/new');
    await writeEntry(user, 'Um dia bom.');
    await user.click(await screen.findByRole('button', { name: 'Alegria' }));
    await user.click(screen.getByRole('button', { name: 'Calma' }));
    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => {
      expect(posts(state)).toHaveLength(1);
    });
    // O relógio fixo é 12:00 UTC, 09:00 no fuso do usuário.
    expect(posts(state)[0]?.body).toEqual({
      occurred_at: '2026-11-05T09:00:00-03:00',
      text: 'Um dia bom.',
      emotions: [{ emotion_id: 'em-joy' }, { emotion_id: 'em-calm' }],
      visibility: 'personal',
    });
    await waitFor(() => {
      expect(router.state.location.pathname).toMatch(/^\/journal\/e\d+$/);
    });
  });

  it('allows a second entry on the same day', async () => {
    const user = userEvent.setup();
    const { state, router } = open('/journal/new');
    await writeEntry(user, 'Primeira de hoje.');
    await user.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => {
      expect(posts(state)).toHaveLength(1);
    });

    await router.navigate({ to: '/journal/new' });
    await writeEntry(user, 'Segunda de hoje.');
    await user.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => {
      expect(posts(state)).toHaveLength(2);
    });
    const days = posts(state).map((call) =>
      (call.body as { occurred_at: string }).occurred_at.slice(0, 10),
    );
    expect(days).toEqual(['2026-11-05', '2026-11-05']);
  });

  it('shows the validation error inside the form with role alert', async () => {
    const user = userEvent.setup();
    const { state, container } = open('/journal/new');
    await screen.findByRole('textbox', { name: 'Texto' });
    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Escreva algo na entrada.');
    expect(container.querySelector('form')).toContainElement(alert);
    expect(posts(state)).toHaveLength(0);
  });

  it('edits an existing entry', async () => {
    const user = userEvent.setup();
    const { state } = open('/journal/e1/edit');
    const text = await screen.findByRole('textbox', { name: 'Texto' });
    expect(text).toHaveValue('Dia leve no parque.');
    expect(await screen.findByRole('button', { name: 'Alegria' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('radio', { name: '4 de 5', checked: true })).toBeInTheDocument();

    await user.clear(text);
    await user.type(text, 'Dia leve e longo.');
    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => {
      expect(state.calls.some((call) => call.method === 'PATCH')).toBe(true);
    });
    expect(state.calls.find((call) => call.method === 'PATCH')?.body).toMatchObject({
      occurred_at: '2026-11-04T20:30:00-03:00',
      text: 'Dia leve e longo.',
      emotions: [{ emotion_id: 'em-joy', intensity: 4 }, { emotion_id: 'em-calm' }],
    });
  });

  it('has no axe violations', async () => {
    const { container } = open('/journal/new');
    await screen.findByRole('textbox', { name: 'Texto' });
    expect(await axe(container)).toHaveNoViolations();
  });

  it('pd62 lays the form in the grid with text, emotions and visibility on the full row', async () => {
    const { container } = open('/journal/new');
    const text = await screen.findByRole('textbox', { name: 'Texto' });
    expect(text.closest('[data-span="full"]')).not.toBeNull();
    expect(
      screen.getByRole('group', { name: 'Emoções' }).closest('[data-span="full"]'),
    ).not.toBeNull();
    const visibility = screen.getByRole('radiogroup', { name: 'Visibilidade' });
    expect(visibility.closest('[data-span="full"]')).not.toBeNull();

    expect(container.querySelector('select')).toBeNull();
    expect(container.querySelector('input[type=date]')).toBeNull();
    expect(container.querySelector('input[type=time]')).toBeNull();
    expect(container.querySelector('input[type=datetime-local]')).toBeNull();

    const form = container.querySelector('form');
    const names = within(form as HTMLElement)
      .getAllByRole('button')
      .map((button) => button.textContent);
    expect(names.indexOf('Cancelar')).toBeGreaterThanOrEqual(0);
    expect(names.indexOf('Cancelar')).toBeLessThan(names.indexOf('Salvar'));
  });

  it('pd57 picks the date in the custom calendar and types 2130 as 21:30', async () => {
    const user = userEvent.setup();
    const { state } = open('/journal/new');
    await writeEntry(user, 'Noite tranquila.');

    await user.click(screen.getByRole('button', { name: /Data e hora: data/ }));
    await user.click(screen.getByRole('button', { name: '12 de novembro de 2026' }));
    const time = screen.getByRole('textbox', { name: /Data e hora: hora/ });
    await user.clear(time);
    await user.type(time, '2130');
    await user.tab();
    expect(time).toHaveValue('21:30');
    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => {
      expect(posts(state)).toHaveLength(1);
    });
    expect(posts(state)[0]?.body).toMatchObject({ occurred_at: '2026-11-12T21:30:00-03:00' });
  });

  it('pd19 centers the header and the form in the form column', async () => {
    const { container } = open('/journal/new');
    const heading = await screen.findByRole('heading', { level: 1, name: 'Nova entrada' });
    const column = heading.closest('div[class*="screen"]');
    expect(column).not.toBeNull();
    expect(column?.contains(container.querySelector('form'))).toBe(true);
    expect(screen.getByRole('link', { name: 'Voltar' })).toBeInTheDocument();
  });
});
