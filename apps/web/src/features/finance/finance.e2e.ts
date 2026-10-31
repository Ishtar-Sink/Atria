import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import type { Schemas } from '@atria/contracts';
import { api, signIn } from '../../app/e2e-session';

// Fluxos de CT-17 a CT-22, da ocorrência aberta e do período global. Rodam na TASK-35, com as
// rotas de `createFinanceRoutes` já registradas no app, em 360 px e em desktop (projetos do
// `playwright.config.ts`), contra um servidor com a conta padrão já criada.

// Único entre as larguras que rodam juntas com a mesma pessoa (o milissegundo sozinho repetia).
const SUFFIX = () => `${String(Date.now())}-${crypto.randomUUID().slice(0, 8)}`;

async function checkPage(page: Page) {
  const scan = await new AxeBuilder({ page }).analyze();
  expect(scan.violations).toEqual([]);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflow).toBe(false);
}

/**
 * Escolhe pelo teclado (setas até a opção e Enter): o seletor fecha quando a página rola, e o
 * clique do Playwright rola até a opção antes de clicar (em 360 px a lista pode abrir sob o
 * cabeçalho fixo). A busca por digitação não serve: o espaço do nome escolhe a opção ativa.
 */
async function choose(page: Page, label: string, option: string) {
  await page.getByLabel(label, { exact: true }).click();
  const list = page.getByRole('listbox');
  await expect(list.getByRole('option', { name: option, exact: true })).toBeAttached();
  const total = await list.getByRole('option').count();
  await page.keyboard.press('Home');
  for (let index = 0; index < total; index += 1) {
    const active = await list.getAttribute('aria-activedescendant');
    const text = await page.locator(`[id="${active ?? ''}"]`).textContent();
    if (text?.trim() === option) break;
    await page.keyboard.press('ArrowDown');
  }
  await page.keyboard.press('Enter');
  await expect(list).toHaveCount(0);
  await expect(page.getByLabel(label, { exact: true })).toContainText(option);
}

async function createAccount(page: Page, name: string, card = false) {
  await page.goto('/finance/accounts/new');
  await page.getByRole('textbox', { name: 'Nome' }).fill(name);
  if (card) {
    await page.getByRole('radio', { name: 'Cartão de crédito' }).check();
    await page.getByRole('textbox', { name: /^Limite/ }).fill('5.000,00');
    await page.getByRole('textbox', { name: 'Dia de fechamento' }).fill('3');
    await page.getByRole('textbox', { name: 'Dia de vencimento' }).fill('10');
  }
  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
}

/**
 * Liquida a movimentação aberta. O resultado aparece na hora (otimista); espera a resposta, porque
 * o `goto` seguinte recarrega a página e cancelaria a liquidação ainda em andamento.
 */
async function settle(page: Page, amount: string) {
  await page.getByRole('textbox', { name: /^Valor efetivo/ }).fill(amount);
  const settled = page.waitForResponse(
    (response) => response.request().method() === 'POST' && response.url().endsWith('/settlement'),
  );
  await page.getByRole('button', { name: 'Liquidar' }).click();
  expect((await settled).ok()).toBe(true);
}

async function createExpense(page: Page, description: string, account: string, amount: string) {
  await page.goto('/finance/transactions/new?kind=expense');
  await page.getByRole('textbox', { name: 'Descrição' }).fill(description);
  await choose(page, 'Conta', account);
  await page.getByRole('textbox', { name: /^Valor previsto/ }).fill(amount);
  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByRole('heading', { level: 1, name: description })).toBeVisible();
}

/**
 * O saldo da conta na lista. A lista é recarregada até refletir a última mudança: com várias
 * larguras gravando ao mesmo tempo, a resposta da liquidação pode chegar antes do saldo novo.
 */
async function expectBalance(page: Page, account: string, amount: string) {
  await expect(async () => {
    await page.goto('/finance/accounts');
    const row = page.getByRole('listitem').filter({ hasText: account });
    await expect(row.locator('span').last()).toContainText(amount, { timeout: 2_000 });
  }).toPass({ timeout: 15_000 });
}

