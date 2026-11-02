### Concluída quando

- [x] Uma recorrente de entrada ou de saída aceita a mesma lista de itens da avulsa, grava o bruto e os itens da regra e mostra o líquido como valor previsto; sem itens, funciona como antes (RF-02, RN-09).

  > Como comprovar: em `adjustments-recurring-tests.txt`, ver `adj_ct04_recurring_with_adjustments_projects_net_and_items ... ok` (salário de R$ 8.000,00 com INSS e IRPF dá líquido R$ 6.052,00) e `adj_rn09_recurring_without_adjustments_keeps_gross_equal_to_net ... ok`.

- [x] Cada ocorrência virtual da projeção, nas listagens e no painel, tem o líquido e os itens da regra, sem gravar linhas (RF-08, CT-04).

  > Como comprovar: em `adjustments-recurring-tests.txt`, ver `adj_ct04_recurring_with_adjustments_projects_net_and_items ... ok`, que confere três meses de projeção e nenhuma movimentação gravada, e `adj_virtual_occurrence_carries_model_gross_and_adjustments ... ok`.

- [x] Liquidar a ocorrência pelo líquido grava na cópia liquidada os itens previstos e os da liquidação, com o bruto recalculado, a base do IRPF na mesma proporção e o saldo somando o líquido informado, sem mudar a regra (RF-11, CT-05).

  > Como comprovar: em `adjustments-recurring-tests.txt`, ver `adj_ct05_settling_occurrence_by_net_stores_settled_items_on_copy ... ok` (líquido R$ 6.500,00, bruto R$ 8.592,20, saldo + R$ 6.500,00, a regra continua com IRPF de 15%).

- [x] Os itens podem ser editados na liquidação da ocorrência; o bruto é recalculado com os itens editados e a regra da recorrente não muda (RF-10, RF-11, CT-06).

  > Como comprovar: em `adjustments-recurring-tests.txt`, ver `adj_ct06_edited_adjustments_on_settlement_keep_rule ... ok` (IRPF de 22,5% na liquidação, a regra continua com 15%) e `adj_settle_open_with_edited_items_keeps_rule_items ... ok`.

- [x] Mudar os itens da recorrente vale para a ocorrência aberta e as seguintes, e as cópias já liquidadas não mudam (RN-10).

  > Como comprovar: em `adjustments-recurring-tests.txt`, ver `adj_rn10_changing_adjustments_affects_open_and_following_but_not_copies ... ok`.

- [x] Os campos novos são validados como na avulsa, e desfazer a liquidação da cópia reabre a ocorrência com os itens da regra (RF-02, RF-10).

  > Como comprovar: em `adjustments-recurring-tests.txt`, ver `adj_recurring_amount_fields_are_validated ... ok` e `adj_undo_settlement_of_copy_reopens_occurrence_with_rule_items ... ok`.

- [x] O contrato gerado traz o bruto e os itens da recorrente e da liquidação da ocorrência, e a formatação, o clippy, o build offline e os testes do Financeiro, dos relatórios, da busca e do `http` passam ([project/api-02]).

  > Como comprovar: em `adjustments-recurring-contract.txt`, ver as cinco linhas `ok`; rodar a Verificação inteira e ver todos os comandos terminarem sem erro.
