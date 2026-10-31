import { screen, within } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { rootRoute } from '../../app/router';
import { renderWithProviders } from '../../shared/test/render';
import { REPORT_CATALOG } from './report-catalog';
import { createReportsRoutes } from './routes';

function renderList() {
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ id: 'u-1', email: 'a@b.c' }), {
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    ),
  );
  return renderWithProviders(null, { routes: createReportsRoutes(rootRoute), route: '/reports' });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ReportsListPage', () => {
  it('lists the nine reports grouped by module', async () => {
    renderList();
    await screen.findByRole('heading', { name: 'Relatórios', level: 1 });
    const groups: Record<string, string[]> = {
      Financeiro: ['Entradas e saídas', 'Gastos por categoria', 'Economias e perdas'],
      Acervo: ['Páginas lidas', 'Acervo por status'],
      Diário: ['Emoções do diário'],
      Metas: ['Progresso das metas'],
      Tarefas: ['Tarefas concluídas'],
      Projetos: ['Cartões por projeto'],
    };
    let total = 0;
    for (const [module, titles] of Object.entries(groups)) {
      const card = screen.getByRole('region', { name: module });
      const links = within(card).getAllByRole('link');
      expect(links.map((link) => link.textContent)).toEqual(titles);
      total += links.length;
    }
    expect(total).toBe(9);
    expect(screen.getByText('Enxergar')).toBeInTheDocument();
  });

  it('links each report to its page', async () => {
    renderList();
    for (const { id } of REPORT_CATALOG) {
      const card = (await screen.findAllByRole('link')).find(
        (link) => link.getAttribute('href') === `/reports/${id}`,
      );
      expect(card, id).toBeDefined();
    }
    expect(screen.getByRole('link', { name: 'Exportar meus dados' })).toHaveAttribute(
      'href',
      '/reports/exports',
    );
  });

  it('has no axe violations', async () => {
    const { container } = renderList();
    await screen.findByRole('heading', { name: 'Relatórios', level: 1 });
    expect(await axe(container)).toHaveNoViolations();
  });
});
