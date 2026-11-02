### Concluída quando

- [x] Uma movimentação avulsa, de entrada ou de saída, aceita até 20 itens de desconto ou acréscimo, grava o bruto e os itens com o valor calculado de cada um, e o 21º item é recusado (RF-01, CB-08).

  > Como comprovar: em `adjustments-transactions-tests.txt`, ver `adj_rf01_income_with_adjustments_stores_gross_items_and_net ... ok` (bruto R$ 8.000,00, INSS R$ 880,00, líquido R$ 7.080,00) e `adj_cb08_twenty_adjustments_are_accepted_and_twenty_one_refused ... ok`.

- [x] O valor previsto da movimentação é o líquido, e é ele que entra no saldo, nas listagens e no resumo do painel; sem itens, tudo funciona como antes, com o bruto igual ao líquido (RF-08, CT-03, RN-09).

  > Como comprovar: em `adjustments-transactions-tests.txt`, ver `adj_ct03_expense_settles_net_with_deduction_and_addition ... ok` (saída de R$ 200,00 com desconto de 10% e taxa de R$ 5,00 tira R$ 185,00 do saldo), `adj_rf08_listing_and_summary_use_net ... ok` e `adj_rn09_transaction_without_adjustments_keeps_gross_equal_to_net ... ok`.

- [x] Liquidar pelo líquido recebido ou pago calcula o bruto equivalente, mantém os valores fixos, recalcula os percentuais com a base digitada na proporção do bruto e fecha a conta exata (bruto − descontos + acréscimos = líquido), inclusive com os itens editados na liquidação (RF-09, CT-05, RN-04, RN-06, RN-07).

  > Como comprovar: em `adjustments-transactions-tests.txt`, ver `adj_ct05_settlement_by_net_recalculates_gross_and_percentages ... ok` (líquido R$ 6.500,00 dá bruto R$ 8.592,20 e base do IRPF R$ 7.647,06) e `adj_settlement_with_edited_adjustments_recalculates_gross_and_absorbs_cent ... ok`.

- [x] A diferença da liquidação (economia, ganho ou perda) é calculada entre o líquido liquidado e o líquido previsto (RF-09, CT-08, RN-08).

  > Como comprovar: em `adjustments-transactions-tests.txt`, ver `adj_ct08_difference_is_between_settled_and_expected_net ... ok` (previsto R$ 7.080,00 liquidado por R$ 7.000,00 dá −R$ 80,00, perda) e `adj_ct08_difference_uses_net_amounts ... ok`.

- [x] Líquido zero na liquidação usa os fixos para o bruto e é recusado com mensagem no campo dos itens quando não há bruto possível; só com fixos, o bruto é o líquido mais os descontos menos os acréscimos (RF-09, CB-01, CB-02).

  > Como comprovar: em `adjustments-transactions-tests.txt`, ver `adj_cb01_zero_net_settlement_uses_fixed_items_or_is_refused ... ok` e `adj_cb02_fixed_only_settlement_adds_fixed_deductions_to_net ... ok` (líquido R$ 1.000,00 com Sindical de R$ 40,00 dá bruto R$ 1.040,00).

- [x] A prévia da liquidação devolve o bruto e os itens recalculados sem gravar nada (RF-09, decisão 13).

  > Como comprovar: em `adjustments-transactions-tests.txt`, ver `adj_preview_calculates_gross_for_net_without_writing ... ok`, que confere os valores e que nenhuma movimentação foi gravada.

- [x] Desfazer a liquidação reverte o saldo e devolve o bruto e os itens ao previsto (RF-15, CT-09).

  > Como comprovar: em `adjustments-transactions-tests.txt`, ver `adj_ct09_undo_settlement_returns_items_and_gross_to_expected ... ok`.

- [x] A migração não muda nenhum valor existente: saldo das contas e resumo do painel iguais, movimentações e recorrentes sem itens e com o bruto igual ao líquido, e as liquidadas antes da spec com bruto igual ao líquido e desfazer funcionando como hoje (CT-14, CB-06, RNF-03).

  > Como comprovar: em `adjustments-transactions-tests.txt`, ver `adj_ct14_migration_keeps_balances_summary_and_settled_history ... ok`.

- [x] O contrato gerado (`openapi.json` e `schema.ts`) traz o item de ajuste, a rota da prévia e o bruto e os itens nos pedidos e respostas, e a formatação, o clippy, o build offline e os testes do Financeiro, dos relatórios, da busca e do `http` passam ([project/api-02], [project/development-methodology-03]).

  > Como comprovar: em `adjustments-contract.txt`, ver as dez linhas `ok`; rodar a Verificação inteira e ver todos os comandos terminarem sem erro.
