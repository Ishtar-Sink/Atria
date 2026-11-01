import { expect, test } from '@playwright/test';
import type { Schemas } from '@atria/contracts';
import { api, createSampleEntities, signIn } from '../../app/e2e-session';

// SPEC-002 CT-03: o Voltar de um detalhe leva à listagem de onde a pessoa veio.

test('Voltar leva à listagem de origem nas 10 listagens', async ({ browser }, info) => {
  test.skip(info.project.name !== 'desktop', 'a navegação não muda com a largura');
  // A evidência é um vídeo: um print mostraria só a tela final, sem a navegação.
  const video = process.env['ATRIA_E2E_VIDEO'];
  const context = await browser.newContext(
    video
      ? { recordVideo: { dir: info.outputPath('video'), size: { width: 1280, height: 800 } } }
      : {},
  );
  const page = await context.newPage();
  await signIn(page);
  const samples = await createSampleEntities(page);
  const urlOf = (type: string) => {
    const sample = samples.find((entry) => entry.entity_type === type);
    if (!sample) throw new Error(type);
    return sample.url;
  };

  const suffix = String(Date.now());
  const main = urlOf('account').split('/').pop();
  const reserve = await api<{ id: string }>(page, 'POST', '/accounts', {
    name: `Reserva ${suffix}`,
  });
  const transfer = await api<Schemas['TransferResponse']>(page, 'POST', '/transfers', {
    from_account_id: main,
    to_account_id: reserve.id,
    amount: 5_000,
    transferred_on: new Date().toISOString().slice(0, 10),
  });

  const pairs = [
    { list: '/finance/accounts', detail: urlOf('account') },
    { list: '/finance/expenses', detail: urlOf('transaction') },
    { list: '/finance/transfers', detail: `/finance/transfers/${transfer.id}` },
    { list: '/goals', detail: urlOf('goal') },
    { list: '/tasks', detail: urlOf('task') },
    { list: '/reminders', detail: urlOf('reminder') },
    { list: '/notes', detail: urlOf('note') },
    { list: '/journal', detail: urlOf('journal_entry') },
    { list: '/library', detail: urlOf('book') },
    { list: '/projects', detail: urlOf('project') },
  ];
  for (const { list, detail } of pairs) {
    await page.goto(list);
    await page.locator(`main a[href^="${detail}"]`).first().click();
    await expect(page).toHaveURL(new RegExp(`${detail}(\\?.*)?$`));
    await page.getByRole('link', { name: 'Voltar' }).click();
    await expect.poll(() => new URL(page.url()).pathname).toBe(list);
  }

  await page.goto('/notes?q=Nota');
  await page
    .locator(`main a[href^="${urlOf('note')}"]`)
    .first()
    .click();
  await expect(page).toHaveURL(new RegExp(`${urlOf('note')}$`));
  await page.getByRole('link', { name: 'Voltar' }).click();
  await expect(page).toHaveURL(/\/notes\?q=Nota/);

  await context.close();
  if (video) await page.video()?.saveAs(video);
});
