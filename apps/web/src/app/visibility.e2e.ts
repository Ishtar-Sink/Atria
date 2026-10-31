import { expect, test } from '@playwright/test';
import { ENTITY_ROUTES } from './entity-types';
import {
  api,
  createSampleEntities,
  expectNoAxeViolations,
  recordCard,
  signIn,
} from './e2e-session';

// CT-15 e DEC-006: a visibilidade muda pelo formulário, aparece no cartão "Registro" e um
// item compartilhado continua fora do alcance de outra pessoa sem acesso (404).

test('CT-15 marcação compartilhada fica gravada e outro usuário recebe 404', async ({
  page: alice,
  browser,
}, info) => {
  await signIn(alice);
  const goal = await api<{ id: string }>(alice, 'POST', '/goals', { title: 'Meta compartilhada' });
  await alice.goto(`/goals/${goal.id}`);
  await alice.getByRole('link', { name: 'Editar', exact: true }).click();
  await alice
    .getByRole('radiogroup', { name: 'Visibilidade' })
    .getByRole('radio', { name: 'Compartilhada' })
    .check();
  await alice.getByRole('button', { name: /^Salvar/ }).click();
  await expect(alice).toHaveURL(new RegExp(`/goals/${goal.id}(\\?.*)?$`));
  await expect(recordCard(alice)).toContainText('Compartilhada');
  await alice.reload();
  await expect(recordCard(alice)).toContainText('Compartilhada');
  await expectNoAxeViolations(alice);

  // Bob numa sessão própria do navegador, sem os cookies de Alice.
  const context = await browser.newContext({ ...info.project.use });
  const bob = await context.newPage();
  await signIn(bob);
  const response = await bob.request.get(`/api/v1/goals/${goal.id}`);
  expect(response.status()).toBe(404);
  await bob.goto(`/goals/${goal.id}`);
  await expect(bob.getByRole('heading', { name: /não encontrad/i })).toBeVisible();
  await context.close();
});

test('DEC-006 toda tela de entidade mostra a visibilidade no Registro e a muda pelo formulário', async ({
  page,
}) => {
  await signIn(page);
  const samples = await createSampleEntities(page);
  const wrapped = new Set<string>(
    ENTITY_ROUTES.filter((entry) => entry.layout !== 'none').map((entry) => entry.path),
  );
  for (const sample of samples.filter((item) => wrapped.has(item.path))) {
    await page.goto(sample.url);
    const tabs = page.getByRole('tablist').first();
    await expect(tabs, sample.url).toBeVisible();
    const above = await page
      .getByRole('radiogroup', { name: 'Visibilidade' })
      .evaluateAll(
        (nodes, list) =>
          nodes.filter(
            (node) => node.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING,
          ).length,
        await tabs.elementHandle(),
      );
    expect(above, sample.url).toBe(0);
    await expect(recordCard(page), sample.url).toContainText(/Visibilidade:?\s*Pessoal/);
    await page.goto(sample.edit_url);
    await expect(
      page.getByRole('radiogroup', { name: 'Visibilidade' }),
      sample.edit_url,
    ).toBeVisible();
  }
});
