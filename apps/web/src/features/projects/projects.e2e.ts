import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';

// Fluxo ponta a ponta do CT-30. Roda na TASK-35, com o servidor e as rotas de Projetos registradas:
// lista e grade, projeto aberto na Visão geral com as raias padrão, raia nova com cor HEX em
// Configurações, reordenar pelo puxador, marcar uma raia como concluída e ver o Andamento mudar,
// cartão criado pelo "+ Adicionar cartão" com prazo, checklist em lista, com Enter e alça, e tarefa ligada, e movido pelo
// teclado (link do cartão em foco) e arrastando o cartão inteiro — em 360 px e em desktop, com o axe no fim.

const SIZES = [
  { name: '360', width: 360, height: 760 },
  { name: 'desktop', width: 1280, height: 800 },
];

async function signIn(page: Page) {
  await page.goto('/__test__/sign-in?role=user');
}

/** A tarefa a ligar ao cartão é criada pela API, como a TASK-24 a entrega. */
async function createTask(page: Page, title: string) {
  const cookies = await page.context().cookies();
  const csrf = cookies.find((cookie) => cookie.name === 'atria_csrf')?.value ?? '';
  const response = await page.request.post('/api/v1/tasks', {
    data: { title },
    headers: { 'X-CSRF-Token': csrf },
  });
  expect(response.ok()).toBe(true);
}

/**
 * Rola até o alvo e só clica depois que o cabeçalho fixo termina de compactar ou expandir (PD-20):
 * a rolagem do próprio Playwright dispara a transição, que desloca o alvo no meio do clique.
 */
async function clickSettled(page: Page, target: Locator) {
  await target.scrollIntoViewIfNeeded();
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            resolve();
          });
        });
      }),
  );
  await page.waitForFunction(() =>
    document
      .getAnimations()
      .every(
        (animation) => !(animation instanceof CSSTransition) || animation.playState !== 'running',
      ),
  );
  await target.click();
}

/** Abre a aba e espera a troca de endereço (`?tab=`) terminar antes do próximo passo. */
async function openTab(page: Page, name: string) {
  const tab = page.getByRole('tab', { name });
  await clickSettled(page, tab);
  await expect(tab).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tabpanel', { name })).toBeVisible();
}

async function expectNoAxeViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
}

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflow).toBe(false);
}

