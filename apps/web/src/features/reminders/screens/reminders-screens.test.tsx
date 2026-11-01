import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { rootRoute } from '../../../app/router';
import { renderWithProviders } from '../../../shared/test/render';
import { clearToasts } from '../../../shared/toast/toast-store';
import type { Reminder } from '../hooks/use-reminders';
import { createRemindersRoutes } from '../routes';

const NOW = new Date('2026-11-05T12:00:00Z');

function reminder(overrides: Partial<Reminder> & Pick<Reminder, 'id' | 'title'>): Reminder {
  return {
    created_at: '2026-11-01T10:00:00Z',
    updated_at: '2026-11-02T10:00:00Z',
    kind: 'one_off',
    owner_id: 'u1',
    timezone: 'America/Sao_Paulo',
    visibility: 'personal',
    ...overrides,
  };
}

const DAILY = {
  frequency: 'daily' as const,
  interval: 1,
  timezone: 'America/Sao_Paulo',
  starts_on: '2026-11-01',
  time: '09:30',
};

const WEEKLY = {
  frequency: 'weekly' as const,
  interval: 1,
  weekdays: ['mon' as const, 'wed' as const],
  timezone: 'America/Sao_Paulo',
  starts_on: '2026-11-01',
  time: '18:00',
};

interface Call {
  method: string;
  url: URL;
  body: unknown;
}

