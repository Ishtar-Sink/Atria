### Concluída quando

- [x] O resumo do período traz o total dos descontos e o dos acréscimos agrupados por nome, com o sentido de cada linha e os descontos antes dos acréscimos (RF-14, CT-12).

  > Como comprovar: em `adjustments-summary-tests.txt`, ver `adj_ct12_summary_sums_adjustments_by_name_ignoring_case ... ok` (uma linha de INSS nos descontos e uma de Juros nos acréscimos) e `adj_adjustments_by_name_orders_deductions_then_additions_and_skips_transfers ... ok`.

- [x] Nomes que diferem só por maiúsculas, espaços ou acentos, como "INSS" e "inss" em movimentações diferentes, somam numa linha só (CB-07, RN-11).

  > Como comprovar: em `adjustments-summary-tests.txt`, ver `adj_adjustments_by_name_groups_names_ignoring_case_and_accents ... ok`; no teste `adj_ct12_...`, o INSS soma R$ 1.210,00 das duas entradas.

- [x] Liquidadas entram com os valores da liquidação; previstas e projeções, com os valores previstos; e o liquidado aparece separado (RN-11).

  > Como comprovar: em `adjustments-summary-tests.txt`, ver `adj_adjustments_by_name_uses_settled_values_for_settled_items ... ok`; no teste `adj_ct12_...`, o INSS tem liquidado R$ 880,00 e total R$ 1.210,00.

- [x] Sem itens no período, o total por nome é uma lista vazia, e as transferências e as movimentações fora do período não entram (RF-14).

  > Como comprovar: em `adjustments-summary-tests.txt`, ver `adj_summary_without_adjustments_has_empty_list ... ok`; no teste `adj_ct12_...`, o INSS de dezembro não entra no total de novembro.

- [x] O contrato gerado traz `adjustments_by_name` e `AdjustmentTotalDto`, e a formatação, o clippy e os testes do Financeiro, dos relatórios e do `http` passam ([project/api-02]).

  > Como comprovar: em `adjustments-summary-contract.txt`, ver as duas linhas `ok`; rodar a Verificação inteira e ver todos os comandos terminarem sem erro.
