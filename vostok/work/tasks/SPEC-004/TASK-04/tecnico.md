<!-- Escrito no planejamento com o que a tarefa vai fazer e enriquecido na conclusão com o que foi feito. -->

## Abordagem

A movimentação avulsa ganha o bruto e a lista de itens, previstos e liquidados, usando o cálculo da TASK-02 (`compute_net` e `gross_for_net` em `domain/adjustment.rs`). `expected_amount` continua sendo o valor que afeta o saldo e passa a ser o líquido calculado; por isso saldo, listagens, projeções e resumo usam o líquido sem mudar uma linha do resumo (RF-08, decisão 7).

- **Banco:** a migração `20261104010001_add-finance-adjustments.sql` acrescenta `gross_amount BIGINT`, `adjustments JSONB`, `settled_gross_amount BIGINT` e `settled_adjustments JSONB` em `transactions`, e `gross_amount` e `adjustments` em `recurring_transactions`. As linhas existentes recebem bruto igual ao líquido e lista vazia; as liquidadas, bruto liquidado igual ao liquidado (RNF-03, CB-06). `CHECK`s: bruto > 0, lista com até 20 itens, sem itens o bruto é o líquido (RN-09) e liquidação coerente.
- **Domínio:** `Transaction` ganha `gross_amount`, `adjustments` e `settled_adjustments`; `Settlement` ganha `gross_amount`. Funções novas em `transaction.rs`, reaproveitadas pela TASK-05 na recorrente: `PlannedAmounts`, `planned_from_gross`, `planned_amounts` (regras do pedido de criação), `edited_amounts` (regras da edição) e `definitions`. `settle_with` liquida pelo líquido com os itens previstos ou editados; `settle` mantém a assinatura e usa os previstos. `FinanceItem` ganha `adjustments()` e `settled_adjustments()`, que a TASK-06 usa no resumo; até lá, as duas funções têm `#[cfg_attr(not(test), allow(dead_code))]` marcado com `TODO(SPEC-004 TASK-06)`.
- **Infraestrutura:** `AdjustmentRow` é o formato JSON dos itens (as chaves do contrato, com `computed_amount`), convertido de e para o domínio em `infrastructure/mod.rs`. As consultas de `TransactionRow` leem as quatro colunas novas, e a `.sqlx` é regenerada.
- **API:** `AdjustmentDto` (com `AdjustmentDirectionDto` e `AdjustmentModeDto`), `gross_amount` e `adjustments` nos pedidos de criação e edição, `adjustments` opcional na liquidação, `gross_amount`, `adjustments`, `settled_gross_amount` e `settled_adjustments` nas respostas, e a rota nova `POST /api/v1/transactions/settlement-preview` (`preview_settlement`, `SettlementPreviewRequest`, `BreakdownDto`). O contrato em `packages/contracts` é regenerado.

## Decisões

- **Itens em `JSONB` na própria linha** em vez de uma tabela filha: a lista é lida e gravada inteira com a movimentação, tem até 20 itens e não é filtrada pelo banco; a tabela filha exigiria `id`, `owner_id`, `visibility`, RLS e uma consulta extra por página nas listagens, no resumo e nas recorrentes. Mesmo padrão da `rule JSONB` da recorrente.
- **`computed_amount` gravado** em vez de recalculado na leitura: o centavo residual da liquidação (RN-07) não sai da fórmula do item.
- **Migração da recorrente nesta tarefa** em vez de uma `20261104010002` na TASK-05: a spec lista uma migração só, o teste de RNF-03 cobre as duas tabelas e só esta tarefa mexe no esquema. Para o `NOT NULL` valer, a criação e a mudança da recorrente gravam `gross_amount = expected_amount` até a TASK-05 trazer os itens da regra. **A TASK-05 recebe pronto:** `recurring_transactions.gross_amount BIGINT NOT NULL` (> 0) e `adjustments JSONB NOT NULL DEFAULT '[]'` (até 20 itens, sem itens o bruto é o líquido), o formato `AdjustmentRow` com `adjustment_rows`/`adjustments_from_rows`, as funções `planned_amounts`, `edited_amounts`, `planned_from_gross` e `definitions`, `Transaction::settle_with` e `FinanceItem::adjustments()` (que a TASK-05 completa na virtual).
- **`Settlement` continua `Copy`** com o bruto liquidado, e os itens liquidados ficam na `Transaction`: tornar `Settlement` não `Copy` mudaria o uso por valor em `summary.rs`, `forecast.rs` e `dto.rs`.
- **`settle` com a mesma assinatura** e o novo `settle_with`: mudar `settle` quebraria testes de outras tarefas (`summary.rs`, `forecast.rs`, `recurring_transaction.rs`).
- **Pedido com exatamente um entre `expected_amount` e `gross_amount`**: só `expected_amount` funciona como hoje (compatível com a tela atual, os relatórios e a busca, que criam movimentações assim); os dois juntos ou itens sem bruto são recusados no campo, em vez de ignorar um deles em silêncio.
- **Um só `AdjustmentDto`** para pedido e resposta, com `computed_amount` ignorado no pedido, em vez de dois tipos: a tela reenvia os itens que recebeu da prévia.
- **Prévia sem id**, com `expected_gross_amount` no pedido, em vez de `/transactions/{id}/settlement-preview`: serve também à ocorrência aberta da recorrente, que não tem id, e aos itens editados antes de gravar (RF-10, decisão 13).
- **Desfazer só limpa a liquidação**: o previsto nunca é sobrescrito, então volta sozinho (RF-15, decisão 9), sem guardar cópia.
- **Backfill com `NO FORCE ROW LEVEL SECURITY` temporário**, como em `20261103010002_categories-color-hex.sql`: com a RLS forçada, a migração roda sem `app.current_user_id` e o `UPDATE` afetaria zero linhas.

