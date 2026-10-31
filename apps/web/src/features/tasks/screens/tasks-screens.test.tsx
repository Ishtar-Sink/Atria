import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { rootRoute } from '../../../app/router';
import { summarizeRule } from '../../../shared/forms/recurrence-fields';
import { renderWithProviders } from '../../../shared/test/render';
import { clearToasts, getToasts } from '../../../shared/toast/toast-store';
import { toRule, type Task, type TaskOccurrence } from '../hooks/use-tasks';
import { createTasksRoutes } from '../routes';

const TODAY = '2026-11-05';

function task(overrides: Partial<Task> & Pick<Task, 'id' | 'title'>): Task {
  return {
    created_at: '2026-11-01T10:00:00Z',
    updated_at: '2026-11-02T10:00:00Z',
    is_recurring: false,
    labels: [],
    owner_id: 'u1',
    visibility: 'personal',
    ...overrides,
  };
}

const DAILY = {
  frequency: 'daily' as const,
  interval: 1,
  timezone: 'America/Sao_Paulo',
  starts_on: '2026-11-01',
  time: '08:00',
};

const WEEKLY = {
  frequency: 'weekly' as const,
  interval: 1,
  weekdays: ['mon' as const, 'wed' as const],
  timezone: 'America/Sao_Paulo',
  starts_on: '2026-11-01',
  time: '09:30',
};

function week(task_id: string): TaskOccurrence[] {
  return Array.from({ length: 7 }, (_, index) => ({
    task_id,
    occurrence_date: `2026-11-${String(5 + index).padStart(2, '0')}`,
    completed: false,
  }));
}

interface Call {
  method: string;
  url: URL;
  body: unknown;
}

interface World {
  tasks: Task[];
  occurrences: TaskOccurrence[];
  calls: Call[];
  /** Devolve uma resposta pronta para forçar uma recusa ou um atraso. */
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
    tasks: [
      task({ id: 's1', title: 'Pagar a conta de luz', due_on: TODAY, labels: ['casa'] }),
      task({ id: 's0', title: 'Renovar documento', due_on: '2026-11-01' }),
      task({ id: 's2', title: 'Comprar presente', due_on: '2026-11-20' }),
      task({
        id: 's3',
        title: 'Enviar relatório',
        due_on: TODAY,
        completed_at: '2026-11-05T10:00:00Z',
      }),
      task({
        id: 'r1',
        title: 'Alongamento da manhã',
        is_recurring: true,
        recurrence: DAILY,
        description: 'Dez minutos de alongamento.',
        labels: ['saúde'],
      }),
      task({ id: 'r2', title: 'Revisão semanal', is_recurring: true, recurrence: WEEKLY }),
    ],
    occurrences: [
      { task_id: 'r1', occurrence_date: '2026-11-04', completed: true },
      ...week('r1'),
      { task_id: 'r2', occurrence_date: '2026-11-09', completed: false },
    ],
    calls: [],
  };
}

