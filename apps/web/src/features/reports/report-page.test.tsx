import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { rootRoute } from '../../app/router';
import { clearToasts } from '../../shared/toast/toast-store';
import { renderWithProviders } from '../../shared/test/render';
import { REPORT_CATALOG } from './report-catalog';
import { createReportsRoutes } from './routes';

const ACCOUNT = '11111111-1111-4111-8111-111111111111';
const CATEGORY = '22222222-2222-4222-8222-222222222222';
const INCOME_CATEGORY = '22222222-2222-4222-8222-222222222223';
const BOOK = '33333333-3333-4333-8333-333333333333';
const EMOTION = '44444444-4444-4444-8444-444444444444';
const GOAL = '55555555-5555-4555-8555-555555555555';
const PROJECT = '66666666-6666-4666-8666-666666666666';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const PERIOD = { period: { from: '2026-10-01', to: '2026-10-31' }, any_period: false };
const BASE = { generated_on: '2026-10-30', filters: [] };

const MODELS: Record<string, Record<string, unknown>> = {
  'fin-flow': {
    ...BASE,
    ...PERIOD,
    report: 'fin-flow',
    currency: 'BRL',
    totals: { income: 500000, expense: 200000, net: 300000 },
    months: [{ month: '2026-10', income: 500000, expense: 200000, net: 300000 }],
    accounts: [],
  },
  'fin-cat': {
    ...BASE,
    ...PERIOD,
    report: 'fin-cat',
    currency: 'BRL',
    total_expense: 300000,
    categories: [
      { category_id: CATEGORY, name: 'Moradia', amount: 100000, percent: 33 },
      { category_id: INCOME_CATEGORY, name: 'Mercado', amount: 200000, percent: 67 },
    ],
  },
  'fin-diff': {
    ...BASE,
    ...PERIOD,
    report: 'fin-diff',
    currency: 'BRL',
    totals: { savings: 12000, gains: 3000, losses: 4500 },
    months: [{ month: '2026-10', savings: 12000, gains: 3000, losses: 4500 }],
  },
  'read-pages': {
    ...BASE,
    ...PERIOD,
    report: 'read-pages',
    total_pages: 120,
    session_count: 4,
    books: [
      { book_id: BOOK, title: 'Dom Casmurro', pages: 120, sessions: 4, progress_percent: 40 },
    ],
  },
  'lib-status': {
    ...BASE,
    report: 'lib-status',
    groups: [
      {
        item_type: 'book',
        label: 'Livros',
        total: 3,
        statuses: [{ status: 'reading', label: 'Lendo', count: 3 }],
      },
    ],
  },
  'journal-emo': {
    ...BASE,
    ...PERIOD,
    report: 'journal-emo',
    entry_count: 7,
    average_intensity: 3.5,
    days: [],
    emotions: [{ emotion_id: EMOTION, name: 'Alegria', count: 5, average_intensity: 4 }],
  },
  'goals-progress': {
    ...BASE,
    report: 'goals-progress',
    goals: [
      {
        goal_id: GOAL,
        title: 'Ler doze livros',
        status: 'in_progress',
        deadline: null,
        progress_percent: 25,
        milestone_count: 4,
        completed_milestone_count: 1,
      },
    ],
    by_status: [{ status: 'in_progress', label: 'Em andamento', count: 1 }],
  },
  'tasks-done': {
    ...BASE,
    report: 'tasks-done',
    completed: 6,
    open: 2,
    overdue: 1,
    recurring_notice: 'x',
  },
  'proj-cards': {
    ...BASE,
    report: 'proj-cards',
    projects: [
      {
        project_id: PROJECT,
        name: 'Reforma',
        total_cards: 5,
        lanes: [{ lane_id: 'l-1', name: 'Fazendo', color: 'primary', card_count: 2 }],
      },
    ],
  },
};

const HEADINGS: Record<string, string> = {
  'fin-flow': 'Entradas e saídas por mês',
  'fin-cat': 'Gastos por categoria',
  'fin-diff': 'Economias e perdas',
  'read-pages': 'Páginas lidas por livro',
  'lib-status': 'Livros por status',
  'journal-emo': 'Emoções mais frequentes',
  'goals-progress': 'Progresso por meta',
  'tasks-done': 'Tarefas pontuais',
  'proj-cards': 'Cartões por raia',
};

