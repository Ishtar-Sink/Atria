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

const search = (router: { state: { location: { search: unknown } } }) =>
  router.state.location.search as Record<string, string>;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-11-05T12:00:00Z') });
  clearToasts();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('journal entry page', () => {
  it('pd14 shows Editar with the pencil and Excluir in danger tone inside Mais ações', async () => {
    const user = userEvent.setup();
    open('/journal/e1');
    const edit = await screen.findByRole('button', { name: 'Editar' });
    expect(edit.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Excluir' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Mais ações' }));

    const remove = screen.getByRole('menuitem', { name: 'Excluir' });
    expect(remove.className).toMatch(/danger/);
    expect(screen.queryByRole('button', { name: 'Excluir' })).not.toBeInTheDocument();
  });

  it('deletes the entry after confirmation from Mais ações', async () => {
    const user = userEvent.setup();
    const { state, router } = open('/journal/e1');
    await screen.findByRole('heading', { level: 1, name: 'Dia leve no parque.' });

    await user.click(screen.getByRole('button', { name: 'Mais ações' }));
    await user.click(screen.getByRole('menuitem', { name: 'Excluir' }));
    const dialog = screen.getByRole('alertdialog');
    expect(state.calls.some((call) => call.method === 'DELETE')).toBe(false);
    await user.click(within(dialog).getByRole('button', { name: 'Excluir' }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/journal');
    });
    expect(state.calls.some((call) => call.method === 'DELETE')).toBe(true);
  });

  it('pd59 shows the overview in cards with Entrada, Emoções and Registro', async () => {
    const state = world();
    state.entries.push(
      entry({
        id: 'e9',
        text: 'Entrada com ansiedade.',
        emotions: [
          {
            emotion_id: 'em-anxiety',
            intensity: 4,
            name: null,
            system_key: 'anxiety',
            deleted: false,
          },
          { emotion_id: 'em-calm', name: null, system_key: 'calm', deleted: false },
        ],
      }),
    );
    open('/journal/e9', state);
    await screen.findByRole('heading', { level: 1, name: 'Entrada com ansiedade.' });

    expect(screen.getByRole('heading', { level: 2, name: 'Entrada' })).toBeInTheDocument();
    const emotions = screen.getByRole('region', { name: 'Emoções' });
    expect(within(emotions).getByText('Ansiedade · 4/5')).toBeInTheDocument();
    expect(within(emotions).getByText('Calma')).toBeInTheDocument();
    const record = screen.getByRole('region', { name: 'Registro' });
    ['Quando', 'Visibilidade', 'Criado em', 'Atualizado em'].forEach((term) => {
      expect(within(record).getByText(term)).toBeInTheDocument();
    });
  });

  it('shows Nenhuma. when the entry has no emotions', async () => {
    open('/journal/e2');
    await screen.findByRole('heading', { level: 1, name: 'Fim de tarde corrido.' });
    expect(
      within(screen.getByRole('region', { name: 'Emoções' })).getByText('Nenhuma.'),
    ).toBeInTheDocument();
  });

  it('renders the text as plain text, never as html', async () => {
    const state = world();
    state.entries.push(
      entry({ id: 'x1', text: '<img src=x alt="boom"> <script>alert(1)</script>' }),
    );
    const { container } = open('/journal/x1', state);
    await screen.findByRole('heading', { level: 1 });
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('script')).toBeNull();
    expect(screen.getAllByText(/<img src=x/).length).toBeGreaterThan(0);
  });

  it('adds the extra tabs received from outside', async () => {
    const user = userEvent.setup();
    const { router } = open('/journal/e1', world(), { extra: true });
    await user.click(await screen.findByRole('tab', { name: 'Conexões' }));
    await waitFor(() => {
      expect(search(router)['tab']).toBe('links');
    });
    expect(screen.getByText('Ligações')).toBeInTheDocument();
  });

  it('has no axe violations', async () => {
    const { container } = open('/journal/e1');
    await screen.findByRole('heading', { level: 1, name: 'Dia leve no parque.' });
    expect(await axe(container)).toHaveNoViolations();
  });
});