## Riscos

- **Valores existentes mudarem na migração** (alto): mitigado pelo teste `adj_ct14_migration_keeps_balances_summary_and_settled_history`, que compara o retrato do banco antes e depois e o resumo com os valores anteriores, e pelo `SET NOT NULL`, que falha a migração se o preenchimento não alcançar alguma linha.
- **Centavo do cálculo reverso** (alto): o cálculo é o da TASK-02; aqui os testes de integração repetem os números da tabela comum (ct05, ct07, cb01, cb02).
- **Contrato e tela:** `expected_amount` continua obrigatório na resposta e opcional no pedido, então a tela atual continua criando movimentações. Os campos novos e obrigatórios das respostas quebram o `pnpm --filter @atria/web typecheck` nos objetos de teste tipados com o contrato (`apps/web/src/features/finance/screens/transactions-screens.test.tsx`) até as tarefas de tela (TASK-07 e TASK-09) os completarem; por isso o typecheck do `apps/web` fica fora desta tarefa.
- **Arquivos de outras tarefas:** esta tarefa mexe o mínimo em `recurring_transaction.rs`, `pg_recurring_transactions.rs` e `forecast.rs` (arquivos da TASK-05) para compilar e gravar o bruto da recorrente; a TASK-05 depende desta e parte do código como ela deixar.

## Referências da spec

RF-01, RF-08, RF-09, RF-15, RNF-03, RN-04, RN-06 a RN-09, CT-03, CT-05, CT-08, CT-09, CT-14, CB-01, CB-02, CB-06, CB-08, decisões 7 a 10 e 13, DEC-005; contrato "Contratos e interfaces" da spec.

## Arquivos em comum com a onda

Nenhum: a TASK-04 é a única tarefa da onda 3. Os arquivos `dto.rs`, `openapi.rs`, `packages/contracts/openapi.json` e `packages/contracts/src/schema.ts` são mudados de novo, em sequência, pela TASK-05 e pela TASK-06 na onda 4.

## O que foi feito

- **Migração:** `apps/server/src/finance/migrations/20261104010001_add-finance-adjustments.sql` (nova). Acrescenta bruto e itens previstos e liquidados em `transactions` e bruto e itens em `recurring_transactions`; preenche as linhas existentes sob `NO FORCE ROW LEVEL SECURITY` temporário e restaura o `FORCE`; inclui os `CHECK`s de coerência.
- **Servidor:** domínio (`domain/transaction.rs`, `settlement.rs`, `forecast.rs`, `recurring_transaction.rs`, `mod.rs`), aplicação (`application/ports.rs`, `transactions.rs`), infraestrutura (`infrastructure/mod.rs`, `pg_transactions.rs`, `pg_recurring_transactions.rs`) e interface (`interface/dto.rs`, `handlers.rs`, `mod.rs`, `openapi.rs`). A `.sqlx` foi regenerada.
- **Contrato:** `packages/contracts/openapi.json` e `packages/contracts/src/schema.ts` regenerados, sem edição manual.
- **Testes:** 23 testes `adj_` novos, 15 de integração em `apps/server/src/finance/tests/transactions.rs` e 8 de domínio (`transaction.rs`, `settlement.rs`, `forecast.rs`). Ajuste em `apps/server/src/http/tests/isolation.rs` (ver pontos de atenção).
- **Resultado:** 179 testes de `finance::` passam. As evidências estão em `evidencias/adjustments-transactions-tests.txt` (24 ok, incluindo o teste do OpenAPI) e `evidencias/adjustments-contract.txt` (10 ok). A regressão não mostrou diferença nos 6 comandos do baseline.

## Pontos de atenção

1. `UndoneSettlement::Reopened` passa a guardar `Box<Transaction>`, por causa do aviso `large_enum_variant` do clippy. Desvio do planejado.
2. `FinanceItem::adjustments()` e `settled_adjustments()` têm `#[cfg_attr(not(test), allow(dead_code))]` com `TODO(SPEC-004 TASK-06)`. A TASK-06 deve remover o atributo ao usá-las.
3. `apps/server/src/http/tests/isolation.rs` ficou fora da lista de Mudar, com aprovação do usuário: o corpo de `transactions` ganhou `"expected_amount": 1000`, porque o campo virou opcional e o teste montava o corpo só com os obrigatórios.
4. A recorrente grava `gross_amount = expected_amount` na criação e na mudança, até a TASK-05 trazer os itens da regra. Até lá, o bruto da recorrente é só o líquido.
5. O typecheck do `apps/web` fica quebrado até as TASK-07 e TASK-09, como previsto. Ele fica fora do Baseline e da Verificação, e nenhum arquivo de `apps/web` foi alterado.
6. Os testes foram escritos antes do código e falharam por não compilar, como previsto. Os passes são da execução depois da implementação.
