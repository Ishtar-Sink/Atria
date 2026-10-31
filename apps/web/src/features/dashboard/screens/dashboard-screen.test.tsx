import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { axe } from 'vitest-axe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from '@testing-library/react';
import { clearToasts, getToasts } from '../../../shared/toast/toast-store';
import { renderWithProviders } from '../../../shared/test/render';
import { dashboardFixtures, installFakeApi, NOW, problem } from '../hooks/fake-api';
import { HIDDEN_BLOCKS_KEY } from '../hooks/use-hidden-blocks';
import { MASKED_BLOCKS_KEY } from '../hooks/use-masked-blocks';
import { DashboardScreen } from './dashboard-screen';

const CSS = readFileSync(join(__dirname, '../components/dashboard.module.css'), 'utf8');

beforeEach(() => {
  window.scrollTo = vi.fn();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(NOW));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  if (getToasts().length > 0)
    act(() => {
      clearToasts();
    });
});

async function renderScreen(overrides: Parameters<typeof installFakeApi>[0] = {}) {
  const api = installFakeApi({ ...dashboardFixtures(), ...overrides });
  const view = renderWithProviders(<DashboardScreen />);
  await screen.findByRole('heading', { name: 'Dashboard', level: 1 });
  return { api, ...view };
}

async function ready(name: string) {
  const region = await screen.findByRole('region', { name });
  await waitFor(() => {
    expect(within(region).queryByRole('status')).not.toBeInTheDocument();
  });
  return region;
}

const openTasks = (count: number) => ({
  'GET /tasks/occurrences': () => ({ items: [] }),
  'GET /tasks': (call: { query: URLSearchParams }) =>
    call.query.get('recurring') === 'true'
      ? { items: [] }
      : {
          items: Array.from({ length: count }, (_, index) => ({
            id: `t${String(index)}`,
            title: `Tarefa ${String(index)}`,
            is_recurring: false,
            due_on: '2026-11-05',
          })),
        },
});

