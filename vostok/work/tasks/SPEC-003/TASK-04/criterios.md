### Concluída quando

- [x] O resumo do Financeiro traz `monthly` com 12 meses em ordem: os 6 realizados, até o mês de hoje, e os 6 seguintes marcados como projetados (RF-17, CT-11).

  > Como comprovar: em `monthly-series-tests.txt`, ver `ct11_summary_monthly_series_has_6_realized_and_6_projected_months ... ok` e `monthly_series_has_6_realized_and_6_projected_consecutive_months ... ok`.

- [x] Nos meses realizados, entradas e saídas são os valores liquidados do mês e o saldo é o do fim do mês; nos projetados, entram as movimentações não liquidadas e as ocorrências das recorrentes pela data prevista, e o saldo é o previsto no fim do mês (RF-17, RN-08).

  > Como comprovar: em `monthly-series-tests.txt`, ver `monthly_series_realized_months_sum_settled_and_go_back_from_current_balance ... ok` e `monthly_series_projected_months_use_pending_by_expected_date ... ok`; o teste `ct11_...` confere os 12 meses com os valores esperados.

- [x] Pedir o resumo não grava nenhuma linha, e a série é a mesma qualquer que seja o período pedido (RN-08, DEC-003).

  > Como comprovar: o teste `ct11_...` passa contando 3 movimentações antes e depois do pedido e comparando a série de dois períodos diferentes.

- [x] Um mês sem nenhuma movimentação aparece com valor zero, sem quebrar a sequência de meses (CB-08).

  > Como comprovar: em `monthly-series-tests.txt`, ver `monthly_series_without_movements_has_12_zero_months ... ok`.

- [x] O OpenAPI documenta `monthly` e `MonthlyTotalsDto`, e a formatação, o clippy e os testes do Financeiro, dos relatórios e do `http` passam (RF-17).

  > Como comprovar: rodar a Verificação inteira e ver todos os comandos terminarem sem erro; no arquivo de evidência, `documents_all_finance_routes ... ok`.