interface Server {
  urls: URL[];
  report_mode: 'ok' | 'refused' | 'error' | 'held';
  release: () => void;
  file_mode: 'ok' | 'loading' | 'error';
}

function stubServer(initial: Partial<Server> = {}): Server {
  const server: Server = {
    urls: [],
    report_mode: 'ok',
    file_mode: 'ok',
    release: () => undefined,
    ...initial,
  };
  const held = new Promise<void>((resolve) => {
    server.release = resolve;
  });
  const page = (items: unknown[]) => json({ items, next_cursor: null });
  vi.stubGlobal(
    'fetch',
    vi.fn((input: string | URL | Request) => {
      const url = new URL(input instanceof Request ? input.url : input, 'http://localhost');
      server.urls.push(url);
      const path = url.pathname.replace('/api/v1', '');
      if (path === '/me') return Promise.resolve(json({ id: 'u-1', email: 'a@b.c' }));
      if (path === '/accounts')
        return Promise.resolve(page([{ id: ACCOUNT, name: 'Conta corrente' }]));
      if (path === '/categories') {
        const expense = [{ id: CATEGORY, name: 'Moradia', kind: 'expense' }];
        const income = [{ id: INCOME_CATEGORY, name: 'Salário', kind: 'income' }];
        const kind = url.searchParams.get('kind');
        return Promise.resolve(page(kind === 'expense' ? expense : [...expense, ...income]));
      }
      if (path === '/books') return Promise.resolve(page([{ id: BOOK, title: 'Dom Casmurro' }]));
      if (path === '/emotions') {
        return Promise.resolve(
          json({ items: [{ id: EMOTION, name: 'Alegria', system_key: null }] }),
        );
      }
      if (path === '/goals') return Promise.resolve(page([{ id: GOAL, title: 'Ler doze livros' }]));
      if (path === '/projects') return Promise.resolve(page([{ id: PROJECT, name: 'Reforma' }]));
      const id = path.replace('/reports/', '');
      if (url.searchParams.get('format') === 'pdf') {
        if (server.file_mode === 'loading') return new Promise<Response>(() => undefined);
        if (server.file_mode === 'error') {
          return Promise.resolve(json({ code: 'boom', title: 'x' }, 500));
        }
        return Promise.resolve(
          new Response('%PDF', {
            headers: {
              'Content-Type': 'application/pdf',
              'Content-Disposition': `attachment; filename="atria-${id}-2026-10-01-2026-10-31.pdf"`,
            },
          }),
        );
      }
      const model = MODELS[id];
      if (server.report_mode === 'held') return held.then(() => json(model));
      if (server.report_mode === 'refused') {
        return Promise.resolve(json({ code: 'report_filter_invalid', title: 'x' }, 422));
      }
      if (server.report_mode === 'error')
        return Promise.resolve(json({ code: 'boom', title: 'x' }, 500));
      if (!model) return Promise.resolve(json({ code: 'report_not_found', title: 'x' }, 404));
      return Promise.resolve(json(url.searchParams.has('from') ? model : { ...model }));
    }),
  );
  return server;
}

function renderAt(route: string) {
  return renderWithProviders(null, { routes: createReportsRoutes(rootRoute), route });
}

const reportCalls = (server: Server, id: string) =>
  server.urls.filter((url) => url.pathname === `/api/v1/reports/${id}`);

const filterField = (name: RegExp) => screen.getByRole('button', { name });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-30T15:00:00Z'));
});