describe('DashboardScreen', () => {
  it('shows the greeting and the two zones with the blocks in order', async () => {
    const { container } = await renderScreen();
    expect(await screen.findByText('Boa tarde, Ana')).toBeInTheDocument();
    expect(screen.getByText('Visão geral')).toBeInTheDocument();
    expect(screen.getByText('O que importa hoje, num só lugar.')).toBeInTheDocument();
    const titles = (zone: string) =>
      Array.from(
        container.querySelectorAll(`[data-zone="${zone}"] > section > div > h2`),
        (heading) => heading.textContent,
      );
    expect(titles('main')).toEqual(['Tarefas de hoje', 'Lembretes de hoje', 'Próximos dias']);
    expect(titles('side')).toEqual(['Diário', 'Dinheiro', 'Leituras']);
  });

  it('keeps the zones in one column below 960 px with the main zone first', async () => {
    const { container } = await renderScreen();
    const zones = Array.from(container.querySelectorAll('[data-zone]'), (zone) =>
      zone.getAttribute('data-zone'),
    );
    expect(zones).toEqual(['main', 'side']);
    expect(CSS).toMatch(/grid-template-columns:\s*minmax\(0,\s*2fr\)\s*minmax\(280px,\s*1fr\)/);
    expect(CSS).toMatch(
      /@media \(max-width: 960px\)\s*{\s*\.zones\s*{\s*grid-template-columns:\s*minmax\(0,\s*1fr\)/,
    );
  });

  it('grows the last card of each zone so the columns end together', async () => {
    await renderScreen();
    expect(CSS).toMatch(/\.zones\s*{[^}]*align-items:\s*stretch/);
    expect(CSS).toMatch(/\.zone\s*{[^}]*flex-direction:\s*column/);
    expect(CSS).toMatch(/\.zone > :last-child\s*{\s*flex:\s*1 0 auto/);
  });

  it('shows at most three tasks and three reminders', async () => {
    await renderScreen(openTasks(5));
    const tasks = await ready('Tarefas de hoje');
    await waitFor(() => {
      expect(within(tasks).getAllByRole('listitem')).toHaveLength(3);
    });
    expect(within(tasks).getByRole('link', { name: 'Ver todas (5 tarefas hoje)' })).toHaveAttribute(
      'href',
      '/tasks',
    );
    const reminders = await ready('Lembretes de hoje');
    expect(within(reminders).getAllByRole('listitem')).toHaveLength(3);
    expect(within(reminders).queryByText('Dormir cedo')).not.toBeInTheDocument();
    expect(
      within(reminders).getByRole('link', { name: 'Ver todos (4 lembretes hoje)' }),
    ).toBeInTheDocument();
  });

  it('shows all done for today with the count of the day', async () => {
    await renderScreen({
      'GET /tasks/occurrences': () => ({
        items: [
          { task_id: 'a', occurrence_date: '2026-11-05', completed: true },
          { task_id: 'b', occurrence_date: '2026-11-05', completed: true },
        ],
      }),
      'GET /tasks': () => ({ items: [] }),
    });
    const tasks = await ready('Tarefas de hoje');
    expect(
      within(tasks).getByText('Tudo feito por hoje. Aproveite o resto do dia.'),
    ).toBeInTheDocument();
    expect(
      within(tasks).getByRole('link', { name: 'Ver todas (2 tarefas hoje)' }),
    ).toBeInTheDocument();
  });

  it('shows tasks and reminders in separate blocks', async () => {
    await renderScreen();
    const tasks = await ready('Tarefas de hoje');
    const reminders = await ready('Lembretes de hoje');
    expect(within(tasks).getByText('Pagar o IPTU')).toBeInTheDocument();
    expect(within(tasks).queryByText('Remédio')).not.toBeInTheDocument();
    expect(within(tasks).getByText('Era para ter., 3 de nov.')).toBeInTheDocument();
    expect(within(reminders).getByText('Remédio')).toBeInTheDocument();
    expect(
      within(reminders)
        .getAllByRole('heading', { level: 3 })
        .map((h) => h.textContent),
    ).toEqual(['Manhã', 'Tarde', 'Noite']);
    expect(within(reminders).queryByRole('button')).not.toBeInTheDocument();
    expect(within(reminders).getByText('08:00')).toBeInTheDocument();
  });

  it('completes a task from the dashboard with the check button', async () => {
    const fixtures = dashboardFixtures();
    const completed = new Set<string>();
    const listTasks = fixtures['GET /tasks'];
    fixtures['POST /tasks/late/completion'] = () => {
      completed.add('late');
      return { task_id: 'late', completed: true };
    };
    const { api } = await renderScreen({
      'GET /tasks': (call) => {
        const page = listTasks?.(call) as { items: { id: string }[] };
        return { items: page.items.filter((task) => !completed.has(task.id)) };
      },
      'POST /tasks/late/completion': fixtures['POST /tasks/late/completion'] ?? (() => ({})),
    });
    const tasks = await ready('Tarefas de hoje');
    await userEvent.click(
      await within(tasks).findByRole('button', { name: 'Concluir: Pagar o IPTU' }),
    );
    await waitFor(() => {
      expect(within(tasks).queryByText('Pagar o IPTU')).not.toBeInTheDocument();
    });
    expect(api.to('POST', '/tasks/late/completion')).toHaveLength(1);
    expect(
      within(tasks).getByRole('button', { name: 'Concluir hoje: Beber água' }),
    ).toBeInTheDocument();
  });

  it('shows the money block with the month left and the next month forecast', async () => {
    await renderScreen();
    const money = await ready('Dinheiro');
    const text = money.textContent;
    expect(text).toMatch(/R\$\s12\.345,00/);
    expect(text).toMatch(/Até o fim do mês: entradas R\$\s5\.000,00 · saídas R\$\s2\.000,00/);
    expect(
      within(money).getByRole('heading', { name: 'Previsão de dezembro', level: 3 }),
    ).toBeInTheDocument();
    expect(text).toMatch(/Entradas\s*R\$\s8\.000,00/);
    expect(text).toMatch(/Contas\s*R\$\s4\.500,00/);
    expect(text).toMatch(/Sobra\s*R\$\s3\.500,00/);
    expect(within(money).getByText('Aluguel')).toBeInTheDocument();
    expect(
      within(money).getByRole('link', { name: 'Ver todas as contas de dezembro' }),
    ).toHaveAttribute('href', '/finance/expenses?period=custom&from=2026-12-01&to=2026-12-31');
    const details = money.querySelector('details');
    expect(details).not.toHaveAttribute('open');
    expect(within(money).getByRole('link', { name: 'Conta corrente' })).toHaveAttribute(
      'href',
      '/finance/accounts/a1',
    );
  });

  it('masks the money values and the journal text with the eye and keeps it after reload', async () => {
    const { unmount } = await renderScreen();
    const money = await ready('Dinheiro');
    const journal = await ready('Diário');
    expect(within(journal).getByText('Hoje foi um dia calmo.')).toBeInTheDocument();
    await userEvent.click(
      within(money).getByRole('button', { name: 'Esconder as informações de Dinheiro' }),
    );
    await userEvent.click(
      within(journal).getByRole('button', { name: 'Esconder as informações de Diário' }),
    );
    expect(money.textContent).not.toMatch(/\d\.\d{3}/);
    expect(money.textContent).toContain('R$ •••••');
    expect(within(journal).queryByText('Hoje foi um dia calmo.')).not.toBeInTheDocument();
    expect(within(journal).queryByText('Calma')).not.toBeInTheDocument();
    expect(
      within(journal).getByText('Entrada oculta. Use o olho para mostrar.'),
    ).toBeInTheDocument();
    expect(within(journal).getByRole('link', { name: 'Abrir entrada' })).toHaveAttribute(
      'href',
      '/journal/j1',
    );
    expect(localStorage.getItem(`${MASKED_BLOCKS_KEY}.u1`)).toContain('balance');

    unmount();
    await renderScreen();
    const again = await ready('Dinheiro');
    expect(again.textContent).toContain('R$ •••••');
    expect(
      within(again).getByRole('button', { name: 'Mostrar as informações de Dinheiro' }),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows each block empty, loading and error on its own', async () => {
    await renderScreen({
      'GET /books': () => ({ items: [] }),
      'GET /journal-entries': () => new Promise(() => undefined),
      'GET /transactions': () => problem(500, 'generic'),
    });
    const reading = await ready('Leituras');
    expect(within(reading).getByText('Nenhuma leitura em andamento.')).toBeInTheDocument();
    const journal = await screen.findByRole('region', { name: 'Diário' });
    expect(within(journal).getByRole('status')).toHaveAttribute('aria-busy', 'true');
    const upcoming = await screen.findByRole('region', { name: 'Próximos dias' });
    expect(
      await within(upcoming).findByRole('button', { name: 'Tentar de novo' }),
    ).toBeInTheDocument();
    // Os outros blocos seguem de pé.
    expect(
      await within(await ready('Lembretes de hoje')).findByText('Remédio'),
    ).toBeInTheDocument();
  });

  it('keeps a block hidden in settings hidden after reload', async () => {
    localStorage.setItem(`${HIDDEN_BLOCKS_KEY}.u1`, JSON.stringify(['balance', 'reading']));
    const { api, unmount } = await renderScreen();
    await ready('Diário');
    expect(screen.queryByRole('region', { name: 'Dinheiro' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Leituras' })).not.toBeInTheDocument();
    expect(api.to('GET', '/financial-summaries')).toHaveLength(0);
    expect(api.to('GET', '/books')).toHaveLength(0);
    unmount();
    await renderScreen();
    await ready('Diário');
    expect(screen.queryByRole('region', { name: 'Dinheiro' })).not.toBeInTheDocument();
  });

  it('shows the all hidden state with the link to the dashboard settings', async () => {
    localStorage.setItem(
      `${HIDDEN_BLOCKS_KEY}.u1`,
      JSON.stringify(['today', 'reminders', 'upcoming', 'journal', 'balance', 'reading']),
    );
    await renderScreen();
    expect(await screen.findByText('Todos os blocos estão ocultos')).toBeInTheDocument();
    expect(screen.getByText('Escolha os blocos em Configurações › Dashboard.')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Abrir as configurações do dashboard' }),
    ).toHaveAttribute('href', '/settings/dashboard');
  });

  it('navigates every block and control by keyboard', async () => {
    await renderScreen();
    await ready('Tarefas de hoje');
    await ready('Dinheiro');
    const expected = [
      'Concluir: Pagar o IPTU',
      'Esconder as informações de Diário',
      'Esconder as informações de Dinheiro',
      'Escrever no diário',
      'Saldo por conta',
      'Dom Casmurro',
    ];
    const focused = new Set<string>();
    for (let step = 0; step < 80 && !expected.every((name) => focused.has(name)); step += 1) {
      await userEvent.tab();
      const active = document.activeElement;
      if (active instanceof HTMLElement) {
        focused.add(active.getAttribute('aria-label') ?? active.textContent);
      }
    }
    for (const name of expected) expect(focused).toContain(name);
  }, 60_000);

  it('has no axe violations', async () => {
    const { container } = await renderScreen();
    await ready('Tarefas de hoje');
    await ready('Dinheiro');
    await ready('Leituras');
    expect(await axe(container)).toHaveNoViolations();
  });
});
