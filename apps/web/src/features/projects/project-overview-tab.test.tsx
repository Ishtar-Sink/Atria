import { screen, within } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { rootRoute } from '../../app/router';
import { renderWithProviders } from '../../shared/test/render';
import { clearToasts } from '../../shared/toast/toast-store';
import { createProjectsRoutes } from './routes';
import { callsTo, cardOf, defaultLanes, json, projectOf, stubServer } from './test-server';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-03-01T15:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  clearToasts();
});

function cards() {
  return [
    cardOf({
      id: 'c-1',
      title: 'Escolher sofá',
      lane_id: 'l-wait',
      due_date: '2026-03-05',
      priority: 'high',
    }),
    cardOf({
      id: 'c-2',
      title: 'Medir parede',
      lane_id: 'l-wait',
      due_date: '2026-02-27',
      position: 1,
    }),
    cardOf({
      id: 'c-3',
      title: 'Pintar paredes',
      lane_id: 'l-doing',
      priority: 'medium',
      checklist: [
        { id: 'i-1', text: 'Lixar', done: true, position: 0 },
        { id: 'i-2', text: 'Primeira demão', done: false, position: 1 },
        { id: 'i-3', text: 'Segunda demão', done: false, position: 2 },
      ],
    }),
    cardOf({ id: 'c-4', title: 'Comprar tinta', lane_id: 'l-done' }),
    cardOf({ id: 'c-5', title: 'Contratar pintor', lane_id: 'l-done', position: 1 }),
  ];
}

function seeded(overrides: Parameters<typeof stubServer>[0] = {}) {
  return stubServer({
    projects: [projectOf({ description: 'Deixar a sala pronta para visitas.' })],
    lanes: defaultLanes(),
    cards: cards(),
    ...overrides,
  });
}

function renderAt(route = '/projects/p-1', links_slot?: () => React.ReactNode) {
  return renderWithProviders(null, {
    routes: createProjectsRoutes(rootRoute, links_slot ? { links_slot } : {}),
    route,
  });
}

