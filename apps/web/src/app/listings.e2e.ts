import { expect, test } from '@playwright/test';
import { expectNoAxeViolations, expectNoHorizontalScroll, signIn } from './e2e-session';

// CT-14: em toda listagem, filtros, busca e visualização ficam na URL e voltam depois de
// recarregar ([project/frontend-12], [project/frontend-13]).

const LISTINGS = [
  { module: 'Metas', path: '/goals' },
  { module: 'Tarefas', path: '/tasks' },
  { module: 'Lembretes', path: '/reminders' },
  { module: 'Notas', path: '/notes' },
  { module: 'Diário', path: '/journal' },
  { module: 'Acervo', path: '/library' },
  { module: 'Projetos', path: '/projects' },
  { module: 'Financeiro (saídas)', path: '/finance/expenses' },
  { module: 'Financeiro (contas)', path: '/finance/accounts' },
];

for (const listing of LISTINGS) {
  test(`CT-14 ${listing.module}: filtro, busca e visualizações ficam na URL`, async ({ page }) => {
    await signIn(page);
    await page.goto(listing.path);
    await expect(
      page
        .getByRole('group', { name: 'Filtros' })
        .or(page.getByRole('region', { name: 'Filtros' }))
        .first(),
    ).toBeVisible();

    const search = page.getByRole('searchbox').first();
    await search.fill('zz-busca');
    await expect(page).toHaveURL(/[?&]q=zz-busca/);

    const views = page
      .getByRole('radiogroup', { name: 'Visualização' })
      .or(page.getByRole('group', { name: 'Visualização' }))
      .first();
    await expect(views).toBeVisible();
    const other = views.locator('[aria-checked="false"], [aria-pressed="false"]').first();
    await other.click();
    await expect(page).toHaveURL(/[?&]view=/);
    const url = page.url();

    await page.reload();
    expect(page.url()).toBe(url);
    await expect(page.getByRole('searchbox').first()).toHaveValue('zz-busca');
    await expectNoHorizontalScroll(page);
    await expectNoAxeViolations(page);
  });
}