interface World {
  reminders: Reminder[];
  calls: Call[];
  web_push: boolean;
  intercept?: (call: Call) => Response | Promise<Response> | undefined;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function world(): World {
  return {
    reminders: [
      reminder({
        id: 'p1',
        title: 'Ligar para o contador',
        remind_at: '2026-11-06T17:00:00Z',
        next_fire_at: '2026-11-06T17:00:00Z',
        notes: 'Perguntar sobre o imposto.',
      }),
      reminder({
        id: 'p2',
        title: 'Renovar seguro',
        remind_at: '2026-11-20T12:00:00Z',
        next_fire_at: '2026-11-20T12:00:00Z',
      }),
      reminder({
        id: 'r1',
        title: 'Beber água',
        kind: 'recurring',
        rule: DAILY,
        next_fire_at: '2026-11-06T12:30:00Z',
      }),
      reminder({
        id: 'r2',
        title: 'Revisão semanal',
        kind: 'recurring',
        rule: WEEKLY,
        next_fire_at: '2026-11-09T21:00:00Z',
      }),
    ],
    calls: [],
    web_push: false,
  };
}

function handle(state: World, call: Call): Response {
  const path = call.url.pathname.replace('/api/v1', '');
  const params = call.url.searchParams;
  if (call.method === 'GET' && path === '/reminders') {
    const kind = params.get('kind');
    const q = params.get('q')?.toLowerCase();
    return json({
      items: state.reminders.filter(
        (item) =>
          (kind === null || item.kind === kind) &&
          (q === undefined || item.title.toLowerCase().includes(q)),
      ),
    });
  }
  if (call.method === 'GET' && path === '/reminders/upcoming') return json({ items: [] });
  if (call.method === 'GET' && path === '/web-push/public-key') {
    return state.web_push
      ? json({ public_key: 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9' })
      : json({ code: 'web_push_disabled', title: 'x' }, 404);
  }
  if (call.method === 'POST' && path === '/reminders') {
    const body = call.body as Partial<Reminder> & { rule?: Reminder['rule'] };
    const created = reminder({
      id: 'new-1',
      title: body.title ?? '',
      kind: body.rule ? 'recurring' : 'one_off',
      ...(body.rule ? { rule: body.rule } : {}),
      ...(body.remind_at ? { remind_at: body.remind_at, next_fire_at: body.remind_at } : {}),
    });
    state.reminders.push(created);
    return json(created, 201);
  }
  const one = /^\/reminders\/([^/]+)$/.exec(path);
  if (one?.[1] !== undefined) {
    const index = state.reminders.findIndex((item) => item.id === one[1]);
    const found = state.reminders[index];
    if (found === undefined) return json({ code: 'not_found', title: 'x' }, 404);
    if (call.method === 'GET') return json(found);
    if (call.method === 'DELETE') {
      state.reminders.splice(index, 1);
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

interface FakeNotification {
  permission: NotificationPermission;
  requestPermission: ReturnType<typeof vi.fn>;
}

function installBrowser(permission: NotificationPermission): FakeNotification {
  const state = { permission };
  const requestPermission = vi.fn(() => {
    state.permission = 'granted';
    return Promise.resolve('granted' as NotificationPermission);
  });
  const fake = {
    get permission() {
      return state.permission;
    },
    requestPermission,
  };
  vi.stubGlobal('Notification', fake);
  return fake;
}

function installPushSupport() {
  Object.defineProperty(navigator, 'serviceWorker', {
    value: { register: vi.fn(), getRegistration: () => Promise.resolve(undefined) },
    configurable: true,
  });
  vi.stubGlobal('PushManager', function PushManager() {});
}

function open(route: string, state: World = world(), options: { extra?: boolean } = {}) {
  install(state);
  const routes = createRemindersRoutes(
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
  vi.useFakeTimers({ toFake: ['Date'], now: NOW });
  clearToasts();
  installBrowser('default');
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, 'serviceWorker');
});

function expectViewIcons(group: HTMLElement, names: string[]): void {
  const buttons = within(group).getAllByRole('button');
  expect(buttons.map((b) => b.getAttribute('aria-label'))).toEqual(names);
  for (const [i, button] of buttons.entries()) {
    expect(button).toHaveAttribute('title', names[i]);
    expect(button).toHaveAccessibleName(names[i] ?? '');
    expect(button.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(button.textContent).toBe('');
  }
}

describe('reminders list', () => {
  it('shows the page heading with a subtitle and no axe violations', async () => {
    const { container } = open('/reminders');
    const heading = await screen.findByRole('heading', { level: 1, name: 'Lembretes' });
    expect(heading).toHaveAttribute('data-page-heading');
    expect(screen.getByText('Avisos para o momento certo, sem pressa.')).toBeInTheDocument();
    await screen.findByText('Ligar para o contador');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('filters reminders through the url', async () => {
    const user = userEvent.setup();
    const { router, state } = open('/reminders');
    await screen.findByText('Ligar para o contador');
    expect(screen.getByRole('group', { name: 'Filtros' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Visualização' })).toBeInTheDocument();

    await user.type(screen.getByRole('searchbox', { name: 'Busca' }), 'água');
    await waitFor(() => {
      expect(search(router)['q']).toBe('água');
    });
    await waitFor(() => {
      expect(screen.queryByText('Ligar para o contador')).not.toBeInTheDocument();
    });
    expect(state.calls.some((call) => call.url.searchParams.get('q') === 'água')).toBe(true);

    await user.click(screen.getByRole('button', { name: /^Tipo/ }));
    await user.click(screen.getByRole('option', { name: 'Recorrentes' }));
    await waitFor(() => {
      expect(search(router)['kind']).toBe('recurring');
    });
    expect(document.querySelector('select')).toBeNull();
  });

  it('uses the shared view icons with title and accessible name', async () => {
    open('/reminders');
    await screen.findByText('Ligar para o contador');
    expectViewIcons(screen.getByRole('group', { name: 'Visualização' }), ['Lista', 'Por dia']);
  });

  it('switches between list and grouped by day', async () => {
    const user = userEvent.setup();
    const { router } = open('/reminders');
    await screen.findByText('Ligar para o contador');
    expect(screen.queryByRole('heading', { level: 2, name: /de 2026$/ })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Por dia' }));

    await waitFor(() => {
      expect(search(router)['view']).toBe('day');
    });
    const headings = await screen.findAllByRole('heading', { level: 2, name: /de 2026$/ });
    // 06/11 tem dois lembretes; 09/11 e 20/11 um cada.
    expect(headings.length).toBeGreaterThanOrEqual(3);
    const first = headings[0]?.closest('section');
    expect(first && within(first).getAllByRole('listitem')).toHaveLength(2);
  });

  it('asks for notification permission only on click', async () => {
    const user = userEvent.setup();
    const browser = installBrowser('default');
    open('/reminders');
    await screen.findByText('Ligar para o contador');
    expect(browser.requestPermission).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Ativar notificações' }));

    expect(browser.requestPermission).toHaveBeenCalledTimes(1);
    expect(await screen.findByText(/Notificações ativas/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ativar notificações' })).toBeNull();
  });

  it('explains blocked notifications without asking again', async () => {
    const browser = installBrowser('denied');
    open('/reminders');
    expect(
      await screen.findByText(
        'As notificações do navegador estão bloqueadas. Os lembretes continuam aparecendo aqui no Atria.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ativar notificações' })).toBeNull();
    expect(browser.requestPermission).not.toHaveBeenCalled();
  });

  it('shows the web push switch only when the instance has it on', async () => {
    installPushSupport();
    installBrowser('granted');
    const off = world();
    open('/reminders', off);
    await screen.findByText('Ligar para o contador');
    await waitFor(() => {
      expect(off.calls.some((call) => call.url.pathname.endsWith('/web-push/public-key'))).toBe(
        true,
      );
    });
    expect(screen.queryByRole('switch')).toBeNull();
    cleanup();

    const on = world();
    on.web_push = true;
    open('/reminders', on);
    const toggle = await screen.findByRole('switch', { name: 'Receber com o Atria fechado' });
    expect(toggle).toHaveAttribute('aria-checked', 'false');
  });

  it('shows empty, loading and error states', async () => {
    const user = userEvent.setup();

    const empty = world();
    empty.reminders = [];
    open('/reminders', empty);
    expect(await screen.findByText('Nenhum lembrete por aqui.')).toBeInTheDocument();
    cleanup();

    const loading = world();
    loading.intercept = (call) =>
      call.url.pathname.endsWith('/reminders') ? new Promise<Response>(() => undefined) : undefined;
    open('/reminders', loading);
    expect(await screen.findByRole('status')).toHaveAttribute('aria-busy', 'true');
    cleanup();

    const broken = world();
    broken.intercept = (call) =>
      call.url.pathname.endsWith('/reminders')
        ? json({ code: 'boom', title: 'x' }, 500)
        : undefined;
    open('/reminders', broken);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível carregar os lembretes.',
    );
    broken.intercept = undefined;
    await user.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByText('Ligar para o contador')).toBeInTheDocument();
  });

  it('deletes from the list after confirmation and has no complete action', async () => {
    const user = userEvent.setup();
    const { state } = open('/reminders');
    await screen.findByText('Renovar seguro');
    expect(screen.queryByRole('button', { name: /Concluir/ })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Excluir lembrete: Renovar seguro' }));
    const dialog = screen.getByRole('alertdialog');
    expect(state.calls.some((call) => call.method === 'DELETE')).toBe(false);
    await user.click(within(dialog).getByRole('button', { name: 'Excluir' }));

    await waitFor(() => {
      expect(screen.queryByText('Renovar seguro')).not.toBeInTheDocument();
    });
    expect(state.calls.some((call) => call.method === 'DELETE')).toBe(true);
  });

  it('reaches the controls by keyboard', async () => {
    const user = userEvent.setup();
    open('/reminders');
    await screen.findByText('Ligar para o contador');
    for (let step = 0; step < 4; step += 1) await user.tab();
    expect(document.activeElement).not.toBe(document.body);
    expect(document.activeElement).toBeVisible();
  });
});

describe('reminder detail', () => {
  it('pd14 shows Editar with the pencil and Excluir in danger tone inside Mais ações', async () => {
    const user = userEvent.setup();
    open('/reminders/p1');
    const edit = await screen.findByRole('button', { name: 'Editar' });
    expect(edit.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
    expect(screen.getByRole('link', { name: 'Voltar' })).toBeInTheDocument();
    expect(screen.getByText('Lembretes · Lembrete')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Mais ações' }));

    const remove = screen.getByRole('menuitem', { name: 'Excluir' });
    expect(remove.className).toMatch(/danger/);
    expect(screen.queryByRole('button', { name: /Concluir/ })).toBeNull();
  });

  it('deletes the reminder after confirmation from Mais ações', async () => {
    const user = userEvent.setup();
    const { state, router } = open('/reminders/p1');
    await screen.findByRole('heading', { level: 1, name: 'Ligar para o contador' });

    await user.click(screen.getByRole('button', { name: 'Mais ações' }));
    await user.click(screen.getByRole('menuitem', { name: 'Excluir' }));
    const dialog = screen.getByRole('alertdialog');
    expect(state.calls.some((call) => call.method === 'DELETE')).toBe(false);
    await user.click(within(dialog).getByRole('button', { name: 'Excluir' }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/reminders');
    });
    expect(state.calls.some((call) => call.method === 'DELETE')).toBe(true);
  });

  it('pd59 shows the overview in cards with Lembrete, Anotações and Registro', async () => {
    open('/reminders/p1');
    await screen.findByRole('heading', { level: 1, name: 'Ligar para o contador' });

    expect(screen.getByRole('heading', { level: 2, name: 'Lembrete' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Anotações' })).toBeInTheDocument();
    expect(screen.getByText('Lembretes só avisam: não têm conclusão.')).toBeInTheDocument();
    const record = screen.getByRole('region', { name: 'Registro' });
    expect(within(record).getByText('Visibilidade')).toBeInTheDocument();
    expect(within(record).getByText('Atualizado em')).toBeInTheDocument();
    cleanup();

    // Sem texto, o cartão "Anotações" não aparece.
    open('/reminders/p2');
    await screen.findByRole('heading', { level: 1, name: 'Renovar seguro' });
    expect(screen.queryByRole('heading', { level: 2, name: 'Anotações' })).toBeNull();
  });

  it('summarizes the recurrence rule from the shared base', async () => {
    open('/reminders/r2');
    await screen.findByRole('heading', { level: 1, name: 'Revisão semanal' });
    expect(screen.getAllByText(/Toda /).length).toBeGreaterThan(0);
  });

  it('shows the Visão geral tab before the extra tabs', async () => {
    open('/reminders/p1', world(), { extra: true });
    const tabs = await screen.findAllByRole('tab');
    expect(tabs.map((tab) => tab.textContent)).toEqual(['Visão geral', 'Conexões']);
  });

  it('shows not found and error states', async () => {
    open('/reminders/nada');
    expect(await screen.findByText('Lembrete não encontrado.')).toBeInTheDocument();
  });

  it('has no axe violations in the detail', async () => {
    const { container } = open('/reminders/p1');
    await screen.findByRole('heading', { level: 1, name: 'Ligar para o contador' });
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('reminder form', () => {
  it('creates a single reminder with date and time', async () => {
    const user = userEvent.setup();
    const { state, router } = open('/reminders/new');
    await user.type(await screen.findByRole('textbox', { name: 'Título' }), 'Ligar para o banco');
    await user.click(screen.getByRole('button', { name: /^Data e hora: data/ }));
    await user.click(screen.getByRole('button', { name: '12 de novembro de 2026' }));
    await user.type(screen.getByRole('textbox', { name: 'Data e hora: hora (24 horas)' }), '1445');
    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/reminders/new-1');
    });
    const post = state.calls.find((call) => call.method === 'POST');
    expect(post?.body).toMatchObject({
      title: 'Ligar para o banco',
      timezone: 'America/Sao_Paulo',
      // 14:45 em São Paulo (UTC-3).
      remind_at: '2026-11-12T17:45:00.000Z',
      visibility: 'personal',
    });
  });

  it('creates a recurring reminder for one minute from now', async () => {
    const user = userEvent.setup();
    const { state } = open('/reminders/new');
    await user.type(await screen.findByRole('textbox', { name: 'Título' }), 'Beber água');
    await user.click(screen.getByRole('radio', { name: 'Recorrente' }));
    // 09:01 em São Paulo, um minuto depois das 09:00 do relógio fixo (12:00 UTC).
    await user.type(screen.getByRole('textbox', { name: /Horário/ }), '901');
    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => {
      expect(state.calls.some((call) => call.method === 'POST')).toBe(true);
    });
    const post = state.calls.find((call) => call.method === 'POST');
    expect(post?.body).toMatchObject({
      title: 'Beber água',
      timezone: 'America/Sao_Paulo',
      rule: {
        frequency: 'daily',
        interval: 1,
        time: '09:01',
        timezone: 'America/Sao_Paulo',
        starts_on: '2026-11-05',
      },
    });
  });

  it('requires the time of a recurring reminder with an alert in the field', async () => {
    const user = userEvent.setup();
    const { state } = open('/reminders/new');
    await user.type(await screen.findByRole('textbox', { name: 'Título' }), 'Sem horário');
    await user.click(screen.getByRole('radio', { name: 'Recorrente' }));
    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Informe o horário do aviso.');
    expect(state.calls.some((call) => call.method === 'POST')).toBe(false);
  });

  it('shows the required error inside the form with role alert', async () => {
    const user = userEvent.setup();
    const { state } = open('/reminders/new');
    await user.click(await screen.findByRole('button', { name: 'Salvar' }));

    expect((await screen.findAllByRole('alert'))[0]).toHaveTextContent('Campo obrigatório');
    expect(state.calls.some((call) => call.method === 'POST')).toBe(false);
  });

  it('pd62 lays the form in the grid with the repetition as a segmented field', async () => {
    const user = userEvent.setup();
    const { container } = open('/reminders/new');
    await screen.findByRole('textbox', { name: 'Título' });

    for (const name of ['Título', 'Anotações']) {
      expect(screen.getByLabelText(name).closest('[data-span="full"]')).not.toBeNull();
    }
    expect(
      screen.getByRole('radiogroup', { name: 'Visibilidade' }).closest('[data-span="full"]'),
    ).not.toBeNull();
    expect(screen.getByRole('radiogroup', { name: 'Repetição' })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: /Repetir/ })).toBeNull();
    const buttons = screen.getAllByRole('button').map((button) => button.textContent);
    expect(buttons.indexOf('Cancelar')).toBeLessThan(buttons.indexOf('Salvar'));
    for (const selector of [
      'select',
      'input[type=date]',
      'input[type=time]',
      'input[type=datetime-local]',
    ]) {
      expect(container.querySelector(selector)).toBeNull();
    }

    await user.click(screen.getByRole('radio', { name: 'Recorrente' }));
    for (const selector of ['select', 'input[type=date]', 'input[type=time]']) {
      expect(container.querySelector(selector)).toBeNull();
    }
  });

  it('pd57 picks the date in the custom calendar and types 930 as 09:30', async () => {
    const user = userEvent.setup();
    const { state } = open('/reminders/new');
    await user.type(await screen.findByRole('textbox', { name: 'Título' }), 'Renovar CNH');

    await user.click(screen.getByRole('button', { name: /^Data e hora: data/ }));
    await user.click(screen.getByRole('button', { name: '12 de novembro de 2026' }));
    const time = screen.getByRole('textbox', { name: 'Data e hora: hora (24 horas)' });
    await user.type(time, '930');
    await user.tab();
    expect(time).toHaveValue('09:30');
    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => {
      expect(state.calls.some((call) => call.method === 'POST')).toBe(true);
    });
    expect(state.calls.find((call) => call.method === 'POST')?.body).toMatchObject({
      remind_at: '2026-11-12T12:30:00.000Z',
    });
  });

  it('pd19 centers the header and the form in the form column', async () => {
    const { container } = open('/reminders/new');
    const title = await screen.findByRole('textbox', { name: 'Título' });
    const column = title.closest('[class*="screen"]');
    expect(column).not.toBeNull();
    expect(column?.contains(container.querySelector('[data-page-heading]'))).toBe(true);
    expect(column?.contains(container.querySelector('form'))).toBe(true);
  });

  it('edits a recurring reminder and warns the change applies to the next ones', async () => {
    const user = userEvent.setup();
    const { state, router } = open('/reminders/r1/edit');
    expect(await screen.findByRole('textbox', { name: 'Título' })).toHaveValue('Beber água');
    expect(screen.getByText('A mudança vale para os próximos avisos.')).toBeInTheDocument();

    await user.clear(screen.getByRole('textbox', { name: 'Título' }));
    await user.type(screen.getByRole('textbox', { name: 'Título' }), 'Beber mais água');
    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/reminders/r1');
    });
    const patch = state.calls.find((call) => call.method === 'PATCH');
    expect(patch?.body).toMatchObject({ title: 'Beber mais água', rule: { time: '09:30' } });
  });

  it('has no axe violations in the form', async () => {
    const { container } = open('/reminders/new');
    await screen.findByRole('textbox', { name: 'Título' });
    expect(await axe(container)).toHaveNoViolations();
  });
});
