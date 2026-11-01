import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { rootRoute } from '../../../app/router';
import { setViewportWidth } from '../../../shared/test/setup';
import { renderWithProviders } from '../../../shared/test/render';
import { clearToasts } from '../../../shared/toast/toast-store';
import type { Goal, Milestone } from '../lib/goal-progress';
import { createGoalsRoutes } from '../routes';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function goalOf(overrides: Partial<Goal> = {}): Goal {
  return {
    id: 'g-1',
    owner_id: 'u-1',
    title: 'Ler doze livros',
    description: null,
    deadline: null,
    status: 'in_progress',
    labels: [],
    visibility: 'personal',
    milestone_count: 0,
    completed_milestone_count: 0,
    progress_percent: 0,
    created_at: '2026-01-05T10:00:00Z',
    updated_at: '2026-02-06T10:00:00Z',
    ...overrides,
  };
}

function milestoneOf(index: number, completed = false): Milestone {
  return {
    id: `m-${String(index)}`,
    goal_id: 'g-1',
    owner_id: 'u-1',
    title: `Marco ${String(index)}`,
    completed,
    position: index,
    visibility: 'personal',
    created_at: '2026-01-05T10:00:00Z',
    updated_at: '2026-01-05T10:00:00Z',
  };
}

interface Call {
  method: string;
  url: URL;
  body: Record<string, unknown>;
}

interface Server {
  goals: Goal[];
  milestones: Milestone[];
  calls: Call[];
  mode: 'ok' | 'loading' | 'error';
}

/** API falsa em memória: metas e marcos de uma meta, com as contas dos marcos feitas como no servidor. */
function stubServer(initial: Partial<Server> = {}): Server {
  const server: Server = { goals: [], milestones: [], calls: [], mode: 'ok', ...initial };
  const current = (goal: Goal): Goal => {
    const own = server.milestones.filter((milestone) => milestone.goal_id === goal.id);
    if (own.length === 0) return goal;
    const done = own.filter((milestone) => milestone.completed).length;
    return {
      ...goal,
      milestone_count: own.length,
      completed_milestone_count: done,
      progress_percent: Math.floor((done * 100) / own.length),
    };
  };
  vi.stubGlobal(
    'fetch',
    vi.fn((input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(input instanceof Request ? input.url : input, 'http://localhost');
      const method = init?.method ?? 'GET';
      const body =
        typeof init?.body === 'string' ? (JSON.parse(init.body) as Record<string, unknown>) : {};
      if (url.pathname === '/api/v1/me')
        return Promise.resolve(json({ id: 'u-1', email: 'a@b.c' }));
      server.calls.push({ method, url, body });
      if (server.mode === 'loading') return new Promise<Response>(() => undefined);
      if (server.mode === 'error') return Promise.resolve(json({ code: 'boom', title: 'x' }, 500));
      const parts = url.pathname.replace('/api/v1/goals', '').split('/').filter(Boolean);
      const [goal_id, section, milestone_id] = parts;
      if (goal_id === undefined) {
        if (method === 'POST') {
          const created = goalOf({ id: 'g-new', ...(body as Partial<Goal>) });
          server.goals.push(created);
          return Promise.resolve(json(created, 201));
        }
        return Promise.resolve(json({ items: server.goals.map(current), next_cursor: null }));
      }
      if (section === 'milestones') {
        if (method === 'POST') {
          const created = {
            ...milestoneOf(server.milestones.length + 1),
            title: String(body.title),
          };
          server.milestones.push(created);
          return Promise.resolve(json(created, 201));
        }
        if (method === 'PATCH') {
          server.milestones = server.milestones.map((item) =>
            item.id === milestone_id ? { ...item, ...body } : item,
          );
          return Promise.resolve(json(server.milestones.find((item) => item.id === milestone_id)));
        }
        if (method === 'DELETE') {
          server.milestones = server.milestones.filter((item) => item.id !== milestone_id);
          return Promise.resolve(new Response(null, { status: 204 }));
        }
        return Promise.resolve(json({ items: server.milestones, next_cursor: null }));
      }
      const found = server.goals.find((goal) => goal.id === goal_id);
      if (!found) return Promise.resolve(json({ code: 'not_found', title: 'x' }, 404));
      if (method === 'DELETE') {
        server.goals = server.goals.filter((goal) => goal.id !== goal_id);
        return Promise.resolve(new Response(null, { status: 204 }));
      }
      if (method === 'PATCH') {
        Object.assign(found, body);
        return Promise.resolve(json(current(found)));
      }
      return Promise.resolve(json(current(found)));
    }),
  );
  return server;
}

