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

const getCalls = (state: World) =>
  state.calls.filter(
    (call) => call.method === 'GET' && call.url.pathname.endsWith('/journal-entries'),
  );

describe('journal list', () => {
  it('groups entries by day with Intl date and time in the user timezone', async () => {
    open('/journal');
    // 23:30 UTC do dia 4 é 20:30 em São Paulo: continua no dia 4.
    const day = await screen.findByRole('region', { name: '4 de nov. de 2026' });
    expect(within(day).getByText('20:30')).toBeInTheDocument();
    expect(within(day).getByText('17:00')).toBeInTheDocument();
    expect(within(day).getByText('Dia leve no parque.')).toBeInTheDocument();
    expect(within(day).getByText('Alegria')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: '10 de out. de 2026' })).toBeInTheDocument();
  });

  it('exposes the Filtros, Busca and Visualização controls by accessible name', async () => {
    open('/journal');
    await screen.findByText('Dia leve no parque.');
    expect(screen.getByRole('group', { name: 'Filtros' })).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: 'Busca' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Visualização' })).toBeInTheDocument();
  });

  it('reads search, filters and view mode from the URL', async () => {
    const user = userEvent.setup();
    const { router } = open('/journal?emotion=em-joy&view=timeline');
    await screen.findByText('Dia leve no parque.');
    expect(screen.queryByText('Fim de tarde corrido.')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Linha do tempo' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await user.click(screen.getByRole('button', { name: 'Lista' }));
    await waitFor(() => {
      expect(search(router)['view']).toBe('list');
    });

    await user.type(screen.getByRole('searchbox', { name: 'Busca' }), 'parque');
    await waitFor(() => {
      expect(search(router)['q']).toBe('parque');
    });
    expect(search(router)['emotion']).toBe('em-joy');
  });

  it('filters by text typed in the search', async () => {
    open('/journal?q=conversa');
    await screen.findByText('Uma conversa difícil.');
    expect(screen.queryByText('Dia leve no parque.')).not.toBeInTheDocument();
  });

  it('filters by emotion from the select', async () => {
    const user = userEvent.setup();
    const { router, state } = open('/journal');
    await screen.findByText('Dia leve no parque.');
    await user.click(screen.getByRole('button', { name: /^Emoção/ }));
    await user.click(screen.getByRole('option', { name: 'Alegria' }));
    await waitFor(() => {
      expect(search(router)['emotion']).toBe('em-joy');
    });
    await waitFor(() => {
      expect(
        getCalls(state).some((call) => call.url.searchParams.get('emotion_id') === 'em-joy'),
      ).toBe(true);
    });
  });

  it('shows the empty state with explanatory text', async () => {
    const state = world();
    state.entries = [];
    open('/journal', state);
    expect(await screen.findByText('Seu diário está em branco.')).toBeInTheDocument();
    expect(screen.getByText(/registre a primeira entrada/)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Nova entrada' })).toHaveLength(2);
  });

  it('shows the loading state', async () => {
    const state = world();
    state.intercept = (call) =>
      call.url.pathname.endsWith('/journal-entries')
        ? new Promise<Response>(() => undefined)
        : undefined;
    open('/journal', state);
    expect(await screen.findByText('Carregando o diário…')).toBeInTheDocument();
  });

  it('shows the error state', async () => {
    const state = world();
    state.intercept = (call) =>
      call.url.pathname.endsWith('/journal-entries')
        ? json({ code: 'boom', title: 'x' }, 500)
        : undefined;
    open('/journal', state);
    expect(await screen.findByText('Não foi possível carregar o diário.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeInTheDocument();
  });

  it('renders entry text sanitized', async () => {
    const state = world();
    state.entries.push(
      entry({ id: 'x1', text: '<img src=x alt="boom"><script>alert(1)</script>' }),
    );
    const { container } = open('/journal', state);
    expect(await screen.findByText(/<img src=x/)).toBeInTheDocument();
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('script')).toBeNull();
  });

  it('has no axe violations', async () => {
    const { container } = open('/journal');
    await screen.findByText('Dia leve no parque.');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('pd55 filters the period with the PeriodField and sends from and to', async () => {
    const user = userEvent.setup();
    const { router, state } = open('/journal');
    await screen.findByText('Dia leve no parque.');
    expect(getCalls(state)[0]?.url.searchParams.has('from')).toBe(false);

    await user.click(screen.getByRole('button', { name: /^Período/ }));
    const dialog = screen.getByRole('dialog', { name: 'Escolher período' });
    ['Este mês', 'Mês passado', 'Últimos 30 dias', 'Este ano', 'Qualquer período'].forEach(
      (name) => {
        expect(within(dialog).getByRole('button', { name })).toBeInTheDocument();
      },
    );
    expect(
      within(dialog).queryByRole('button', { name: 'Próximos 30 dias' }),
    ).not.toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Mês passado' }));
    await waitFor(() => {
      expect(search(router)['period']).toBe('last_month');
    });
    // Outubro inteiro no fuso do usuário (UTC-3); o fim é o início de novembro.
    await waitFor(() => {
      const last = getCalls(state).at(-1)?.url.searchParams;
      expect(last?.get('from')).toBe('2026-10-01T03:00:00.000Z');
      expect(last?.get('to')).toBe('2026-11-01T03:00:00.000Z');
    });
    expect(await screen.findByText('Uma conversa difícil.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^Período/ }));
    await user.click(
      within(screen.getByRole('dialog', { name: 'Escolher período' })).getByRole('button', {
        name: 'Qualquer período',
      }),
    );
    await waitFor(() => {
      const last = getCalls(state).at(-1)?.url.searchParams;
      expect(last?.has('from')).toBe(false);
      expect(last?.has('to')).toBe(false);
    });
  });

  it('pd61 lists the journal report in the Relatórios menu', async () => {
    const user = userEvent.setup();
    open('/journal');
    await screen.findByText('Dia leve no parque.');

    await user.click(screen.getByRole('button', { name: 'Relatórios' }));

    expect(screen.getByRole('menuitem', { name: 'Emoções no período' })).toHaveAttribute(
      'href',
      '/reports/journal-emo?from_module=journal',
    );
  });
});
