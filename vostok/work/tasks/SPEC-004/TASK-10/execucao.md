### Ler

- `docs/estudos/financeiro-descontos.md`: a recomendação do estudo (TASK-01). É o 1º passo: se divergir desta tarefa, pare (passo 1).
- `vostok/work/specs/refined/SPEC-004-descontos-nas-entradas-e-saidas-do-financeiro.md`: RF-08, RF-09, CT-03, CT-05, FA-02, RNF-04 e RNF-05.
- `vostok/work/tasks/SPEC-004/TASK-07/execucao.md`, `vostok/work/tasks/SPEC-004/TASK-08/execucao.md` e `vostok/work/tasks/SPEC-004/TASK-09/execucao.md`: os textos da tela (passos de i18n), as fns `adjustedWorld`, `adjustmentsOverride` e `panelAdjustmentsWorld` e a constante `PANEL_ADJUSTMENTS` do script de evidências.
- `apps/web/src/features/finance/finance.e2e.ts` (inteiro: fns `SUFFIX`, `checkPage`, `choose`, `createAccount`, `settle`, `expectBalance` e os testes `settlement updates balance with saving and loss` e `transfer does not count in totals`).
- `apps/web/src/app/e2e-session.ts` (fn `signIn`) e `apps/web/playwright.config.ts` (projetos `desktop-session` e `w360-session`, `webServer` com `reuseExistingServer`).
- `docker-compose.yml` e `docker-compose.e2e.yml`: a pilha dos e2e (servidor em `127.0.0.1:8080`).
- `apps/web/scripts/evidence-finance.mjs` (mais de 2.600 linhas: leia por trecho o comentário do topo, `CURSOR_MARKER`, `withVideo`, `recordChartsVideo` como molde, `mockApi`, `gotoHarness`, `tooltipText`, os cenários `descontos-form`, `descontos-liquidacao` e `descontos-painel`, `EVIDENCES` e a mensagem de uso).
- `vostok/rules/project/testing.md` ([project/testing-05], [project/testing-10]) e `vostok/memory/knowledge.md` (KNW-006 e KNW-007, por busca).

### Mudar

- `apps/web/src/features/finance/finance.e2e.ts` (alterar): o fluxo completo contra o servidor real, com axe e sem rolagem horizontal em desktop e em 360 px: entrada com descontos liquidada pelo líquido e saída com desconto e acréscimo (RF-08, RF-09, CT-05, FA-02, RNF-04, RNF-05).
- `apps/web/scripts/evidence-finance.mjs` (alterar): modo `descontos-video`, com o vídeo do fluxo completo (formulário, prévia da liquidação e cartão do painel).

### Passos

1. `docs/estudos/financeiro-descontos.md` (ler): confira que a recomendação não mudou o que as TASK-07 a TASK-09 entregaram (liquidação pelo líquido com prévia do servidor, base digitada proporcional, cartão por nome). Se divergir, **PARE** e peça o ajuste desta tarefa (skill `adjust-task`). Confira que as TASK-07, TASK-08 e TASK-09 estão concluídas: `node apps/web/scripts/evidence-finance.mjs descontos-nada` termina com uma mensagem que lista `descontos-form`, `descontos-liquidacao` e `descontos-painel`; se faltar algum, **PARE**.
2. Pilha dos e2e (antes do baseline): rode `curl -fsS -m 5 http://127.0.0.1:8080/healthz`. Se responder, use a pilha que já está de pé e não a derrube no fim. Se não responder, confira que nenhum `cargo` nem `docker build` do servidor está rodando (KNW-007) e rode, da raiz do projeto, `docker compose -f docker-compose.yml -f docker-compose.e2e.yml up -d --build`; anote que foi você quem subiu. Espere `curl -fsS http://127.0.0.1:8080/healthz` responder. Rode `curl -s -o /dev/null -w '%{http_code}' -m 5 http://localhost:4173`: tem de dar `000` (nenhuma prévia antiga, que o Playwright reaproveitaria); se der outro código, **PARE** e peça ao usuário para encerrar o processo da porta 4173.
3. `apps/web/src/features/finance/finance.e2e.ts` (alterar): logo depois da fn `expectBalance`, acrescente:
   ```ts
   interface AdjustmentStep {
     name: string;
     rate?: string;
     amount?: string;
     base?: string;
     addition?: boolean;
   }

   /** Adiciona um item pelo editor: percentual (`rate`, com `base` opcional) ou valor fixo (`amount`). */
   async function addAdjustment(page: Page, position: number, step: AdjustmentStep) {
     await page.getByRole('button', { name: 'Adicionar desconto ou acréscimo' }).click();
     const item = page.getByRole('group', { name: `Item ${String(position)}`, exact: true });
     await item.getByRole('textbox', { name: 'Nome do item' }).fill(step.name);
     if (step.addition) await item.locator('label').filter({ hasText: /^Acréscimo$/ }).click();
     if (step.amount !== undefined) {
       await item.locator('label').filter({ hasText: /^Valor fixo$/ }).click();
       await item.getByRole('textbox', { name: /^Valor do item/ }).fill(step.amount);
       return;
     }
     await item.getByRole('textbox', { name: 'Percentual (%)' }).fill(step.rate ?? '');
     if (step.base !== undefined) {
       await item.getByText('Base diferente do bruto', { exact: true }).click();
       await item.getByRole('textbox', { name: /^Base de cálculo/ }).fill(step.base);
     }
   }

   /** O líquido previsto anunciado pelo editor do formulário. */
   function expectedNet(page: Page) {
     return page.getByRole('group', { name: 'Descontos e acréscimos' }).getByRole('status');
   }

   /** Clica em "Liquidar" e espera a resposta, como `settle`, sem trocar o valor efetivo. */
   async function settleNow(page: Page) {
     const settled = page.waitForResponse(
       (response) => response.request().method() === 'POST' && response.url().endsWith('/settlement'),
     );
     await page.getByRole('button', { name: 'Liquidar' }).click();
     expect((await settled).ok()).toBe(true);
   }
   ```