describe('project overview', () => {
  it('pd42 requests the summary with today in the user time zone', async () => {
    vi.setSystemTime(new Date('2026-03-01T02:00:00Z'));
    const server = seeded();
    renderAt();
    await screen.findByRole('heading', { name: 'Andamento' });
    const call = callsTo(server, 'GET', '/projects/p-1/summary')[0];
    // 02:00 UTC ainda é 28/02 em São Paulo.
    expect(call?.url.searchParams.get('today')).toBe('2026-02-28');
  });

  it('pd42 shows a bar per lane and 2 of 5 cards done', async () => {
    seeded();
    renderAt();
    const progress = (await screen.findByRole('heading', { name: 'Andamento' })).closest('section');
    expect(progress).not.toBeNull();
    const bar = within(progress as HTMLElement).getByRole('img');
    expect(bar).toHaveAttribute('aria-label', 'Aguardando: 2, Em progresso: 1, Pronto: 2');
    expect(bar.querySelectorAll('span')).toHaveLength(3);
    expect(within(progress as HTMLElement).getByText('2 de 5 cartões prontos')).toBeInTheDocument();
  });

  it('pd42 lists upcoming due dates in 14 days with overdue in neutral text', async () => {
    seeded();
    renderAt();
    const section = (await screen.findByRole('heading', { name: 'Próximos prazos' })).closest(
      'section',
    );
    const scope = within(section as HTMLElement);
    expect(scope.getByRole('link', { name: 'Escolher sofá' })).toHaveAttribute(
      'href',
      '/projects/p-1/cards/c-1',
    );
    expect(scope.getByText('Até 05/03/2026')).toBeInTheDocument();
    const overdue = scope.getByText('Era para 27/02/2026');
    expect(overdue).toBeInTheDocument();
    // Sem vermelho para uma pendência comum ([project/frontend-14]).
    expect(overdue.className).not.toMatch(/danger/);
    expect(scope.getAllByRole('listitem')[0]).toHaveTextContent('Medir parede');
  });

  it('pd42 lists in progress cards with checklist and priority', async () => {
    seeded();
    renderAt();
    const section = (await screen.findByRole('heading', { name: 'Em andamento' })).closest(
      'section',
    );
    const scope = within(section as HTMLElement);
    expect(scope.getByRole('link', { name: 'Pintar paredes' })).toBeInTheDocument();
    expect(scope.getByText('Checklist 1/3 · Prioridade média')).toBeInTheDocument();
    expect(scope.getByText('Em progresso')).toBeInTheDocument();
  });

  it('pd42 shows the high priority card only when there is one', async () => {
    seeded();
    const first = renderAt();
    const section = (await screen.findByRole('heading', { name: 'Prioridade alta' })).closest(
      'section',
    );
    expect(
      within(section as HTMLElement).getByRole('link', { name: 'Escolher sofá' }),
    ).toBeInTheDocument();
    first.unmount();
    vi.unstubAllGlobals();

    seeded({ cards: cards().map((card) => ({ ...card, priority: null })) });
    renderAt();
    await screen.findByRole('heading', { name: 'Andamento' });
    expect(screen.queryByRole('heading', { name: 'Prioridade alta' })).not.toBeInTheDocument();
  });

  it('pd42 shows Sobre with description visibility and dates', async () => {
    seeded();
    renderAt();
    const section = (await screen.findByRole('heading', { name: 'Sobre' })).closest('section');
    const scope = within(section as HTMLElement);
    expect(scope.getByText('Deixar a sala pronta para visitas.')).toBeInTheDocument();
    expect(scope.getByText('Pessoal')).toBeInTheDocument();
    expect(scope.getByText('Criado em')).toBeInTheDocument();
    expect(scope.getByText(/5 de jan\. de 2026/)).toBeInTheDocument();
    expect(scope.getByText(/6 de fev\. de 2026/)).toBeInTheDocument();
  });

  it('pd42 lists the tasks linked to cards and the links slot in Ligações', async () => {
    seeded({
      tasks: [{ id: 't-1', title: 'Chamar o eletricista', completed_at: null }],
      links: [
        {
          id: 'link-1',
          source_type: 'project_card',
          source_id: 'c-1',
          target_type: 'task',
          target_id: 't-1',
        },
      ],
    });
    renderAt('/projects/p-1', () => <p>Nota ligada ao projeto</p>);
    const section = (await screen.findByRole('heading', { name: 'Ligações' })).closest('section');
    const scope = within(section as HTMLElement);
    expect(await scope.findByRole('link', { name: 'Chamar o eletricista' })).toHaveAttribute(
      'href',
      '/tasks/t-1',
    );
    expect(scope.getByText('Tarefa ligada a “Escolher sofá”')).toBeInTheDocument();
    expect(scope.getByText('Nota ligada ao projeto')).toBeInTheDocument();
  });

  it('pd42 shows the empty texts of each block', async () => {
    seeded({ cards: [] });
    renderAt();
    expect(await screen.findByText('Nenhum cartão ainda. Comece pelo Quadro.')).toBeInTheDocument();
    expect(screen.getByText('Nenhum prazo nos próximos 14 dias.')).toBeInTheDocument();
    expect(screen.getByText('Nada em andamento agora.')).toBeInTheDocument();
    expect(screen.getByText('Nenhuma ligação ainda.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Conectar a algo' })).toHaveAttribute(
      'href',
      '/projects/p-1?tab=connections',
    );
  });

  it('shows the loading state', async () => {
    const server = seeded();
    server.reject = (call) => (call.url.pathname.endsWith('/summary') ? 'hang' : undefined);
    renderAt();
    expect(await screen.findByText('Carregando a visão geral…')).toBeInTheDocument();
  });

  it('shows the error state', async () => {
    const server = seeded();
    server.reject = (call) =>
      call.url.pathname.endsWith('/summary') ? json({ code: 'boom', title: 'x' }, 500) : undefined;
    renderAt();
    expect(await screen.findByText('Não foi possível carregar a visão geral')).toBeInTheDocument();
  });

  it('has no axe violations', async () => {
    seeded();
    const { container } = renderAt();
    await screen.findByRole('heading', { name: 'Em andamento' });
    expect(await axe(container)).toHaveNoViolations();
  });
});
