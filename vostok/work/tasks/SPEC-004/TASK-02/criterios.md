### Concluída quando

- [x] O servidor calcula o líquido a partir do bruto com itens fixos e percentuais, no bruto ou numa base digitada, e a ordem dos itens não muda o líquido (RF-03, RF-04, RF-05, RF-06, RF-07, CT-01, CT-02).

  > Como comprovar: em `adjustment-domain-tests.txt`, ver `ct01_percent_on_gross_and_fixed_deduction ... ok` (líquido 708000 com INSS 88000) e `ct02_typed_base_and_order_do_not_change_net ... ok` (IRPF 106800 e líquido 605200 nas duas ordens).

- [x] Cada percentual é arredondado para o centavo, meio para cima, só com inteiros (RF-05, RF-07).

  > Como comprovar: no mesmo arquivo, ver `rn03_percent_rounds_half_up_per_item ... ok` (4166,625 vira 4167); e abrir `apps/server/src/finance/domain/adjustment.rs` e ver que não há `f32` nem `f64`.

- [x] Liquidar pelo líquido calcula o bruto equivalente, escala a base digitada na proporção do bruto e põe o centavo que sobra no último percentual, com a identidade exata (RF-07, CT-07, CB-05).

  > Como comprovar: no mesmo arquivo, ver `ct05_reverse_scales_typed_base_with_gross ... ok` (bruto 859220), `ct07_residual_cent_goes_to_last_percent ... ok` (IRPF 188709) e `ct07_residual_follows_list_order ... ok`.

- [x] Itens inválidos são recusados com o campo e o código do problema: percentual 0% ou 100%, base digitada zero, 21 itens, nome vazio ou longo, líquido zero ou negativo e líquido sem bruto possível (CT-13, CB-03, CB-04, CB-09).

  > Como comprovar: no mesmo arquivo, ver `ct13_invalid_items_are_refused`, `cb03_net_not_positive_is_refused`, `cb04_rate_outside_range_is_refused`, `cb09_typed_base_must_be_positive` e `cb01_reverse_without_possible_gross_is_refused` com `ok`.

- [x] A formatação, o clippy e os testes do domínio do Financeiro passam, e a tabela de casos é a mesma da TASK-03 (RF-07).

  > Como comprovar: rodar a Verificação e ver todos os comandos terminarem sem erro, com `test result: ok` nos dois `cargo test`; comparar os números dos testes com a tabela de casos dos "Detalhes técnicos" e ver que são iguais.