4. `apps/web/src/features/finance/finance.e2e.ts` (alterar): no fim do arquivo, acrescente o teste do CT-05 (os números são os casos ct02 e ct05 da tabela comum; confira que batem com os testes `ct02_` e `ct05_` de `apps/server/src/finance/domain/adjustment.rs` e, se não baterem, **PARE**):
   ```ts
   test('ct05 settles an income with deductions by the net and the balance gets the net', async ({
     page,
   }) => {
     // O cartão do painel soma tudo da pessoa: este teste entra com uma pessoa só dele.
     await signIn(page, 'user');
     const account = `Conta salário ${SUFFIX()}`;
     await createAccount(page, account);
     await page.goto('/finance/transactions/new?kind=income');
     await page.getByRole('textbox', { name: 'Descrição' }).fill('Salário');
     await choose(page, 'Conta', account);
     await page.getByRole('textbox', { name: /^Valor previsto/ }).fill('8.000,00');
     await addAdjustment(page, 1, { name: 'INSS', rate: '11' });
     await addAdjustment(page, 2, { name: 'IRPF', rate: '15', base: '7.120,00' });
     await expect(expectedNet(page)).toHaveText(/Líquido previsto: R\$\s6\.052,00/);
     await checkPage(page);
     await page.getByRole('button', { name: 'Salvar' }).click();
     await expect(page.getByRole('heading', { level: 1, name: 'Salário' })).toBeVisible();
     const adjustments = page.getByRole('region', { name: 'Descontos e acréscimos' });
     await expect(adjustments).toContainText('8.000,00');
     await expect(adjustments).toContainText('6.052,00');

     await page.getByRole('textbox', { name: /^Valor efetivo/ }).fill('6.500,00');
     const settlement = page.getByRole('region', { name: 'Liquidação' });
     await expect(settlement.getByRole('region', { name: 'Prévia da liquidação' })).toContainText(
       '8.592,20',
     );
     await expect(settlement).toContainText('7.647,06');
     await checkPage(page);
     await settleNow(page);
     await expect(adjustments).toContainText('Liquidado');
     await expect(adjustments).toContainText('8.592,20');
     await expect(page.getByText('Recebeu R$ 448,00 a mais')).toBeVisible();
     await checkPage(page);

     await expectBalance(page, account, '6.500,00');
     await page.goto('/finance');
     await expect(page.getByRole('region', { name: /^Fechamento/ })).toContainText('6.500,00');
     const card = page.getByRole('region', { name: 'Descontos do período' });
     await expect(card).toContainText('INSS');
     await expect(card).toContainText('945,14');
     await expect(card).toContainText('IRPF');
     await expect(card).toContainText('1.147,06');
     await checkPage(page);
   });
   ```
   e o teste do FA-02 (RF-08):
   ```ts
   test('fa02 an expense with discount and fee takes the net from the balance', async ({ page }) => {
     const account = `Conta desconto ${SUFFIX()}`;
     await createAccount(page, account);
     await page.goto('/finance/transactions/new?kind=expense');
     await page.getByRole('textbox', { name: 'Descrição' }).fill('Conta de luz');
     await choose(page, 'Conta', account);
     await page.getByRole('textbox', { name: /^Valor previsto/ }).fill('200,00');
     await addAdjustment(page, 1, { name: 'Desconto à vista', rate: '10' });
     await addAdjustment(page, 2, { name: 'Taxa', amount: '5,00', addition: true });
     await expect(expectedNet(page)).toHaveText(/Líquido previsto: R\$\s185,00/);
     await page.getByRole('button', { name: 'Salvar' }).click();
     await expect(page.getByRole('heading', { level: 1, name: 'Conta de luz' })).toBeVisible();
     await settleNow(page);
     await expect(page.getByText('Liquidada pelo valor previsto.')).toBeVisible();
     await expectBalance(page, account, '185,00');
     await checkPage(page);
   });
   ```
   Importe `signIn` junto de `api` de `../../app/e2e-session`. Confira: `pnpm --filter @atria/web exec playwright test --list src/features/finance/finance.e2e.ts --project=desktop-session` lista os dois testes novos.