function renderAt(route: string) {
  return renderWithProviders(null, { routes: createGoalsRoutes(rootRoute), route });
}

function must<T>(value: T | null): T {
  if (value === null) throw new Error('elemento não encontrado');
  return value;
}

afterEach(() => {
  vi.unstubAllGlobals();
  clearToasts();
});

async function expectNoViolations(container: HTMLElement) {
  expect(await axe(container)).toHaveNoViolations();
}

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

describe('goals list', () => {
  it('filters and searches goals through the url', async () => {
    const server = stubServer({ goals: [goalOf()] });
    const { router, container } = renderAt('/goals?status=in_progress&q=ler');
    expect(await screen.findByRole('heading', { level: 1, name: 'Metas' })).toHaveAttribute(
      'data-page-heading',
    );
    expect(screen.getByText('Aonde você quer chegar, em marcos pequenos.')).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Ler doze livros' })).toBeInTheDocument();
    const first = server.calls.find((call) => call.url.pathname === '/api/v1/goals');
    expect(first?.url.searchParams.get('status')).toBe('in_progress');
    expect(first?.url.searchParams.get('q')).toBe('ler');

    expect(screen.getByRole('group', { name: 'Filtros' })).toBeInTheDocument();
    await userEvent.type(screen.getByRole('searchbox', { name: 'Busca' }), 'a');
    await waitFor(() => {
      expect(router.state.location.search).toMatchObject({ q: 'lera' });
    });
    await expectNoViolations(container);
  });

  it('dec006 filters goals by label and by deadline through the url', async () => {
    const server = stubServer({ goals: [goalOf()] });
    const { router } = renderAt('/goals');
    await screen.findByRole('link', { name: 'Ler doze livros' });

    await userEvent.click(screen.getByLabelText('Prazo'));
    await userEvent.click(screen.getByRole('option', { name: 'Com prazo' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Etiqueta' }), 'casa{Enter}');
    await waitFor(() => {
      expect(router.state.location.search).toMatchObject({ has_deadline: true, label: 'casa' });
    });
    await waitFor(() => {
      const last = server.calls.filter((call) => call.url.pathname === '/api/v1/goals').at(-1);
      expect(last?.url.searchParams.get('label')).toBe('casa');
      expect(last?.url.searchParams.get('has_deadline')).toBe('true');
    });

    await userEvent.clear(screen.getByRole('textbox', { name: 'Etiqueta' }));
    await waitFor(() => {
      expect(router.state.location.search).not.toHaveProperty('label');
    });
  });

  it('pd62 lists the four goal statuses in the status filter', async () => {
    stubServer({ goals: [goalOf()] });
    const { container } = renderAt('/goals');
    await screen.findByRole('link', { name: 'Ler doze livros' });
    expect(container.querySelector('select')).toBeNull();
    await userEvent.click(screen.getByLabelText('Status'));
    const names = screen.getAllByRole('option').map((option) => option.textContent);
    expect(names).toEqual(['Todos', 'Planejada', 'Em andamento', 'Concluída', 'Abandonada']);
  });

  it('uses the shared view icons with title and accessible name', async () => {
    stubServer({ goals: [goalOf()] });
    renderAt('/goals');
    await screen.findByRole('link', { name: 'Ler doze livros' });
    expectViewIcons(screen.getByRole('group', { name: 'Visualização' }), ['Lista', 'Grade']);
  });

  it('switches between list and grid', async () => {
    stubServer({
      goals: [
        goalOf({
          labels: ['leitura'],
          deadline: '2026-10-12',
          milestone_count: 4,
          completed_milestone_count: 1,
          progress_percent: 25,
        }),
      ],
    });
    const { router } = renderAt('/goals');
    await screen.findByRole('link', { name: 'Ler doze livros' });
    expect(
      screen.getByRole('progressbar', { name: 'Progresso de Ler doze livros' }),
    ).toHaveAttribute('aria-valuenow', '25');
    expect(screen.getByText('25%')).toBeInTheDocument();
    expect(screen.getByText('#leitura')).toBeInTheDocument();
    expect(screen.getByText(/Prazo em 12 de out/)).toBeInTheDocument();

    const views = screen.getByRole('group', { name: 'Visualização' });
    await userEvent.click(within(views).getByRole('button', { name: 'Grade' }));
    await waitFor(() => {
      expect(router.state.location.search).toMatchObject({ view: 'grid' });
    });
    expect(within(views).getByRole('button', { name: 'Grade' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('link', { name: 'Ler doze livros' })).toBeInTheDocument();
  });

  it('shows empty, loading and error states', async () => {
    stubServer({ mode: 'loading' });
    const loading = renderAt('/goals');
    expect(await screen.findByRole('status')).toHaveAttribute('aria-busy', 'true');
    loading.unmount();
    vi.unstubAllGlobals();

    stubServer({ mode: 'error' });
    const failed = renderAt('/goals');
    expect(await screen.findByRole('button', { name: 'Tentar de novo' })).toBeInTheDocument();
    failed.unmount();
    vi.unstubAllGlobals();

    stubServer();
    const empty = renderAt('/goals');
    expect(await screen.findByText('Crie uma quando fizer sentido.')).toBeInTheDocument();
    expect(screen.getByText('Nenhuma meta por aqui')).toBeInTheDocument();
    await expectNoViolations(empty.container);
  });

  it('pd61 lists the goals reports in the Relatórios menu', async () => {
    stubServer({ goals: [goalOf()] });
    renderAt('/goals');
    await screen.findByRole('link', { name: 'Ler doze livros' });
    await userEvent.click(screen.getByRole('button', { name: 'Relatórios' }));
    expect(screen.getByRole('menuitem', { name: 'Progresso das metas' })).toHaveAttribute(
      'href',
      '/reports/goals-progress?from_module=goals',
    );
  });

  it('reaches every control with the keyboard', async () => {
    stubServer({ goals: [goalOf()] });
    renderAt('/goals');
    await screen.findByRole('link', { name: 'Ler doze livros' });
    const seen = new Set<string>();
    for (let step = 0; step < 14; step += 1) {
      await userEvent.tab();
      const name =
        document.activeElement?.getAttribute('aria-label') ?? document.activeElement?.textContent;
      seen.add(name ?? '');
    }
    expect(seen).toContain('Nova meta');
    expect(seen).toContain('Relatórios');
    expect(seen).toContain('Ler doze livros');
  });
});

describe('goal form', () => {
  it('creates a goal with title, deadline and status', async () => {
    const server = stubServer();
    const { router } = renderAt('/goals/new');
    await userEvent.type(await screen.findByLabelText('Título'), 'Correr cinco quilômetros');
    await userEvent.click(screen.getByLabelText('Status'));
    await userEvent.click(screen.getByRole('option', { name: 'Em andamento' }));
    await userEvent.click(screen.getByRole('button', { name: /Prazo/ }));
    await userEvent.click(must(document.querySelector<HTMLElement>('[data-day$="-15"]')));
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/goals/g-new');
    });
    const post = server.calls.find((call) => call.method === 'POST');
    expect(post?.body).toMatchObject({
      title: 'Correr cinco quilômetros',
      status: 'in_progress',
      visibility: 'personal',
    });
    expect(post?.body.deadline).toMatch(/^\d{4}-\d{2}-15$/);
  });

  it('shows the validation error inside the form', async () => {
    const server = stubServer();
    const { container } = renderAt('/goals/new');
    await userEvent.click(await screen.findByRole('button', { name: 'Salvar' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Campo obrigatório');
    expect(container.querySelector('form')).toContainElement(alert);
    expect(server.calls.some((call) => call.method === 'POST')).toBe(false);
    await expectNoViolations(container);
  });

  it('pd62 lays the form in the grid with title, description and visibility on the full row', async () => {
    stubServer();
    const { container } = renderAt('/goals/new');
    await screen.findByLabelText('Título');
    const span = (element: Element) => element.closest('[data-span="full"]');
    expect(span(screen.getByLabelText('Título'))).not.toBeNull();
    expect(span(screen.getByLabelText('Descrição'))).not.toBeNull();
    expect(span(screen.getByLabelText('Etiquetas'))).not.toBeNull();
    expect(span(screen.getByRole('radiogroup', { name: 'Visibilidade' }))).not.toBeNull();
    expect(container.querySelector('select')).toBeNull();
    expect(container.querySelector('input[type=date]')).toBeNull();
    const buttons = screen.getAllByRole('button').map((button) => button.textContent);
    expect(buttons.indexOf('Cancelar')).toBeLessThan(buttons.indexOf('Salvar'));
  });

  it('dec006 adds labels as pills and sends them with the goal', async () => {
    const server = stubServer();
    renderAt('/goals/new');
    const field = await screen.findByLabelText('Etiquetas');
    await userEvent.type(field, 'casa{Enter}');
    await userEvent.type(field, 'saúde,');
    const pills = within(screen.getByRole('list', { name: 'Etiquetas adicionadas' }));
    expect(pills.getAllByRole('listitem')).toHaveLength(2);
    await userEvent.type(screen.getByLabelText('Título'), 'Meta com etiquetas');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => {
      expect(server.calls.some((call) => call.method === 'POST')).toBe(true);
    });
    expect(server.calls.find((call) => call.method === 'POST')?.body.labels).toEqual([
      'casa',
      'saúde',
    ]);
  });

  it('dec006 refuses more than 20 labels or a label longer than 50 characters inside the form', async () => {
    const server = stubServer();
    renderAt('/goals/new');
    const field = await screen.findByLabelText('Etiquetas');
    await userEvent.type(screen.getByLabelText('Título'), 'Meta');
    await userEvent.type(field, `${'a'.repeat(51)}{Enter}`);
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Cada etiqueta tem até 50 caracteres.',
    );

    await userEvent.click(screen.getByRole('button', { name: `Remover ${'a'.repeat(51)}` }));
    for (let index = 1; index <= 21; index += 1) {
      await userEvent.type(field, `t${String(index)}{Enter}`);
    }
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Use até 20 etiquetas.');
    });
    expect(server.calls.some((call) => call.method === 'POST')).toBe(false);
  });

  it('pd62 offers the four goal statuses in the form', async () => {
    stubServer();
    renderAt('/goals/new');
    const select = await screen.findByLabelText('Status');
    expect(select).toHaveTextContent('Planejada');
    await userEvent.click(select);
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
      'Planejada',
      'Em andamento',
      'Concluída',
      'Abandonada',
    ]);
  });

  it('pd57 picks the deadline in the custom calendar', async () => {
    const server = stubServer();
    renderAt('/goals/new');
    await userEvent.type(await screen.findByLabelText('Título'), 'Meta com prazo');
    await userEvent.click(screen.getByRole('button', { name: /Prazo/ }));
    const day = must(document.querySelector<HTMLElement>('[data-day$="-15"]'));
    const iso = day.dataset.day;
    day.focus();
    await userEvent.keyboard('{ArrowRight}{Enter}');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => {
      expect(server.calls.some((call) => call.method === 'POST')).toBe(true);
    });
    const sent = server.calls.find((call) => call.method === 'POST')?.body.deadline;
    expect(sent).toMatch(/^\d{4}-\d{2}-16$/);
    expect(sent).not.toBe(iso);
  });

  it('sends a null deadline after Limpar', async () => {
    const server = stubServer({ goals: [goalOf({ deadline: '2026-10-12' })] });
    renderAt('/goals/g-1/edit');
    await userEvent.click(await screen.findByRole('button', { name: /Prazo/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Limpar' }));
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => {
      expect(server.calls.some((call) => call.method === 'PATCH')).toBe(true);
    });
    expect(server.calls.find((call) => call.method === 'PATCH')?.body.deadline).toBeNull();
  });

  it('pd19 centers the header and the form in the form column', async () => {
    stubServer();
    const { container } = renderAt('/goals/new');
    const heading = await screen.findByRole('heading', { level: 1, name: 'Nova meta' });
    const column = must(heading.closest('div[class*="screen"]'));
    expect(column).toContainElement(must(container.querySelector('form')));
    expect(screen.getByRole('link', { name: 'Voltar' })).toBeInTheDocument();
  });
});

describe('goal screen', () => {
  const four = [milestoneOf(1), milestoneOf(2), milestoneOf(3), milestoneOf(4)];

  it('creates a goal, adds four milestones, completes one and shows 25 percent', async () => {
    stubServer({ goals: [goalOf()] });
    const { container } = renderAt('/goals/g-1?tab=milestones');
    const field = await screen.findByLabelText('Novo marco');
    for (let index = 1; index <= 4; index += 1) {
      await userEvent.type(field, `Marco ${String(index)}{Enter}`);
      await screen.findByLabelText(`Marco ${String(index)}`);
    }
    expect(screen.getAllByRole('checkbox')).toHaveLength(4);
    await userEvent.click(screen.getByLabelText('Marco 1'));
    expect(screen.getByRole('progressbar', { name: 'Progresso' })).toHaveAttribute(
      'aria-valuenow',
      '25',
    );
    expect(screen.getByText('25% dos marcos concluídos.')).toBeInTheDocument();
    await expectNoViolations(container);
  });

  it('ct15 shows the not found screen when the goal answers 404', async () => {
    stubServer({ goals: [] });
    renderAt('/goals/g-1');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Página não encontrada' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Não foi possível carregar a meta')).not.toBeInTheDocument();
  });

  it('ct15 shows the not found screen when editing a goal that answers 404', async () => {
    stubServer({ goals: [] });
    renderAt('/goals/g-1/edit');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Página não encontrada' }),
    ).toBeInTheDocument();
  });

  it('completes a just created milestone by its saved id, before the list is read again', async () => {
    const server = stubServer({ goals: [goalOf()] });
    renderAt('/goals/g-1?tab=milestones');
    const field = await screen.findByLabelText('Novo marco');
    // Depois da primeira leitura, a lista de marcos não responde mais: só a resposta do POST
    // pode dar ao marco o id gravado.
    const stubbed = vi.mocked(fetch).getMockImplementation();
    vi.mocked(fetch).mockImplementation((input, init) => {
      const url = new URL(input instanceof Request ? input.url : input, 'http://localhost');
      const method = init?.method ?? 'GET';
      if (method === 'GET' && url.pathname.endsWith('/milestones'))
        return new Promise<Response>(() => undefined);
      return stubbed ? stubbed(input, init) : Promise.reject(new Error('sem fetch'));
    });
    await userEvent.type(field, 'Marco 1{Enter}');
    const checkbox = await screen.findByLabelText('Marco 1');
    await waitFor(() => {
      expect(checkbox).toBeEnabled();
    });
    await userEvent.click(checkbox);
    await waitFor(() => {
      expect(server.calls.some((call) => call.method === 'PATCH')).toBe(true);
    });
    const patch = server.calls.find((call) => call.method === 'PATCH');
    expect(patch?.url.pathname).toBe('/api/v1/goals/g-1/milestones/m-1');
    expect(checkbox).toBeChecked();
  });

  it('deletes a milestone after confirmation', async () => {
    const server = stubServer({ goals: [goalOf()], milestones: four });
    renderAt('/goals/g-1?tab=milestones');
    await userEvent.click(await screen.findByRole('button', { name: 'Remover marco Marco 2' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(server.calls.some((call) => call.method === 'DELETE')).toBe(false);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Excluir' }));
    await waitFor(() => {
      expect(screen.queryByLabelText('Marco 2')).not.toBeInTheDocument();
    });
    expect(server.calls.some((call) => call.method === 'DELETE')).toBe(true);
  });

  it('pd14 shows Editar with the pencil and Excluir in danger tone inside Mais ações', async () => {
    stubServer({ goals: [goalOf()] });
    renderAt('/goals/g-1');
    const edit = await screen.findByRole('link', { name: 'Editar' });
    expect(edit).toHaveAttribute('href', '/goals/g-1/edit');
    expect(edit.querySelector('svg')).not.toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Mais ações' }));
    expect(screen.getByRole('menuitem', { name: 'Excluir' })).toHaveAttribute(
      'data-tone',
      'danger',
    );
    expect(screen.getByText('Metas · Meta')).toBeInTheDocument();
  });

  it('deletes the goal after confirmation from Mais ações', async () => {
    const server = stubServer({ goals: [goalOf()] });
    const { router } = renderAt('/goals/g-1');
    await userEvent.click(await screen.findByRole('button', { name: 'Mais ações' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Excluir' }));
    const dialog = await screen.findByRole('alertdialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Excluir' }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/goals');
    });
    expect(server.calls.some((call) => call.method === 'DELETE')).toBe(true);
  });

  it('pd61 opens the goal progress report filtered by the goal from Mais ações', async () => {
    stubServer({ goals: [goalOf()] });
    renderAt('/goals/g-1');
    await userEvent.click(await screen.findByRole('button', { name: 'Mais ações' }));
    expect(screen.getByRole('menuitem', { name: 'Progresso das metas' })).toHaveAttribute(
      'href',
      '/reports/goals-progress?goal_id=g-1&run=1&from_module=goals',
    );
  });

  it('pd59 shows the overview in cards with Progresso, Descrição and Registro', async () => {
    stubServer({ goals: [goalOf()] });
    const bare = renderAt('/goals/g-1');
    await screen.findByRole('heading', { level: 2, name: 'Progresso' });
    expect(screen.getByRole('heading', { level: 2, name: 'Registro' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Descrição' })).not.toBeInTheDocument();
    expect(screen.getByText('(pelo status)')).toBeInTheDocument();
    expect(screen.getByText('Sem prazo', { selector: 'dd' })).toBeInTheDocument();
    bare.unmount();
    vi.unstubAllGlobals();

    stubServer({
      goals: [goalOf({ description: 'Um livro por mês.', labels: ['leitura', 'casa'] })],
    });
    renderAt('/goals/g-1');
    const description = await screen.findByRole('heading', { level: 2, name: 'Descrição' });
    expect(description.closest('section')).toHaveTextContent('Um livro por mês.');
    const record = screen.getByRole('heading', { level: 2, name: 'Registro' }).closest('section');
    expect(record).toHaveTextContent('#leitura');
    expect(record).toHaveTextContent('#casa');
  });

  it('shows the Visão geral and Marcos tabs before the extra tabs', async () => {
    stubServer({ goals: [goalOf()] });
    const { router } = renderWithProviders(null, {
      routes: createGoalsRoutes(rootRoute, {
        extra_tabs: [{ id: 'connections', label: 'Conexões', render: () => <p>conectado</p> }],
      }),
      route: '/goals/g-1',
    });
    await screen.findByRole('tab', { name: 'Visão geral' });
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      'Visão geral',
      'Marcos',
      'Conexões',
    ]);
    expect(screen.getByRole('tab', { name: 'Visão geral' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await userEvent.click(screen.getByRole('tab', { name: 'Conexões' }));
    expect(await screen.findByText('conectado')).toBeInTheDocument();
    await waitFor(() => {
      expect(router.state.location.search).toMatchObject({ tab: 'connections' });
    });
  });

  it('shows the loading and error states and works at 360 px', async () => {
    setViewportWidth(360);
    stubServer({ mode: 'error' });
    const failed = renderAt('/goals/g-1');
    expect(await screen.findByRole('button', { name: 'Tentar de novo' })).toBeInTheDocument();
    failed.unmount();
    vi.unstubAllGlobals();
    stubServer({ mode: 'loading' });
    renderAt('/goals/g-1');
    expect(await screen.findByRole('status')).toBeInTheDocument();
    act(() => {
      setViewportWidth(1280);
    });
  });
});