test('default account cannot be deleted', async ({ page }) => {
  await page.goto('/finance/accounts');
  await page.getByRole('link', { name: 'Conta principal' }).click();
  await expect(
    page.getByText('A conta principal não pode ser excluída. Você pode renomeá-la em Editar.'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Mais ações' }).click();
  await expect(page.getByRole('menuitem', { name: 'Excluir' })).toHaveCount(0);
  await checkPage(page);
});

test('settlement updates balance with saving and loss', async ({ page }) => {
  const account = `Conta liquidação ${SUFFIX()}`;
  await createAccount(page, account);
  await createExpense(page, 'Feira', account, '100,00');
  await settle(page, '80,00');
  await expect(page.getByText('Economizou R$ 20,00')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Desfazer liquidação' })).toBeVisible();

  await createExpense(page, 'Luz', account, '100,00');
  await settle(page, '120,00');
  await expect(page.getByText('Pagou R$ 20,00 a mais')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Desfazer liquidação' })).toBeVisible();

  await expectBalance(page, account, '200,00');
  await checkPage(page);
});

test('installments fall in the right statements and payment settles them', async ({ page }) => {
  const card = `Cartão ${SUFFIX()}`;
  await createAccount(page, card, true);
  await page.goto('/finance/transactions/new?kind=expense');
  await page.getByRole('textbox', { name: 'Descrição' }).fill('Geladeira');
  await choose(page, 'Conta', card);
  await page.getByRole('textbox', { name: /^Valor previsto/ }).fill('300,00');
  await page.getByRole('textbox', { name: 'Parcelas' }).fill('3');
  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect(
    page.getByRole('heading', { name: 'Compra registrada em 3 parcelas' }),
  ).toBeVisible();

  // O formulário fica com o resumo das parcelas; a aba Faturas está nas telas de lista.
  await page.goto('/finance/statements');
  await choose(page, 'Cartão', card);
  await expect(page.getByText('parcela 1 de 3')).toBeVisible();
  await page.getByRole('button', { name: 'Pagar fatura' }).click();
  await page.getByRole('button', { name: 'Pagar' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Pagar' }).click();
  await expect(page.getByText('Paga').first()).toBeVisible();
  await checkPage(page);
});

test('transfer does not count in totals', async ({ page }) => {
  // O fechamento soma tudo da pessoa: com a sessão compartilhada, os outros testes mudariam os
  // totais no meio. Este teste entra com uma pessoa só dele.
  await signIn(page, 'user');
  const from = `Origem ${SUFFIX()}`;
  const to = `Destino ${SUFFIX()}`;
  await createAccount(page, from);
  await createAccount(page, to);
  await page.goto('/finance');
  const closing = page.getByRole('region', { name: /^Fechamento/ });
  const before = await closing.textContent();

  await page.goto('/finance/transfers/new');
  await choose(page, 'Conta de origem', from);
  await choose(page, 'Conta de destino', to);
  await page.getByRole('textbox', { name: /^Valor/ }).fill('50,00');
  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByRole('heading', { level: 1, name: `${from} → ${to}` })).toBeVisible();

  await page.goto('/finance');
  await expect(page.getByRole('region', { name: /^Fechamento/ })).toHaveText(before ?? '');
  await page.goto('/finance/transfers');
  await expect(page.getByRole('link', { name: `${from} → ${to}` })).toBeVisible();
  await checkPage(page);
});

test('monthly rent on day 31 falls on the last day', async ({ page }) => {
  const account = `Conta aluguel ${SUFFIX()}`;
  await createAccount(page, account);
  await page.goto('/finance/transactions/new?kind=expense');
  await page.getByRole('textbox', { name: 'Descrição' }).fill('Aluguel');
  await choose(page, 'Conta', account);
  await page.getByRole('textbox', { name: /^Valor previsto/ }).fill('2.000,00');
  await page.getByRole('checkbox', { name: 'Repetir' }).check();
  await choose(page, 'Frequência', 'Mensal');
  await choose(page, 'Dia do mês', '31');
  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Aluguel' })).toBeVisible();
  await expect(page.getByText('Todo mês no dia 31').first()).toBeVisible();
  await page.goto('/finance/expenses?period=next_30_days&repetition=recurring');
  await expect(page.getByRole('link', { name: 'Aluguel' }).first()).toBeVisible();
  await checkPage(page);
});

test('recurring occurrence stays overdue until settled or skipped', async ({ page }) => {
  // A recorrência começa há 5 dias: a ocorrência aberta já está atrasada (preparada pela API).
  const description = `Academia ${SUFFIX()}`;
  const accounts = await api<Schemas['AccountPage']>(page, 'GET', '/accounts');
  const account = accounts.items[0];
  if (!account) throw new Error('pessoa sem conta padrão');
  const startsOn = new Date(Date.now() - 5 * 86_400_000).toISOString().slice(0, 10);
  await api(page, 'POST', '/recurring-transactions', {
    account_id: account.id,
    kind: 'expense',
    description,
    expected_amount: 9_000,
    rule: {
      frequency: 'daily',
      interval: 1,
      starts_on: startsOn,
      time: '08:00',
      timezone: 'America/Sao_Paulo',
    },
  });
  await page.goto('/finance/expenses?period=all&repetition=recurring');
  const overdue = page
    .getByRole('listitem')
    .filter({ hasText: description })
    .filter({ hasText: 'Atrasada' });
  await overdue.getByRole('link', { name: description }).click();
  await expect(page.getByText('Atrasada')).toBeVisible();
  await page.getByRole('button', { name: 'Pular esta ocorrência' }).click();
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Pular esta ocorrência' })
    .click();
  await expect(page.getByText('Ocorrência pulada.')).toBeVisible();
  await page.getByRole('button', { name: 'Liquidar' }).click();
  await expect(page.getByText(/^Liquidada\./)).toBeVisible();
  await checkPage(page);
});

test('global period follows the tabs and any period shows everything', async ({ page }) => {
  await page.goto('/finance/expenses');
  await page.getByRole('button', { name: /Período/ }).click();
  await page.getByRole('button', { name: 'Mês passado' }).click();
  await expect(page).toHaveURL(/period=last_month/);
  await page.getByRole('link', { name: 'Entradas' }).click();
  await expect(page).toHaveURL(/\/finance\/income\?period=last_month/);
  await page.getByRole('link', { name: 'Contas' }).click();
  await expect(page.getByRole('button', { name: /Período/ })).toHaveCount(0);
  await page.goto('/finance/expenses?period=all');
  await expect(page.getByRole('region', { name: 'Saídas' })).toBeVisible();
  await checkPage(page);
});

test('finance panel matches the transactions', async ({ page }) => {
  const account = `Conta painel ${SUFFIX()}`;
  await createAccount(page, account);
  await createExpense(page, 'Padaria', account, '30,00');
  await page.getByRole('button', { name: 'Liquidar' }).click();
  await page.goto('/finance');
  await expect(page.getByRole('region', { name: /^Fechamento/ })).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Saldo' }).getByRole('link', { name: account }),
  ).toBeVisible();
  await expect(page.getByRole('table', { name: 'Saídas por categoria' })).toBeAttached();
  await checkPage(page);
});

test('undoing a settlement restores the balance', async ({ page }) => {
  const account = `Conta desfazer ${SUFFIX()}`;
  await createAccount(page, account);
  await createExpense(page, 'Mercado', account, '50,00');
  await page.getByRole('button', { name: 'Liquidar' }).click();
  await expect(page.getByRole('button', { name: 'Desfazer liquidação' })).toBeVisible();
  await expectBalance(page, account, '50,00');
  await page.goBack();
  await page.getByRole('button', { name: 'Desfazer liquidação' }).click();
  await expect(page.getByText('Liquidação desfeita.')).toBeVisible();
  await expectBalance(page, account, 'R$ 0,00');
  await checkPage(page);
});