5. Rode `pnpm --filter @atria/web exec playwright test src/features/finance/finance.e2e.ts --project=desktop-session --project=w360-session -g 'ct05 settles|fa02 an expense'` (o Playwright gera o build `e2e`, sobe a prévia na porta 4173 e a encerra no fim). Se falhar, abra o relatório em `apps/web/node_modules/.cache/atria-e2e/test-results` e corrija só o e2e (seletor ou espera); se a falha for da tela ou do servidor, **PARE** e informe o teste, a mensagem e o print do relatório.
6. `apps/web/scripts/evidence-finance.mjs` (alterar):
   - no comentário do topo, a linha "TASK-10 da SPEC-004 acrescenta descontos-video (finance-descontos.webm): o fluxo dos descontos do formulário ao painel.", e `descontos-video` na linha "Uso:" e na mensagem de evidência desconhecida;
   - a fn `recordAdjustmentsVideo(browser, base)`, logo depois de `recordChartsVideo`, com `withVideo(browser, 'finance-descontos.webm', async ({ page, context, pause, clickAt }) => { … })`:
     - estado `const state = adjustedWorld(); state.summary.adjustments_by_name = PANEL_ADJUSTMENTS;` e `mockApi(context, state, (call, s) => newSalary(call, s) ?? adjustmentsOverride(call, s))`, onde `newSalary` responde `POST /transactions` com uma cópia da `t20` de `id: 't30'`, a descrição do corpo, `status: 'open'` e sem os campos de liquidação, guardada em `s.transactions`, e `{ status: 201, body: { items: [criada] } }`; nos demais, `undefined`;
     - `gotoHarness(page, base, '/finance/transactions/new?kind=income')`; `pause(800)`; descrição "Salário de novembro" com `pressSequentially` (`delay: 60`); `clickAt` no campo "Conta" e na opção "Conta principal"; "Valor previsto (R$)" 8.000,00; `clickAt` em "Adicionar desconto ou acréscimo"; no grupo "Item 1", "Nome do item" INSS e "Percentual (%)" 11; de novo "Adicionar desconto ou acréscimo"; no "Item 2", IRPF, 15, `clickAt` em "Base diferente do bruto" e "Base de cálculo (R$)" 7.120,00; `pause(1200)`; `check('vídeo: líquido previsto ao vivo', …)` com o texto do `role="status"` do grupo "Descontos e acréscimos" casando `/R\$\s6\.052,00/`;
     - `clickAt` em "Salvar"; espere o `h1` "Salário de novembro"; centralize a região "Liquidação"; `pause(800)`; "Valor efetivo (R$)" 6.500,00 com `pressSequentially`; espere a seção "Prévia da liquidação" com "8.592,20"; `check('vídeo: prévia com o bruto recalculado', …)`; `clickAt` em "Editar descontos e acréscimos"; `pause(1500)`; `clickAt` de novo para fechar; `clickAt` em "Liquidar"; espere a região "Descontos e acréscimos" com "Liquidado"; centralize-a; `pause(1500)`; `check('vídeo: liquidado no detalhe', …)` com "8.592,20" na região;
     - `gotoHarness(page, base, '/finance')`; centralize a região "Descontos do período"; `pause(1800)`; `check('vídeo: cartão Descontos do período', …)` com "INSS" e "Juros" na região;
   - em `EVIDENCES`, `'descontos-video': async (browser, base) => { await recordAdjustmentsVideo(browser, base); }`.
   Confira: `node --check apps/web/scripts/evidence-finance.mjs`.
7. Rode o bloco de "Verificação" e corrija até passar. Depois rode `VOSTOK_EVIDENCE=$(mktemp -d) node apps/web/scripts/evidence-finance.mjs descontos-video`, corrija só o script a cada linha `FALHA` até a última linha ser `ok  0 falha(s)` e abra o vídeo para conferir o cursor, o líquido mudando, a prévia e o cartão do painel.
8. Se foi você quem subiu a pilha no passo 2, rode `docker compose -f docker-compose.yml -f docker-compose.e2e.yml stop` (KNW-006) e confira que `curl -fsS -m 5 http://127.0.0.1:8080/healthz` não responde mais. A finalização (skill `finish-task`) roda a "Verificação" de novo e precisa da pilha: suba-a com o mesmo comando do passo 2 antes e pare-a depois.
