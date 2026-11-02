<!-- Escrito no planejamento com o que a tarefa vai fazer e enriquecido na conclusão com o que foi feito. -->

## Abordagem

A recorrente ganha o bruto e os itens da regra e os passa às ocorrências virtuais e à cópia liquidada, reaproveitando o que a TASK-04 entregou:

- **Esquema pronto:** a migração `20261104010001_add-finance-adjustments.sql` (TASK-04) já criou `recurring_transactions.gross_amount BIGINT NOT NULL` (> 0) e `adjustments JSONB NOT NULL DEFAULT '[]'` (até 20 itens; sem itens o bruto é o líquido). Esta tarefa não cria migração; troca a gravação provisória `gross_amount = expected_amount` da TASK-04 pelo bruto e pelos itens da regra e regenera a `.sqlx`.
- **Domínio:** `RecurringTransaction` ganha `gross_amount` e `adjustments` e a fn `planned`; `OccurrenceSettlement` ganha os itens editados opcionais (e deixa de ser `Copy`); `settle_open` monta a cópia com o bruto e os itens previstos da regra e liquida por `Transaction::settle_with`, com os itens do pedido ou os da regra. `VirtualOccurrence` ganha `gross_amount` e `adjustments`, e `FinanceItem::adjustments()` passa a devolver os itens da virtual, o que leva as projeções para o cartão do painel (RN-11, TASK-06).
- **Casos de uso:** criar e mudar a recorrente usam `planned_amounts` e `edited_amounts` da TASK-04, com os mesmos campos e códigos de erro da avulsa.
- **API:** `gross_amount` e `adjustments` em `CreateRecurringTransactionRequest`, `UpdateRecurringTransactionRequest` e `RecurringTransactionResponse`; `adjustments` em `SettleOccurrenceRequest`; a virtual de `TransactionItemResponse` sai com o bruto e os itens da regra. O contrato em `packages/contracts` é regenerado.

## Decisões

- **Sem migração própria** (descartada a `20261104010002_add-recurring-adjustments.sql`): a TASK-04 já criou as colunas, porque a spec lista uma única migração e o teste de RNF-03 cobre as duas tabelas.
- **Mesma regra de pedido da avulsa** em vez de uma regra própria: a tela usa o mesmo formulário para avulsa e recorrente (TASK-07), e os mesmos códigos de erro simplificam a mensagem no campo.
- **Cópia com os itens previstos e os liquidados** em vez de só os liquidados: o detalhe mostra previsto e liquidado (RF-12) e a diferença continua sobre o líquido previsto (RN-08). A regra nunca muda na liquidação (RF-11, CT-06).
- **RN-10 sem código novo:** as virtuais saem da regra na leitura (DEC-003), então mudar os itens já vale para a aberta e as seguintes; as cópias guardam os próprios valores. Desfazer apaga a cópia e reabre a ocorrência com os itens atuais da regra (DEC-005).
- **Itens dentro de `OccurrenceSettlement`** em vez de um parâmetro a mais em `settle_open` e na porta `settle_occurrence`: o pedido inteiro já atravessa as camadas como um valor só.

## Riscos

- **Centavo do reverso na ocorrência** (alto): o cálculo é o da TASK-02 e da TASK-04; os testes repetem os números da tabela comum (ct05 e ct07 com IRPF de 22,5%).
- **Literal de `VirtualOccurrence` na busca:** `apps/server/src/search/infrastructure/mod.rs` monta uma virtual num teste; ele ganha os dois campos novos para compilar, sem mudar a busca, e `search::` entra no Baseline e na Verificação.
- **Typecheck do `apps/web`:** continua fora, como na TASK-04; os campos novos obrigatórios das respostas quebram objetos de teste tipados, e o typecheck segue quebrado até a TASK-07 e a TASK-09 (ver Pontos de atenção).

## Referências da spec

RF-02, RF-08, RF-10, RF-11, RN-06, RN-07, RN-10, CT-04, CT-05, CT-06, FA-01, fluxo principal (passos 5 a 7), decisão 6, DEC-003, DEC-004 e DEC-005; contrato "Contratos e interfaces" da spec.

## Arquivos em comum com a onda

A TASK-05 e a TASK-06 estão na onda 4 e dividem `apps/server/src/finance/interface/dto.rs`, `apps/server/src/finance/interface/openapi.rs` (inclusive o teste `documents_all_finance_routes`), `packages/contracts/openapi.json` e `packages/contracts/src/schema.ts`: o Coordenador as executa em sequência, em qualquer ordem. A segunda mantém as mudanças da primeira nesses arquivos e regenera o contrato a partir do código, que já inclui as duas. As duas são independentes no resto: a TASK-06 lê os itens só por `FinanceItem::adjustments()` e `settled_adjustments()`, que esta tarefa completa na virtual.

## O que foi feito

- **Servidor (`apps/server/src/`):**
  - `finance/domain/recurring_transaction.rs`: bruto e itens na regra, `planned()`, itens editados opcionais em `OccurrenceSettlement` (que deixou de ser `Copy`) e `settle_open`, que monta a cópia com o bruto e os itens previstos da regra e a liquida com `settle_with`.
  - `finance/domain/forecast.rs`: `VirtualOccurrence` com `gross_amount` e `adjustments`; `FinanceItem::adjustments()` devolve os itens da virtual.
  - `finance/domain/transaction.rs`: `Transaction::settle` com `#[cfg(test)]` (fora da lista de Mudar, com aprovação do usuário).
  - `finance/application/recurring_transactions.rs`: criar e mudar a recorrente com `planned_amounts` e `edited_amounts`.
  - `finance/infrastructure/pg_recurring_transactions.rs`: leitura e gravação de bruto e itens; `settle_occurrence` não mudou.
  - `finance/interface/dto.rs`, `handlers.rs` e `openapi.rs`: campos novos nos pedidos e na resposta da recorrente, itens na liquidação da ocorrência e na virtual.
  - `finance/tests/recurring_transactions.rs`: 7 testes de integração `adj_`.
  - `search/infrastructure/mod.rs`: literal de `VirtualOccurrence` no teste, com os campos novos.
  - `.sqlx/`: regenerado para as queries alteradas; nenhuma migração nova.
- **Contrato:** `packages/contracts/openapi.json` e `packages/contracts/src/schema.ts` regenerados do código, sem edição à mão.
- **Testes:** 7 de integração `adj_` e 3 de domínio (2 em `recurring_transaction.rs` e 1 em `forecast.rs`). Passam 189 testes de `finance::` e 37 de `search::`. Evidências em `vostok/work/tasks/SPEC-004/TASK-05/evidencias/`: `adjustments-recurring-tests.txt` e `adjustments-recurring-contract.txt` (5 ok).
- **Regressão:** sem diferença em relação ao baseline; a única diferença é o acréscimo dos testes novos da TASK-06.

## Pontos de atenção

1. `Transaction::settle` (`finance/domain/transaction.rs`) ficou com `#[cfg(test)]`. Com a recorrente usando `settle_with`, ele só é usado em testes, e o clippy recusava código morto. Se um caminho de produção voltar a usá-lo, o atributo precisa sair.
2. TASK-05 e TASK-06 dividiram `dto.rs`, `openapi.rs` e o contrato gerado e rodaram em sequência. O contrato final inclui as mudanças das duas.
3. O typecheck do `apps/web` segue quebrado até a TASK-07 e a TASK-09. Nenhum arquivo de `apps/web` foi alterado nesta tarefa.
