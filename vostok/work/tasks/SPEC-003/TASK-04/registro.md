## O que mudou

O resumo financeiro passou a mostrar uma visão mês a mês com 12 meses: os 6 meses já vividos, terminando no mês atual, e os 6 meses seguintes, com a previsão.

Para cada mês, a visão mostra quanto entrou, quanto saiu e qual foi o saldo ao fim do mês. Nos meses passados, os valores são os que de fato foram liquidados. Nos meses futuros, os valores são a previsão calculada a partir dos lançamentos pendentes e das contas recorrentes.

## Por que importa

- Quem usa o financeiro consegue enxergar a tendência do dinheiro no médio prazo, sem sair do resumo para montar planilhas.
- A previsão aparece sem ocupar espaço no histórico: nada é gravado para os meses futuros. O que está previsto só vira registro quando for de fato lançado ou liquidado.
- A série é a mesma qualquer que seja o período escolhido na tela, porque mostra a situação de hoje.
- Meses sem movimentação aparecem zerados, em vez de sumirem, o que deixa a leitura contínua.

## Como funciona na prática

- Contas que vencem ou ficaram atrasadas entram apenas no saldo previsto, não na barra de entradas ou saídas de um mês futuro, para que nenhum valor apareça no mês errado.
- Transferências entre contas próprias ficam de fora, porque não mudam o saldo total.

## Como foi verificado

Os testes da funcionalidade, a comparação com a situação anterior (sem regressões) e as evidências foram todos aprovados.

## O que foi feito

Acrescentada ao resumo do Financeiro a série mensal: 12 meses consecutivos, do mês atual menos 5 até o mês atual mais 6, com `projected: false` nos 6 primeiros e `projected: true` nos 6 últimos. A série é calculada a partir do estado de hoje, como o saldo, e não depende do período pedido na consulta. Nada é gravado: as ocorrências futuras vêm da projeção das recorrências (DEC-003).

Para cada mês:

- **Realizado:** `income` e `expense` somam o `settled_amount` das movimentações liquidadas com data efetiva no mês. `balance` é o saldo ao fim do mês, obtido a partir do saldo atual descontando o efeito das liquidadas com data efetiva posterior ao fim do mês.
- **Projetado:** `income` e `expense` somam o `expected_amount` das não liquidadas (pontuais gravadas e ocorrências virtuais) com `expected_date` no mês. `balance` é o `forecast_balance` até o fim do mês, que inclui as atrasadas.

Transferências ficam fora (RN-05 da SPEC-001). Mês sem movimentação sai com zeros.

## Arquivos alterados

- `apps/server/src/finance/domain/summary.rs`: constantes `MONTHLY_REALIZED_MONTHS` e `MONTHLY_PROJECTED_MONTHS`, struct `MonthTotals`, funções `monthly_window` e `monthly_series`, com um auxiliar por mês realizado e outro por mês projetado. Testes unitários no `mod tests` usando os auxiliares `stored`, `settled` e `planned`. Atualizado o `//!`. (1 arquivo, +217/-3)
- `apps/server/src/finance/application/summaries.rs`: `PeriodSummaryView` ganhou o campo `monthly`. Nova função `monthly` lê as liquidadas da janela via `transactions::list_all` com `TransactionFilter`, lê as pendentes via `pending_until` até o fim da janela e chama `monthly_series`. `period` preenche o campo depois de `current_balance`. (+40/-4)
- `apps/server/src/finance/interface/dto.rs`: novo `MonthlyTotalsDto` (com `month` no formato `YYYY-MM`, `From<MonthTotals>`) e o campo `monthly` em `FinancialSummaryResponse`, após `upcoming_bills`. (+38/-1)
- `apps/server/src/finance/interface/openapi.rs`: `MonthlyTotalsDto` registrado em `components(schemas(...))` e verificado no teste `documents_all_finance_routes`, junto com a presença do campo `monthly` em `FinancialSummaryResponse`. (+20/-2)
- `apps/server/src/finance/tests/summaries.rs`: teste de integração `ct11_summary_monthly_series_has_6_realized_and_6_projected_months`, que confere a série pela API, a igualdade da série entre períodos diferentes, a contagem de linhas da tabela `transactions` antes e depois (nada gravado) e o caso sem movimentações (`monthly_series_without_movements_has_12_zero_months`). (+96/-2)

Não há query `sqlx` nova ou alterada, então o diretório `.sqlx` não muda.

## Decisões

- **Estado de hoje, não do período.** Segue o mesmo critério do saldo, e evita que a série mude conforme o filtro da tela.
- **Pendentes do mês atual e atrasadas só no saldo projetado.** Não são realizadas nem pertencem a um mês futuro específico. Somá-las ao primeiro mês projetado foi descartado, porque colocaria valores no mês errado.
- **Sem gravação.** Os meses projetados são calculados em memória a cada consulta.
- **Sem `unwrap` no cálculo de datas.** `monthly_window` usa `with_day(1)`, `checked_sub_months`/`checked_add_months` e `pred_opt`; se algum cálculo retornar `None`, usa `today`. O saldo projetado usa `unwrap_or(current_balance)`. Somas com `saturating_add`/`saturating_sub`.

## Pontos de atenção

- A série depende de `FinancialSummaryResponse.monthly` estar com o formato do contrato (6 realizados e 6 projetados, em ordem). Qualquer mudança nesse formato altera o contrato da API e precisa ser refletida no OpenAPI.
- O relógio dos testes é fixo (`2026-11-01`) pelo auxiliar do módulo de testes; a janela da série depende desse valor, então novos testes devem usar o mesmo relógio.
- Esta tarefa depende da TASK-01 (remoção do cartão): os nomes usados aqui são os que ficaram depois dela.
- Ao compilar `atria-server` para testar, não rodar outra compilação pesada em paralelo (KNW-007).

## Verificação

- Testes: aprovados (saída em `validation/tests.out` do registro da tarefa).
- Regressão: aprovada, 4 comandos iguais ao baseline.
- Evidências: aprovadas (1 evidência em `TASK-04/evidencias/`).

## Registro de execução

| # | Data | Etapa | Resultado | Detalhe |
|---|---|---|---|---|
| 1 | 2026-11-01 | início | in_progress | aprovada em 2026-11-01T18:04:46Z; modelo: claude-opus-5-5 |
| 2 | 2026-11-01 | baseline | coletado | 4 comando(s); códigos de saída: 0, 0, 0, 0 |
| 3 | 2026-11-01 | testes | passed | Verificação sem falhas; saída em validation/tests.out |
| 4 | 2026-11-01 | regressão | passed | 4 comando(s) iguais ao baseline |
| 5 | 2026-11-01 | evidências | passed | 1 evidência(s) em TASK-04/evidencias/ |
| 6 | 2026-11-01 | conclusão | done | testes, regressão e evidências passed; critérios de conclusão marcados |

## Histórico de ajustes

| # | Data | Origem | Resumo |
|---|---|---|---|