function handle(state: World, call: Call): Response {
  const { pathname, searchParams } = call.url;
  const path = pathname.replace('/api/v1', '');
  const recurring_filter = searchParams.get('recurring');
  if (call.method === 'GET' && path === '/tasks') {
    const label = searchParams.get('label');
    const q = searchParams.get('q')?.toLowerCase();
    const items = state.tasks.filter(
      (item) =>
        (label === null || item.labels.includes(label)) &&
        (q === undefined || item.title.toLowerCase().includes(q)) &&
        (recurring_filter === null || String(item.is_recurring) === recurring_filter),
    );
    return json({ items });
  }
  if (call.method === 'GET' && path === '/tasks/occurrences') {
    const from = searchParams.get('from') ?? '';
    const to = searchParams.get('to') ?? '';
    return json({
      items: state.occurrences.filter(
        (item) => item.occurrence_date >= from && item.occurrence_date <= to,
      ),
    });
  }
  if (call.method === 'POST' && path === '/tasks') {
    const body = call.body as Partial<Task>;
    const created = task({
      id: 'new-1',
      title: body.title ?? '',
      is_recurring: body.recurrence != null,
      ...(body.recurrence ? { recurrence: body.recurrence } : {}),
    });
    state.tasks.push(created);
    if (created.is_recurring) state.occurrences.push(...week('new-1'));
    return json(created, 201);
  }
  const completion = /^\/tasks\/([^/]+)\/completion$/.exec(path);
  if (completion?.[1] !== undefined) {
    const id = completion[1];
    const done = call.method === 'POST';
    const found = state.tasks.find((item) => item.id === id);
    if (found === undefined) return json({ code: 'not_found', title: 'x' }, 404);
    if (found.is_recurring) {
      const date =
        searchParams.get('occurrence_date') ??
        (call.body as { occurrence_date: string }).occurrence_date;
      state.occurrences.forEach((item) => {
        if (item.task_id === id && item.occurrence_date === date) item.completed = done;
      });
    } else {
      found.completed_at = done ? '2026-11-05T12:00:00Z' : null;
    }
    return json({ task_id: id, completed: done });
  }
  const one = /^\/tasks\/([^/]+)$/.exec(path);
  if (one?.[1] !== undefined) {
    const index = state.tasks.findIndex((item) => item.id === one[1]);
    const found = state.tasks[index];
    if (found === undefined) return json({ code: 'not_found', title: 'x' }, 404);
    if (call.method === 'GET') return json(found);
    if (call.method === 'DELETE') {
      state.tasks.splice(index, 1);
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
  const routes = createTasksRoutes(
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
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('tasks list', () => {
  it('shows the page heading with a subtitle and no axe violations', async () => {
    const { container } = open('/tasks');
    const heading = await screen.findByRole('heading', { level: 1, name: 'Tarefas' });
    expect(heading).toHaveAttribute('data-page-heading');
    expect(
      screen.getByText('O que precisa ser concluído, uma coisa de cada vez.'),
    ).toBeInTheDocument();
    await screen.findByText('Pagar a conta de luz');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('filters tasks through the url', async () => {
    const user = userEvent.setup();
    const { router, state } = open('/tasks?status=all&range=week');
    await screen.findByText('Pagar a conta de luz');
    expect(screen.getByText('Enviar relatório')).toBeInTheDocument();

    await user.type(screen.getByRole('searchbox', { name: 'Busca' }), 'luz');
    await waitFor(() => {
      expect(search(router)['q']).toBe('luz');
    });
    expect(screen.getByRole('group', { name: 'Filtros' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Visualização' })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByText('Enviar relatório')).not.toBeInTheDocument();
    });
    expect(state.calls.some((call) => call.url.searchParams.get('q') === 'luz')).toBe(true);

    await user.click(screen.getByRole('button', { name: /^Tipo/ }));
    await user.click(screen.getByRole('option', { name: 'Recorrentes' }));
    await waitFor(() => {
      expect(search(router)['recurring']).toBe('recurring');
    });
  });

  it('dec006 filters tasks by label through the url', async () => {
    const user = userEvent.setup();
    const { router, state } = open('/tasks?status=all');
    await screen.findByText('Alongamento da manhã');

    await user.type(screen.getByRole('textbox', { name: 'Etiqueta' }), 'casa{Enter}');

    await waitFor(() => {
      expect(search(router)['label']).toBe('casa');
    });
    await waitFor(() => {
      expect(screen.queryByText('Alongamento da manhã')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Pagar a conta de luz')).toBeInTheDocument();
    expect(state.calls.some((call) => call.url.searchParams.get('label') === 'casa')).toBe(true);

    await user.clear(screen.getByRole('textbox', { name: 'Etiqueta' }));
    await waitFor(() => {
      expect(search(router)['label']).toBe('');
    });
  });

  it('pd61 lists the tasks report in the Relatórios menu', async () => {
    const user = userEvent.setup();
    open('/tasks');
    await screen.findByText('Pagar a conta de luz');

    await user.click(screen.getByRole('button', { name: 'Relatórios' }));

    expect(screen.getByRole('menuitem', { name: 'Tarefas concluídas e abertas' })).toHaveAttribute(
      'href',
      '/reports/tasks-done?from_module=tasks',
    );
  });

  it('keeps overdue single tasks open without history of recurring ones', async () => {
    open('/tasks');
    // Vencida em 1/11 e não concluída: segue na lista, sem a palavra "atrasada".
    expect(await screen.findByText('Renovar documento')).toBeInTheDocument();
    expect(screen.queryByText(/atrasad/i)).not.toBeInTheDocument();
    // A ocorrência de ontem (feita) nunca aparece, e a de amanhã fica fora do período "hoje".
    const items = screen.getAllByRole('listitem').map((item) => item.textContent);
    expect(items.filter((text) => text.includes('Alongamento da manhã'))).toHaveLength(1);
    expect(screen.queryByText('Comprar presente')).not.toBeInTheDocument();
  });

  it('switches between list and grouped by day', async () => {
    const user = userEvent.setup();
    const { router } = open('/tasks?range=week');
    await screen.findByText('Pagar a conta de luz');
    expect(screen.queryByRole('heading', { level: 2 })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Por dia' }));

    await waitFor(() => {
      expect(search(router)['view']).toBe('day');
    });
    expect(await screen.findByRole('heading', { level: 2, name: 'Hoje' })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 2 }).length).toBeGreaterThan(2);
  });

  it('completes and reopens a task from the list', async () => {
    const user = userEvent.setup();
    open('/tasks?status=all');
    const button = await screen.findByRole('button', { name: 'Concluir: Pagar a conta de luz' });
    expect(button).toHaveAttribute('aria-pressed', 'false');

    await user.click(button);
    const reopen = await screen.findByRole('button', { name: 'Reabrir: Pagar a conta de luz' });
    expect(reopen).toHaveAttribute('aria-pressed', 'true');

    await user.click(reopen);
    expect(
      await screen.findByRole('button', { name: 'Concluir: Pagar a conta de luz' }),
    ).toHaveAttribute('aria-pressed', 'false');
  });

  it('pd33 completes today occurrence from the list and shows Feita hoje', async () => {
    const user = userEvent.setup();
    const { state } = open('/tasks?status=all');
    const row = (await screen.findByText('Alongamento da manhã')).closest('li');
    if (!row) throw new Error('sem linha');
    expect(within(row).getByText('Aberta hoje')).toBeInTheDocument();

    await user.click(
      within(row).getByRole('button', { name: 'Concluir hoje: Alongamento da manhã' }),
    );

    expect(await within(row).findByText('Feita hoje')).toBeInTheDocument();
    await waitFor(() => {
      expect(state.calls.find((call) => call.method === 'POST')?.body).toEqual({
        occurrence_date: TODAY,
      });
    });
  });

  it('pd04 completes from the list with the icon-only check button', async () => {
    const user = userEvent.setup();
    open('/tasks?status=all');
    const button = await screen.findByRole('button', {
      name: 'Concluir hoje: Alongamento da manhã',
    });

    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(button).toHaveTextContent('');
    expect(button.className).toMatch(/success/);

    await user.click(button);
    expect(
      await screen.findByRole('button', { name: 'Reabrir hoje: Alongamento da manhã' }),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  it('completes with Space and Enter after tabbing to the button', async () => {
    const user = userEvent.setup();
    open('/tasks');
    await screen.findByRole('button', { name: 'Concluir: Pagar a conta de luz' });

    for (let step = 0; step < 60; step += 1) {
      await user.tab();
      if (document.activeElement?.getAttribute('aria-label') === 'Concluir: Pagar a conta de luz') {
        break;
      }
    }
    expect(document.activeElement).toHaveAttribute('aria-label', 'Concluir: Pagar a conta de luz');

    await user.keyboard(' ');
    // Aberta é o filtro padrão: ao concluir, a tarefa sai da lista.
    await waitFor(() => {
      expect(screen.queryByText('Pagar a conta de luz')).not.toBeInTheDocument();
    });
  });

  it('pd32 rolls back when the server refuses a past occurrence', async () => {
    const user = userEvent.setup();
    const state = world();
    state.intercept = (call) =>
      call.method === 'POST'
        ? json({ code: 'occurrence_in_past', title: 'Ocorrência no passado' }, 422)
        : undefined;
    open('/tasks', state);
    const button = await screen.findByRole('button', {
      name: 'Concluir hoje: Alongamento da manhã',
    });

    await user.click(button);

    await waitFor(() => {
      expect(getToasts().map((toast) => toast.message_key)).toContain(
        'tasks.completion.occurrence_in_past',
      );
    });
    expect(
      await screen.findByRole('button', { name: 'Concluir hoje: Alongamento da manhã' }),
    ).toHaveAttribute('aria-pressed', 'false');
  });

  it('shows empty, loading and error states', async () => {
    const user = userEvent.setup();

    const empty = world();
    empty.tasks = [];
    empty.occurrences = [];
    open('/tasks', empty);
    expect(await screen.findByText('Nada marcado para hoje.')).toBeInTheDocument();
    cleanup();

    const loading = world();
    loading.intercept = () => new Promise<Response>(() => undefined);
    open('/tasks', loading);
    expect(await screen.findByRole('status')).toHaveAttribute('aria-busy', 'true');
    cleanup();

    const broken = world();
    broken.intercept = (call) =>
      call.url.pathname.endsWith('/tasks') ? json({ code: 'boom', title: 'x' }, 500) : undefined;
    open('/tasks', broken);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível carregar as tarefas.',
    );
    broken.intercept = undefined;
    await user.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByText('Pagar a conta de luz')).toBeInTheDocument();
  });
});

describe('task detail', () => {
  it('pd33 completes and reopens today from the detail with a text button', async () => {
    const user = userEvent.setup();
    const { state } = open('/tasks/r1');
    const complete = await screen.findByRole('button', { name: 'Concluir hoje' });
    expect(complete).toHaveTextContent('Concluir hoje');

    await user.click(complete);
    const reopen = await screen.findByRole('button', { name: 'Reabrir hoje' });
    expect(screen.getByText('Feita hoje')).toBeInTheDocument();
    await user.click(reopen);

    expect(await screen.findByRole('button', { name: 'Concluir hoje' })).toBeInTheDocument();
    expect(
      state.calls.some((call) => call.method === 'DELETE' && call.url.search.includes(TODAY)),
    ).toBe(true);
  });

  it('hides the complete button when there is no occurrence today', async () => {
    open('/tasks/r2');
    await screen.findByRole('heading', { level: 1, name: 'Revisão semanal' });
    expect(screen.queryByRole('button', { name: /^Concluir/ })).not.toBeInTheDocument();
    expect(await screen.findByText(/Próxima:/)).toBeInTheDocument();
  });

  it('pd14 shows Editar with the pencil and Excluir in danger tone inside Mais ações', async () => {
    const user = userEvent.setup();
    open('/tasks/s1');
    const edit = await screen.findByRole('button', { name: 'Editar' });
    expect(edit.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
    expect(screen.getByRole('link', { name: 'Voltar' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Mais ações' }));

    const remove = screen.getByRole('menuitem', { name: 'Excluir' });
    expect(remove.className).toMatch(/danger/);
  });

  it('deletes the task after confirmation from Mais ações', async () => {
    const user = userEvent.setup();
    const { state, router } = open('/tasks/s1');
    await screen.findByRole('heading', { level: 1, name: 'Pagar a conta de luz' });

    await user.click(screen.getByRole('button', { name: 'Mais ações' }));
    await user.click(screen.getByRole('menuitem', { name: 'Excluir' }));
    const dialog = screen.getByRole('alertdialog');
    expect(state.calls.some((call) => call.method === 'DELETE')).toBe(false);
    await user.click(within(dialog).getByRole('button', { name: 'Excluir' }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/tasks');
    });
    expect(state.calls.some((call) => call.method === 'DELETE')).toBe(true);
  });

  it('pd59 shows the overview in cards with Tarefa, Anotações and Registro', async () => {
    open('/tasks/r1');
    await screen.findByRole('heading', { level: 1, name: 'Alongamento da manhã' });

    expect(screen.getByRole('heading', { level: 2, name: 'Tarefa' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Anotações' })).toBeInTheDocument();
    const record = screen.getByRole('region', { name: 'Registro' });
    // As etiquetas ficam no topo do cartão "Registro".
    expect(within(record).getByText('saúde')).toBeInTheDocument();
    expect(within(record).getByText('Visibilidade')).toBeInTheDocument();
  });

  it('dec006 summarizes the full rule in the overview', async () => {
    open('/tasks/r2');
    await screen.findByRole('heading', { level: 1, name: 'Revisão semanal' });
    const summary = summarizeRule(toRule(WEEKLY), 'pt-BR');

    const card = screen.getByRole('region', { name: 'Tarefa' });
    expect(within(card).getByText(summary)).toBeInTheDocument();
    expect(summary).toMatch(/segunda e quarta/);
  });

  it('pd32 lists only today and the next six days in Ocorrências', async () => {
    const user = userEvent.setup();
    open('/tasks/r1?tab=occurrences');
    const panel = await screen.findByRole('tabpanel');

    const items = await within(panel).findAllByRole('listitem');
    expect(items).toHaveLength(7);
    expect(
      within(panel).getByText(/os dias que já passaram não ficam guardados/),
    ).toBeInTheDocument();
    expect(within(panel).queryByText(/4 de nov/)).not.toBeInTheDocument();

    await user.click(
      within(panel).getByRole('button', { name: 'Concluir hoje: Alongamento da manhã' }),
    );
    expect(
      await within(panel).findByRole('button', { name: 'Reabrir hoje: Alongamento da manhã' }),
    ).toBeInTheDocument();
  });

  it('shows the Visão geral and Ocorrências tabs before the extra tabs', async () => {
    open('/tasks/r1', world(), { extra: true });
    await screen.findByRole('heading', { level: 1, name: 'Alongamento da manhã' });

    const tabs = screen.getAllByRole('tab').map((tab) => tab.textContent);
    expect(tabs).toEqual(['Visão geral', 'Ocorrências', 'Conexões']);
  });

  it('has no axe violations in the detail', async () => {
    const { container } = open('/tasks/r1');
    await screen.findByRole('heading', { level: 1, name: 'Alongamento da manhã' });
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('task form', () => {
  it('creates a single task', async () => {
    const user = userEvent.setup();
    const { state, router } = open('/tasks/new');
    await user.type(await screen.findByRole('textbox', { name: 'Título' }), 'Ligar para o banco');
    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/tasks/new-1');
    });
    const post = state.calls.find((call) => call.method === 'POST');
    expect(post?.body).toMatchObject({
      title: 'Ligar para o banco',
      recurrence: null,
      labels: [],
      visibility: 'personal',
    });
  });

  it('shows the required error inside the form with role alert', async () => {
    const user = userEvent.setup();
    const { state } = open('/tasks/new');
    await user.click(await screen.findByRole('button', { name: 'Salvar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Campo obrigatório');
    expect(state.calls.some((call) => call.method === 'POST')).toBe(false);
  });

  it('creates a daily task and completes today occurrence only', async () => {
    const user = userEvent.setup();
    const { state } = open('/tasks/new');
    await user.type(await screen.findByRole('textbox', { name: 'Título' }), 'Beber água');
    await user.click(screen.getByRole('radio', { name: 'Recorrente' }));
    await user.type(screen.getByRole('textbox', { name: /Horário/ }), '0800');
    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    const complete = await screen.findByRole('button', { name: 'Concluir hoje' });
    const post = state.calls.find(
      (call) => call.method === 'POST' && call.url.pathname.endsWith('/tasks'),
    );
    expect(post?.body).toMatchObject({
      recurrence: { frequency: 'daily', interval: 1, time: '08:00', starts_on: TODAY },
    });

    await user.click(complete);
    await screen.findByRole('button', { name: 'Reabrir hoje' });
    const completion = state.calls.find((call) => call.url.pathname.endsWith('/completion'));
    expect(completion?.body).toEqual({ occurrence_date: TODAY });
    expect(
      state.occurrences.filter((item) => item.task_id === 'new-1' && item.completed),
    ).toHaveLength(1);
  });

  it('requires the rule time for a recurring task, as the recurrence rule of the spec', async () => {
    const user = userEvent.setup();
    const { state } = open('/tasks/new');
    await user.type(await screen.findByRole('textbox', { name: 'Título' }), 'Beber água');
    await user.click(screen.getByRole('radio', { name: 'Recorrente' }));
    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Informe o horário.');
    expect(state.calls.some((call) => call.method === 'POST')).toBe(false);
  });

  it('changes a recurring task from an occurrence on', async () => {
    const user = userEvent.setup();
    const { state } = open('/tasks/r1/edit?from=2026-11-07');
    const title = await screen.findByRole('textbox', { name: 'Título' });
    expect(
      screen.getByText('Vale para esta ocorrência e as próximas não concluídas'),
    ).toBeInTheDocument();
    await user.clear(title);
    await user.type(title, 'Alongamento leve');
    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => {
      expect(state.calls.some((call) => call.method === 'PATCH')).toBe(true);
    });
    expect(state.calls.find((call) => call.method === 'PATCH')?.body).toMatchObject({
      title: 'Alongamento leve',
      effective_from: '2026-11-07',
    });
  });

  it('pd62 lays the form in the grid with the repetition as a segmented field', async () => {
    const user = userEvent.setup();
    const { container } = open('/tasks/new');
    const title = await screen.findByRole('textbox', { name: 'Título' });

    for (const name of ['Título', 'Descrição']) {
      const field = screen.getByLabelText(name);
      expect(field.closest('[data-span="full"]')).not.toBeNull();
    }
    expect(
      screen.getByRole('radiogroup', { name: 'Visibilidade' }).closest('[data-span="full"]'),
    ).not.toBeNull();
    expect(container.querySelector('select')).toBeNull();
    expect(container.querySelector('input[type=date]')).toBeNull();
    expect(screen.queryByRole('checkbox', { name: /Repetir/ })).not.toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: 'Repetição' })).toBeInTheDocument();

    const buttons = screen.getAllByRole('button').map((button) => button.textContent);
    expect(buttons.indexOf('Cancelar')).toBeLessThan(buttons.indexOf('Salvar'));
    expect(title).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: 'Recorrente' }));
    expect(container.querySelector('select')).toBeNull();
    expect(container.querySelector('input[type=time]')).toBeNull();
  });

  it('pd57 picks the due date and the rule start in the custom calendar', async () => {
    const user = userEvent.setup();
    const { state } = open('/tasks/new');
    await user.type(await screen.findByRole('textbox', { name: 'Título' }), 'Renovar seguro');

    await user.click(screen.getByRole('button', { name: /^Data/ }));
    await user.click(screen.getByRole('button', { name: '12 de novembro de 2026' }));
    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => {
      expect(state.calls.some((call) => call.method === 'POST')).toBe(true);
    });
    expect(state.calls.find((call) => call.method === 'POST')?.body).toMatchObject({
      due_on: '2026-11-12',
    });
  });

  it('pd62 accepts 930 as 09:30 in the rule time', async () => {
    const user = userEvent.setup();
    open('/tasks/new');
    await user.click(await screen.findByRole('radio', { name: 'Recorrente' }));

    const time = screen.getByRole('textbox', { name: /Horário/ });
    await user.type(time, '930');
    await user.tab();

    expect(time).toHaveValue('09:30');
  });

  it('pd19 centers the header and the form in the form column', async () => {
    const { container } = open('/tasks/new');
    const title = await screen.findByRole('textbox', { name: 'Título' });
    const column = title.closest('[class*="screen"]');
    expect(column).not.toBeNull();
    expect(column?.contains(container.querySelector('[data-page-heading]'))).toBe(true);
    expect(column?.contains(container.querySelector('form'))).toBe(true);
  });

  it('dec006 adds labels as pills and sends them with the task', async () => {
    const user = userEvent.setup();
    const { state } = open('/tasks/new');
    await user.type(await screen.findByRole('textbox', { name: 'Título' }), 'Organizar a casa');
    const labels = screen.getByRole('textbox', { name: 'Etiquetas' });
    await user.type(labels, 'casa{Enter}');
    await user.type(labels, 'saúde,');

    const pills = screen.getByRole('list', { name: 'Etiquetas adicionadas' });
    expect(within(pills).getAllByRole('listitem')).toHaveLength(2);
    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => {
      expect(state.calls.some((call) => call.method === 'POST')).toBe(true);
    });
    expect(state.calls.find((call) => call.method === 'POST')?.body).toMatchObject({
      labels: ['casa', 'saúde'],
    });
  });

  it('dec006 refuses more than 20 labels or a label longer than 50 characters inside the form', async () => {
    const user = userEvent.setup();
    const { state } = open('/tasks/new');
    await user.type(await screen.findByRole('textbox', { name: 'Título' }), 'Muitas etiquetas');
    const labels = screen.getByRole('textbox', { name: 'Etiquetas' });

    await user.type(labels, `${'a'.repeat(51)}{Enter}`);
    await user.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Cada etiqueta tem no máximo 50 caracteres.',
    );
    expect(state.calls.some((call) => call.method === 'POST')).toBe(false);

    await user.click(screen.getByRole('button', { name: `Remover ${'a'.repeat(51)}` }));
    for (let index = 0; index < 21; index += 1) {
      await user.type(labels, `t${String(index)}{Enter}`);
    }
    await user.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Use no máximo 20 etiquetas.');
    expect(state.calls.some((call) => call.method === 'POST')).toBe(false);
  });

  it('dec006 offers the full recurrence rule', async () => {
    const user = userEvent.setup();
    const { state } = open('/tasks/new');
    await user.type(await screen.findByRole('textbox', { name: 'Título' }), 'Revisão quinzenal');
    await user.click(screen.getByRole('radio', { name: 'Recorrente' }));

    await user.click(screen.getByRole('button', { name: /^Frequência/ }));
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
      'Diária',
      'Semanal',
      'Mensal',
      'Anual',
    ]);
    await user.click(screen.getByRole('option', { name: 'Semanal' }));
    expect(screen.getByText('Dias da semana')).toBeInTheDocument();

    const interval = screen.getByRole('spinbutton', { name: /Repetir a cada/ });
    await user.clear(interval);
    await user.type(interval, '2');
    await user.click(screen.getByRole('checkbox', { name: 'segunda-feira' }));
    await user.click(screen.getByRole('checkbox', { name: 'quarta-feira' }));
    await user.type(screen.getByRole('textbox', { name: /Horário/ }), '0700');
    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => {
      expect(state.calls.some((call) => call.method === 'POST')).toBe(true);
    });
    expect(state.calls.find((call) => call.method === 'POST')?.body).toMatchObject({
      recurrence: { frequency: 'weekly', interval: 2, weekdays: ['mon', 'wed'] },
    });

    cleanup();
    open('/tasks/new');
    await user.click(await screen.findByRole('radio', { name: 'Recorrente' }));
    await user.click(screen.getByRole('button', { name: /^Frequência/ }));
    await user.click(screen.getByRole('option', { name: 'Mensal' }));
    expect(screen.getByText('Em meses mais curtos, cai no último dia')).toBeInTheDocument();
  });

  it('has no axe violations in the form', async () => {
    const { container } = open('/tasks/new');
    await screen.findByRole('textbox', { name: 'Título' });
    expect(await axe(container)).toHaveNoViolations();
  });
});
