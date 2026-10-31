import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';
import type { Schemas } from '@atria/contracts';
import type { LinkableType } from '../features/connections/entity-categories';
import type { EntityRoutePath } from './entity-types';

// Utilitários dos e2e do app (TASK-35). A TASK-19 não exporta um; a sessão vem da entrada
// `/__test__/sign-in` do preview `--mode e2e`, e os dados de exemplo, da API.

export type TestRole = 'user' | 'elevated' | 'admin';

export async function signIn(page: Page, role: TestRole = 'user', seed?: string): Promise<void> {
  const query = new URLSearchParams({ role, ...(seed ? { seed } : {}) });
  await page.goto(`/__test__/sign-in?${query.toString()}`);
  // Até 720 px a sidebar é uma gaveta fechada: o sinal de sessão aberta é o título da tela.
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
}

export async function setTheme(page: Page, theme: 'light' | 'dark'): Promise<void> {
  await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
  await page.evaluate((value) => {
    document.documentElement.dataset['theme'] = value;
  }, theme);
}

export async function expectNoAxeViolations(page: Page): Promise<void> {
  // Os dias de fora do mês seguem o tom apagado do protótipo (DEC-010), como nas evidências.
  const results = await new AxeBuilder({ page }).exclude('[data-outside]').analyze();
  expect(results.violations).toEqual([]);
}

export async function expectNoHorizontalScroll(page: Page): Promise<void> {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

async function csrfHeader(page: Page): Promise<Record<string, string>> {
  const cookies = await page.context().cookies();
  const token = cookies.find((cookie) => cookie.name === 'atria_csrf')?.value;
  return token ? { 'X-CSRF-Token': token } : {};
}

/** Chamada da API com a sessão da página, para preparar dados sem passar pelas telas. */
export async function api<T>(page: Page, method: string, path: string, body?: unknown): Promise<T> {
  const headers = {
    ...(method === 'GET' ? {} : await csrfHeader(page)),
    ...(path === '/transactions' ? { 'Idempotency-Key': crypto.randomUUID() } : {}),
  };
  const response = await page.request.fetch(`/api/v1${path}`, {
    method,
    headers,
    ...(body === undefined ? {} : { data: body }),
  });
  if (!response.ok()) {
    throw new Error(`${method} ${path}: ${String(response.status())} ${await response.text()}`);
  }
  return response.status() === 204 ? (undefined as T) : ((await response.json()) as T);
}

/** Cartão "Registro" da visão geral; no projeto, o cartão "Sobre", como no protótipo. */
export function recordCard(page: Page) {
  return page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: /^(Registro|Sobre)$/ }) });
}

export interface SampleEntity {
  path: EntityRoutePath;
  entity_type: LinkableType;
  id: string;
  /** URL da tela de detalhe. */
  url: string;
  /** URL do formulário de edição. */
  edit_url: string;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Uma entidade de cada tela de `ENTITY_ROUTES`, criada para a pessoa da página. */
export async function createSampleEntities(page: Page): Promise<SampleEntity[]> {
  const suffix = String(Date.now());
  const accounts = await api<Schemas['AccountPage']>(page, 'GET', '/accounts');
  const account = accounts.items[0];
  if (!account) throw new Error('pessoa sem conta padrão');
  const created = await api<Schemas['CreatedTransactions']>(page, 'POST', '/transactions', {
    account_id: account.id,
    kind: 'expense',
    description: `Mercado ${suffix}`,
    expected_amount: 12_000,
    expected_date: today(),
  });
  const transaction = created.items[0];
  if (!transaction) throw new Error('movimentação não criada');
  const create = (path: string, body: unknown) => api<{ id: string }>(page, 'POST', path, body);
  const goal = await create('/goals', { title: `Meta ${suffix}` });
  const task = await create('/tasks', { title: `Tarefa ${suffix}`, due_on: today() });
  const reminder = await create('/reminders', {
    title: `Lembrete ${suffix}`,
    remind_at: new Date(Date.now() + 86_400_000).toISOString(),
    timezone: 'America/Sao_Paulo',
  });
  const note = await create('/notes', { title: `Nota ${suffix}`, body: 'Texto da nota.' });
  const entry = await create('/journal-entries', {
    text: `Entrada ${suffix}`,
    occurred_at: new Date().toISOString(),
    emotions: [],
  });
  const book = await create('/books', { title: `Livro ${suffix}`, page_count: 200 });
  const article = await create('/articles', { title: `Artigo ${suffix}` });
  const video = await create('/videos', { url: `https://example.com/video-${suffix}` });
  const project = await create('/projects', { name: `Projeto ${suffix}` });
  const lanes = await api<{ items: { id: string }[] }>(
    page,
    'GET',
    `/projects/${project.id}/lanes`,
  );
  const lane = lanes.items[0];
  if (!lane) throw new Error('projeto sem raias');
  const card = await create(`/projects/${project.id}/cards`, {
    lane_id: lane.id,
    title: `Cartão ${suffix}`,
  });
  const entity = (
    path: EntityRoutePath,
    entity_type: LinkableType,
    id: string,
    url: string,
    edit_url = `${url}/edit`,
  ): SampleEntity => ({ path, entity_type, id, url, edit_url });
  return [
    entity(
      '/finance/accounts/$accountId',
      'account',
      account.id,
      `/finance/accounts/${account.id}`,
    ),
    entity(
      '/finance/transactions/$transactionId',
      'transaction',
      transaction.id,
      `/finance/transactions/${transaction.id}`,
    ),
    entity('/goals/$goalId', 'goal', goal.id, `/goals/${goal.id}`),
    entity('/tasks/$taskId', 'task', task.id, `/tasks/${task.id}`),
    entity('/reminders/$reminderId', 'reminder', reminder.id, `/reminders/${reminder.id}`),
    entity('/notes/$noteId', 'note', note.id, `/notes/${note.id}`),
    entity('/journal/$entryId', 'journal_entry', entry.id, `/journal/${entry.id}`),
    entity('/library/books/$bookId', 'book', book.id, `/library/books/${book.id}`),
    entity(
      '/library/articles/$articleId',
      'article',
      article.id,
      `/library/articles/${article.id}`,
    ),
    entity('/library/videos/$videoId', 'video', video.id, `/library/videos/${video.id}`),
    entity('/projects/$projectId', 'project', project.id, `/projects/${project.id}`),
    entity(
      '/projects/$projectId/cards/$cardId',
      'project_card',
      card.id,
      `/projects/${project.id}/cards/${card.id}`,
      `/projects/${project.id}/cards/${card.id}`,
    ),
  ];
}

/** Liga a entidade de origem a cada uma das outras pela API de ligações. */
export async function linkAll(page: Page, source: SampleEntity, targets: SampleEntity[]) {
  for (const target of targets) {
    await api(page, 'POST', '/links', {
      source_type: source.entity_type,
      source_id: source.id,
      target_type: target.entity_type,
      target_id: target.id,
    });
  }
}
