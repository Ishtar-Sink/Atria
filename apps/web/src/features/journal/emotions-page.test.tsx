import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { rootRoute } from '../../app/router';
import { renderWithProviders } from '../../shared/test/render';
import { clearToasts } from '../../shared/toast/toast-store';
import { EmotionPicker, type PickedEmotion } from './emotion-picker';
import { createJournalRoutes } from './routes';
import { useEmotions, type Emotion } from './use-emotions';
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

function PickerProbe() {
  const emotions = useEmotions();
  const [value, setValue] = useState<PickedEmotion[]>([]);
  return <EmotionPicker emotions={emotions.data?.items ?? []} value={value} onChange={setValue} />;
}

describe('emotions page', () => {
  it('adds a new emotion that appears in the picker', async () => {
    const user = userEvent.setup();
    const { state } = open('/journal/emotions');
    await screen.findByRole('list', { name: 'Lista de emoções' });

    await user.type(screen.getByRole('textbox', { name: 'Nova emoção' }), 'Orgulho');
    await user.click(screen.getByRole('button', { name: 'Adicionar' }));

    expect(await screen.findByText('Orgulho')).toBeInTheDocument();
    await waitFor(() => {
      expect(state.calls.find((call) => call.method === 'POST')?.body).toEqual({ name: 'Orgulho' });
    });
    // O mesmo cache alimenta o seletor das entradas.
    cleanup();
    renderWithProviders(<PickerProbe />);
    expect(await screen.findByRole('checkbox', { name: 'Orgulho' })).toBeInTheDocument();
  });

  it('shows default emotions by their translated name', async () => {
    open('/journal/emotions');
    const list = await screen.findByRole('list', { name: 'Lista de emoções' });
    expect(within(list).getByText('Alegria')).toBeInTheDocument();
    expect(within(list).getByText('Ansiedade')).toBeInTheDocument();
  });

  it('renames and removes an emotion with confirmation', async () => {
    const user = userEvent.setup();
    const { state } = open('/journal/emotions');
    await screen.findByText('Ansiedade');

    await user.click(screen.getByRole('button', { name: 'Renomear Ansiedade' }));
    const field = screen.getByRole('textbox', { name: 'Nome da emoção' });
    await user.clear(field);
    await user.type(field, 'Nervosismo');
    await user.click(screen.getByRole('button', { name: 'Salvar nome' }));
    expect(await screen.findByText('Nervosismo')).toBeInTheDocument();
    await waitFor(() => {
      expect(state.calls.find((call) => call.method === 'PATCH')?.body).toEqual({
        name: 'Nervosismo',
      });
    });

    await user.click(screen.getByRole('button', { name: 'Remover Alegria' }));
    const dialog = screen.getByRole('alertdialog');
    expect(state.calls.some((call) => call.method === 'DELETE')).toBe(false);
    await user.click(within(dialog).getByRole('button', { name: 'Remover' }));
    await waitFor(() => {
      expect(screen.queryByText('Alegria')).not.toBeInTheDocument();
    });
    expect(state.calls.some((call) => call.method === 'DELETE')).toBe(true);
  });

  it('refuses an empty name', async () => {
    const user = userEvent.setup();
    const { state } = open('/journal/emotions');
    await screen.findByText('Ansiedade');
    await user.click(screen.getByRole('button', { name: 'Adicionar' }));
    expect(await screen.findByText('Dê um nome à emoção.')).toBeInTheDocument();
    expect(state.calls.some((call) => call.method === 'POST')).toBe(false);
  });

  it('has no axe violations', async () => {
    const { container } = open('/journal/emotions');
    await screen.findByText('Ansiedade');
    expect(await axe(container)).toHaveNoViolations();
  });
});