afterEach(() => {
  clearToasts();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('ReportPage', () => {
  it('shows the period only in the five period reports', async () => {
    const with_period = ['fin-flow', 'fin-cat', 'fin-diff', 'read-pages', 'journal-emo'];
    stubServer();
    for (const { id } of REPORT_CATALOG) {
      const { unmount } = renderAt(`/reports/${id}`);
      await screen.findByRole('heading', { name: 'Filtros' });
      const trigger = screen.queryByRole('button', { name: /Período/ });
      expect(trigger !== null, id).toBe(with_period.includes(id));
      unmount();
    }
  });

  it('shows the filters of each report', async () => {
    stubServer();
    const expected: Record<string, RegExp[]> = {
      'fin-flow': [/^Conta /],
      'fin-cat': [/^Conta /, /^Categoria /],
      'fin-diff': [/^Conta /],
      'read-pages': [/^Livro /],
      'lib-status': [/^Tipo /],
      'journal-emo': [/^Emoção /],
      'goals-progress': [/^Meta /, /^Status /],
      'tasks-done': [],
      'proj-cards': [/^Projeto /],
    };
    const all = [
      /^Conta /,
      /^Categoria /,
      /^Livro /,
      /^Tipo /,
      /^Emoção /,
      /^Meta /,
      /^Status /,
      /^Projeto /,
    ];
    for (const [id, shown] of Object.entries(expected)) {
      const { unmount } = renderAt(`/reports/${id}`);
      await screen.findByRole('heading', { name: 'Filtros' });
      for (const name of all) {
        expect(screen.queryByRole('button', { name }) !== null, `${id} ${String(name)}`).toBe(
          shown.some((item) => item.source === name.source),
        );
      }
      if (shown.length === 0) {
        expect(screen.getByText('Este relatório não tem filtros.')).toBeInTheDocument();
      }
      unmount();
    }
  });

  it('shows only expense categories in the category filter', async () => {
    const server = stubServer();
    renderAt('/reports/fin-cat');
    await userEvent.click(await screen.findByRole('button', { name: /^Categoria / }));
    const list = await screen.findByRole('listbox');
    await waitFor(() => {
      expect(within(list).getByRole('option', { name: 'Moradia' })).toBeInTheDocument();
    });
    expect(within(list).queryByRole('option', { name: 'Salário' })).not.toBeInTheDocument();
    const call = server.urls.find((url) => url.pathname === '/api/v1/categories');
    expect(call?.searchParams.get('kind')).toBe('expense');
  });

  it('shows the result only after generating', async () => {
    const server = stubServer();
    renderAt('/reports/fin-flow');
    expect(await screen.findByText('Escolha os filtros')).toBeInTheDocument();
    expect(reportCalls(server, 'fin-flow')).toHaveLength(0);
    await userEvent.click(screen.getByRole('button', { name: 'Gerar relatório' }));
    expect(
      await screen.findByRole('heading', { name: 'Entradas e saídas por mês' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Escolha os filtros')).not.toBeInTheDocument();
    expect(reportCalls(server, 'fin-flow')[0]?.searchParams.get('from')).toBe('2026-10-01');
  });

  it('keeps the period and the filters in the URL', async () => {
    stubServer();
    const { router } = renderAt('/reports/fin-flow?from_module=finance');
    await userEvent.click(await screen.findByRole('button', { name: /^Conta / }));
    await userEvent.click(await screen.findByRole('option', { name: 'Conta corrente' }));
    await userEvent.click(screen.getByRole('button', { name: /Período/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Mês passado' }));
    await userEvent.click(screen.getByRole('button', { name: 'Gerar relatório' }));
    await waitFor(() => {
      expect(router.state.location.search).toMatchObject({
        account_id: ACCOUNT,
        period: 'last_month',
        from_module: 'finance',
        run: 1,
      });
    });
  });

  it('opens filtered and generated from an entity link', async () => {
    const server = stubServer();
    renderAt(`/reports/fin-cat?category_id=${CATEGORY}&run=1`);
    expect(
      await screen.findByRole('heading', { name: 'Gastos por categoria' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Período/ })).toHaveTextContent('Qualquer período');
    await waitFor(() => {
      expect(filterField(/^Categoria /)).toHaveTextContent('Moradia');
    });
    const params = reportCalls(server, 'fin-cat')[0]?.searchParams;
    expect(params?.get('category_id')).toBe(CATEGORY);
    expect(params?.has('from')).toBe(false);
    expect(params?.has('to')).toBe(false);
  });

  it('generates on load when the url has run', async () => {
    const server = stubServer();
    renderAt(`/reports/read-pages?book_id=${BOOK}&period=this_year&run=1`);
    expect(
      await screen.findByRole('heading', { name: 'Páginas lidas por livro' }),
    ).toBeInTheDocument();
    expect(reportCalls(server, 'read-pages')).toHaveLength(1);
    expect(reportCalls(server, 'read-pages')[0]?.searchParams.get('from')).toBe('2026-01-01');
  });

  it('offers any period in the period field', async () => {
    stubServer();
    renderAt('/reports/fin-flow');
    await userEvent.click(await screen.findByRole('button', { name: /Período/ }));
    const dialog = screen.getByRole('dialog', { name: 'Escolher período' });
    expect(within(dialog).getByRole('button', { name: 'Qualquer período' })).toBeInTheDocument();
    expect(
      within(dialog)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(
      expect.arrayContaining([
        'Este mês',
        'Mês passado',
        'Próximos 30 dias',
        'Últimos 30 dias',
        'Este ano',
        'Qualquer período',
      ]),
    );
  });

  it('shows any period with the resolved dates in the result', async () => {
    stubServer();
    MODELS['fin-flow'] = {
      ...MODELS['fin-flow'],
      any_period: true,
      period: { from: '2026-01-05', to: '2026-10-30' },
    };
    renderAt('/reports/fin-flow?period=all&run=1');
    expect(await screen.findByText(/Qualquer período · .*2026 – .*2026/)).toBeInTheDocument();
    MODELS['fin-flow'] = { ...MODELS['fin-flow'], ...PERIOD };
  });

  it('uses the custom select for the filters', async () => {
    stubServer();
    const { container } = renderAt('/reports/fin-cat');
    await screen.findByRole('button', { name: /^Conta / });
    expect(container.querySelector('select')).toBeNull();
    expect(container.querySelector('input[type=date]')).toBeNull();
    expect(filterField(/^Conta /)).toHaveAttribute('aria-haspopup', 'listbox');
  });

  it('goes back to the module it came from', async () => {
    stubServer();
    renderAt('/reports/fin-flow?from_module=finance&run=1');
    const back = await screen.findByRole('link', { name: 'Voltar' });
    expect(back).toHaveAttribute('href', '/finance');
  });

  it('renders the result of each report', async () => {
    stubServer();
    for (const { id } of REPORT_CATALOG) {
      const { unmount } = renderAt(`/reports/${id}?run=1&period=this_month`);
      expect(
        await screen.findByRole('heading', { name: HEADINGS[id] ?? '' }),
        id,
      ).toBeInTheDocument();
      unmount();
    }
  });

  it('renders money, tables and the tasks note', async () => {
    stubServer();
    const { unmount } = renderAt('/reports/fin-flow?run=1');
    expect(
      await screen.findByRole('table', { name: 'Entradas, saídas e saldo por mês' }),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/5\.000,00/).length).toBeGreaterThan(0);
    unmount();
    renderAt('/reports/tasks-done?run=1');
    expect(
      await screen.findByText(
        'Tarefas diárias não guardam histórico, por isso ficam fora deste relatório.',
      ),
    ).toBeInTheDocument();
  });

  it('keeps the report chart table inside a visually hidden container', async () => {
    stubServer();
    renderAt('/reports/fin-flow?run=1');
    const table = await screen.findByRole('table', { name: 'Entradas, saídas e saldo por mês' });
    expect(table.className).toBe('');
    expect(table.parentElement?.className).toContain('visuallyHidden');
    expect(table.contains(table.querySelector('caption'))).toBe(true);
  });

  it('opens the interactive html report in a new tab with the filters', async () => {
    stubServer();
    renderAt(`/reports/fin-flow?account_id=${ACCOUNT}&period=last_month&run=1`);
    const link = await screen.findByRole('link', { name: 'Abrir em nova aba' });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener');
    const href = new URL(link.getAttribute('href') ?? '', 'http://localhost');
    expect(href.pathname).toBe('/api/v1/reports/fin-flow');
    expect(href.searchParams.get('format')).toBe('html');
    expect(href.searchParams.get('account_id')).toBe(ACCOUNT);
    expect(href.searchParams.get('from')).toBe('2026-09-01');
    expect(href.searchParams.get('to')).toBe('2026-09-30');
  });

  it('exports the pdf with the period and the filters', async () => {
    const server = stubServer();
    vi.stubGlobal(
      'URL',
      Object.assign(URL, { createObjectURL: () => 'blob:x', revokeObjectURL: () => undefined }),
    );
    const names: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      names.push(this.download);
    });
    renderAt(`/reports/fin-flow?account_id=${ACCOUNT}&period=last_month&run=1`);
    await userEvent.click(await screen.findByRole('button', { name: 'Exportar PDF' }));
    await waitFor(() => {
      expect(names).toEqual(['atria-fin-flow-2026-10-01-2026-10-31.pdf']);
    });
    const call = server.urls.find((url) => url.searchParams.get('format') === 'pdf');
    expect(call?.searchParams.get('account_id')).toBe(ACCOUNT);
    expect(call?.searchParams.get('from')).toBe('2026-09-01');
    expect(call?.searchParams.get('to')).toBe('2026-09-30');
  });

  it('shows the loading state while exporting', async () => {
    stubServer({ file_mode: 'loading' });
    renderAt('/reports/fin-flow?run=1');
    await userEvent.click(await screen.findByRole('button', { name: 'Exportar PDF' }));
    const busy = await screen.findByRole('button', { name: 'Exportando…' });
    expect(busy).toBeDisabled();
    expect(busy).toHaveAttribute('aria-busy', 'true');
  });

  it('shows the error inside the page with role alert when the export fails', async () => {
    stubServer({ file_mode: 'error' });
    renderAt('/reports/fin-flow?run=1');
    await userEvent.click(await screen.findByRole('button', { name: 'Exportar PDF' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível exportar');
  });

  it('shows a success notice after the pdf is exported', async () => {
    stubServer();
    vi.stubGlobal(
      'URL',
      Object.assign(URL, { createObjectURL: () => 'blob:x', revokeObjectURL: () => undefined }),
    );
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    renderAt('/reports/fin-flow?run=1');
    await userEvent.click(await screen.findByRole('button', { name: 'Exportar PDF' }));
    expect(await screen.findByText('PDF do relatório baixado.')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('does not show the success notice when the export fails', async () => {
    stubServer({ file_mode: 'error' });
    renderAt('/reports/fin-flow?run=1');
    await userEvent.click(await screen.findByRole('button', { name: 'Exportar PDF' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível exportar');
    expect(screen.queryByText('PDF do relatório baixado.')).not.toBeInTheDocument();
  });

  it('marks the result as busy while the report is generated', async () => {
    const server = stubServer({ report_mode: 'held' });
    renderAt('/reports/fin-flow?run=1');
    const region = await screen.findByRole('region', { name: 'Resultado do relatório' });
    expect(region).toHaveAttribute('aria-busy', 'true');
    server.release();
    await screen.findByText('Entradas e saídas por mês');
    expect(region).not.toHaveAttribute('aria-busy');
  });

  it('shows a refused filter inside the filters card', async () => {
    stubServer({ report_mode: 'refused' });
    renderAt(`/reports/fin-flow?account_id=${ACCOUNT}&run=1`);
    const card = await screen.findByRole('region', { name: 'Filtros' });
    expect(await within(card).findByRole('alert')).toHaveTextContent('Este filtro não é aceito');
  });

  it('shows the error state with a retry when the report fails', async () => {
    stubServer({ report_mode: 'error' });
    renderAt('/reports/fin-flow?run=1');
    expect(await screen.findByText('Não foi possível carregar o relatório')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeInTheDocument();
  });

  it('shows the loading state while the report loads', async () => {
    stubServer();
    renderAt('/reports/fin-flow?run=1');
    expect(await screen.findByRole('status')).toHaveTextContent('Carregando o relatório…');
  });

  it('shows the not found page for an id outside the catalog', async () => {
    stubServer();
    renderAt('/reports/nao-existe');
    expect(await screen.findAllByRole('heading', { level: 1 })).not.toHaveLength(0);
    expect(screen.queryByRole('heading', { name: 'Filtros' })).not.toBeInTheDocument();
  });

  it('has no axe violations', async () => {
    stubServer();
    const { container } = renderAt('/reports/fin-cat?run=1');
    await screen.findByRole('heading', { name: 'Gastos por categoria' });
    expect(await axe(container)).toHaveNoViolations();
  });
});