for (const size of SIZES) {
  test.describe(`projetos em ${size.name}`, () => {
    test.use({ viewport: { width: size.width, height: size.height } });

    test('project with colored lanes, a card with checklist and a linked task', async ({
      page,
    }) => {
      await signIn(page);
      await createTask(page, 'Pedir orçamento');

      // Criar o projeto e vê-lo em lista e em grade.
      await page.goto('/projects/new');
      await page.getByLabel('Nome').fill('Reforma da sala');
      await page.getByRole('button', { name: 'Salvar' }).click();
      await expect(page.getByRole('heading', { level: 1, name: 'Reforma da sala' })).toBeVisible();
      await page.goto('/projects');
      await expect(page.getByRole('link', { name: 'Reforma da sala' })).toBeVisible();
      await page
        .getByRole('group', { name: 'Visualização' })
        .getByRole('button', { name: 'Grade' })
        .click();
      await expect(page).toHaveURL(/view=grid/);
      await page.getByRole('link', { name: 'Reforma da sala' }).click();

      // A Visão geral é a primeira aba; o Quadro tem as três raias padrão.
      await expect(page.getByRole('tab', { name: 'Visão geral' })).toHaveAttribute(
        'aria-selected',
        'true',
      );
      await openTab(page, 'Quadro');
      for (const lane of ['Aguardando', 'Em progresso', 'Pronto']) {
        await expect(page.getByRole('heading', { level: 2, name: lane })).toBeVisible();
      }

      // Configurações › Raias: criar com cor HEX, reordenar pelo puxador e marcar como concluída.
      await openTab(page, 'Configurações');
      await page.getByRole('link', { name: 'Nova raia' }).click();
      await page.getByLabel('Nome').fill('Revisão');
      await page.getByRole('button', { name: /^Cor/ }).click();
      await page.getByRole('dialog', { name: 'Escolher cor' }).getByLabel('HEX').fill('#0ea5e9');
      await page.getByRole('button', { name: 'Aplicar' }).click();
      await page.getByRole('button', { name: 'Salvar' }).click();
      await expect(page.getByText('#0ea5e9')).toBeVisible();

      const handle = page.getByRole('button', { name: /^Reordenar a raia Revisão/ });
      await handle.focus();
      await page.keyboard.press('ArrowUp');
      await expect(
        page.getByRole('button', { name: /^Reordenar a raia Revisão, posição 3/ }),
      ).toBeVisible();

      // A raia muda pela mutação otimista, um instante depois do clique: `check()` exige a troca
      // síncrona, então clica e espera o estado marcado.
      const done = page.getByRole('checkbox', { name: 'Conta como concluída: Revisão' });
      await done.click();
      await expect(done).toBeChecked();
      await openTab(page, 'Visão geral');
      await expect(page.getByRole('heading', { name: 'Andamento', exact: true })).toBeVisible();

      // Cartão pelo "+ Adicionar cartão", com prazo, checklist e tarefa ligada.
      await openTab(page, 'Quadro');
      await clickSettled(
        page,
        page.getByRole('button', { name: 'Adicionar cartão em Aguardando' }),
      );
      await expect(page).toHaveURL(/\/cards\/new/);
      await page.getByLabel('Título').fill('Escolher o sofá');
      const novo = page.getByLabel('Novo item do checklist');
      await novo.fill('Comparar lojas');
      await novo.press('Enter');
      await novo.fill('Medir a sala');
      await novo.press('Enter');
      await page
        .getByRole('button', { name: 'Reordenar o item Medir a sala, posição 2 de 2' })
        .focus();
      await page.keyboard.press('ArrowUp');
      await page.getByRole('checkbox', { name: 'Feito: Medir a sala' }).check();
      await page.getByRole('button', { name: /Prazo/ }).click();
      await page.locator('[data-day$="-15"]').first().click();
      await page.getByLabel('Ligar a uma tarefa').click();
      await page.getByRole('option', { name: 'Pedir orçamento' }).click();
      await page.getByRole('button', { name: 'Salvar' }).click();
      await expect(page.getByRole('link', { name: 'Escolher o sofá' })).toBeVisible();
      await expect(page.getByText('1/2')).toBeVisible();

      // Mover pelo teclado: o link do cartão em foco e a seta para a direita.
      await page.getByRole('link', { name: 'Escolher o sofá' }).focus();
      await page.keyboard.press('ArrowRight');
      const doing = page
        .getByRole('heading', { level: 2, name: 'Em progresso' })
        .locator('xpath=ancestor::li[1]');
      await expect(doing.getByRole('link', { name: 'Escolher o sofá' })).toBeVisible();

      // Mover arrastando com o mouse, até o cabeçalho da raia "Pronto".
      const finished = page.getByRole('heading', { level: 2, name: 'Pronto' });
      await finished.scrollIntoViewIfNeeded();
      const title = page.getByRole('link', { name: 'Escolher o sofá' });
      await title.scrollIntoViewIfNeeded();
      await title.hover();
      await page.mouse.down();
      const head = await finished.boundingBox();
      if (!head) throw new Error('cabeçalho da raia Pronto fora da tela');
      await page.mouse.move(head.x + head.width / 2, head.y + head.height + 20, { steps: 12 });
      await page.mouse.up();
      const ready = finished.locator('xpath=ancestor::li[1]');
      await expect(ready.getByRole('link', { name: 'Escolher o sofá' })).toBeVisible();

      await expectNoHorizontalScroll(page);
      await expectNoAxeViolations(page);
    });
  });
}

test.describe('quadro por toque em 360', () => {
  test.use({
    viewport: { width: 360, height: 760 },
    hasTouch: true,
    isMobile: true,
  });

  test('rf34 moves a card between lanes by emulated touch', async ({ page }) => {
    await signIn(page);
    await page.goto('/projects/new');
    await page.getByLabel('Nome').fill('Reforma da cozinha');
    await page.getByRole('button', { name: 'Salvar' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Reforma da cozinha' })).toBeVisible();
    await openTab(page, 'Quadro');
    await clickSettled(page, page.getByRole('button', { name: 'Adicionar cartão em Aguardando' }));
    await page.getByLabel('Título').fill('Escolher a pia');
    await page.getByRole('button', { name: 'Salvar' }).click();

    const card = page.getByRole('link', { name: 'Escolher a pia' });
    await expect(card).toBeVisible();
    await expect(page.getByRole('combobox')).toHaveCount(0);
    const doing = page.getByRole('heading', { level: 2, name: 'Em progresso' });
    await doing.scrollIntoViewIfNeeded();
    await card.scrollIntoViewIfNeeded();

    const from = await card.boundingBox();
    const to = await doing.boundingBox();
    if (!from || !to) throw new Error('cartão ou raia fora da tela');
    const start = { x: from.x + from.width / 2, y: from.y + from.height / 2 };
    const end = { x: to.x + to.width / 2, y: to.y + to.height + 40 };
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [start] });
    await page.waitForTimeout(300);
    for (let step = 1; step <= 12; step += 1) {
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [
          {
            x: start.x + ((end.x - start.x) * step) / 12,
            y: start.y + ((end.y - start.y) * step) / 12,
          },
        ],
      });
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });

    const lane = doing.locator('xpath=ancestor::li[1]');
    await expect(lane.getByRole('link', { name: 'Escolher a pia' })).toBeVisible();
    await expect(page.getByRole('combobox')).toHaveCount(0);
  });
});
