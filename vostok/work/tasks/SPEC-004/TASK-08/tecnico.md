<!-- Escrito no planejamento com o que a tarefa vai fazer e enriquecido na conclusão com o que foi feito. -->

## Abordagem

- O `SettlementCard` passa a receber o bruto e os itens previstos. Com itens, o formulário guarda os itens editáveis (`fromAdjustments`) e consulta `useSettlementPreview` (da TASK-07) a cada mudança do líquido ou dos itens, com o bruto previsto como referência da proporção (RN-06). A prévia aparece no `AdjustmentsBreakdown`, com "Líquido informado" no lugar do líquido previsto (RF-09, CT-05).
- A edição dos itens reaproveita o `AdjustmentsField`, aberto por um botão com `aria-expanded`, com o texto `base_help` explicando a base proporcional (RF-10, FA-01, CT-06).
- O envio leva `adjustments` só quando a movimentação tem itens ou a pessoa incluiu algum; sem itens, o pedido é o de hoje, e os testes atuais da liquidação continuam valendo.
- Na recorrente, os itens editados vão só na liquidação da ocorrência; a regra não recebe PATCH (RF-11).
- O erro da prévia (sem bruto possível, CB-01) aparece no cartão com `role="alert"` ([project/frontend-09]), pela `previewErrorKey`: o servidor responde 422 `validation_failed` com o erro de campo `adjustments`/`no_gross_for_net`, e a mensagem própria vem desse par; os demais erros seguem o `errorMessageKey` de sempre.

## Decisões

- A prévia vem do servidor, e não do `grossForNet` da tela (decisão 13 e risco "A tela e o servidor calculam diferente"). Descartado: calcular na tela, mais rápido mas sujeito a divergir do valor gravado.
- O editor fica recolhido atrás de "Editar descontos e acréscimos", e a prévia fica sempre visível. Descartado: o editor sempre aberto, que alonga demais o cartão em 360 px para quem só confere o líquido.
- O campo da base no editor da liquidação é a base prevista, que o servidor ajusta na proporção do bruto; a prévia mostra a base ajustada. Descartado: tratar a base editada como valor final, porque o contrato da prévia e da liquidação não tem como marcar uma base fixa (RN-06 só prevê a proporção). A divergência possível com o holerite fica no risco da spec e no texto `settlement.base_scaled_help`.
- Os itens vão no envio sempre que a movimentação tem itens ou a pessoa incluiu algum, mesmo sem edição. Descartado: só quando editados, que exigiria comparar o formulário com o previsto sem ganho, porque o servidor usa os mesmos itens.

## Riscos

- Os números dos testes (ct05: bruto 859220, base 764706; ct06: bruto 942370, IRPF 188709 com o centavo residual) seguem a regra da convenção. Na conclusão, os valores dos testes coincidiram com os previstos (ct05: bruto R$ 8.592,20; ct06: bruto R$ 9.423,70 e base do IRPF R$ 8.387,09, com o centavo residual no último percentual), então não houve divergência com o `grossForNet` da TASK-03 nem com o servidor da TASK-04.
- A prévia é uma consulta por valor digitado; com `keepPreviousData`, o valor anterior fica na tela enquanto a nova resposta chega, sem piscar.
- A base digitada é proporcional ao bruto, e pode não bater com a base real do holerite. O texto `settlement.base_scaled_help` avisa a pessoa.

## Arquivos alterados

- `apps/web/src/features/finance/components/settlement-card.tsx`: com itens, o cartão pede o líquido (`settlement.net_help`) e mostra a seção "Prévia da liquidação" (`aria-live`) com o bruto e os itens recalculados pelo servidor via `useSettlementPreview` (POST `/transactions/settlement-preview`, com `expected_gross_amount` para escalar a base digitada). Tem estados incompleto, carregando e erro. O botão "Editar descontos e acréscimos" (`aria-expanded`/`aria-controls`) abre o `AdjustmentsField` com o `base_scaled_help`. O envio manda `adjustments` só quando a movimentação tinha ou ganhou itens; sem itens, o pedido é o de antes.
- `apps/web/src/features/finance/screens/transaction-detail-screen.tsx`: o `SettlementCard` recebe `gross_amount` e `adjustments` da movimentação; o `onSettle` passa `adjustments` ao `settle.mutate` quando houver.
- `apps/web/src/features/finance/screens/recurrence-detail-screen.tsx`: o `SettlementCard` da ocorrência aberta recebe `gross_amount` e `adjustments` da regra. A liquidação da ocorrência com itens editados não muda a regra (sem PATCH).
- `apps/web/src/features/finance/hooks/use-transactions.ts`: nova `previewErrorKey(error)`. Se o erro é `ApiProblem` com `errors` contendo `{ field: 'adjustments', code: 'no_gross_for_net' }`, devolve `finance.errors.no_gross_for_net`; senão, usa `errorMessageKey` de `./finance-cache`.
- `apps/web/src/features/finance/i18n/pt-br.json`: sete chaves `settlement.*` (`net_help`, `preview`, `preview_loading`, `preview_incomplete`, `net_informed`, `edit_adjustments`, `base_scaled_help`) e `errors.no_gross_for_net`. As chaves existentes não mudaram.
- `apps/web/src/features/finance/components/finance.module.css`: `.settlePreview` e `.settlePreview > h3`, antes dos `@media`, só com tokens.
- `apps/web/src/features/finance/test-utils.tsx`: rota simulada `POST /transactions/settlement-preview` calculada com `grossForNet`, com a resposta 422 `validation_failed` quando não há bruto possível. A rota de liquidação da movimentação grava `settled_gross_amount` e `settled_adjustments`, e a diferença segue sobre o líquido (RN-08).
- `apps/web/src/features/finance/screens/transactions-screens.test.tsx`: cinco testes novos, `rf09`, `rf10`, `cb01`, `keeps the settlement of a transaction without items as before` e `ct06`. Os testes antigos foram mantidos sem renomear.
- `apps/web/scripts/evidence-finance.mjs`: `adjustmentsOverride` responde a prévia dos casos ct05, ct06 e do previsto, e o erro `no_gross_for_net` nos demais; o modo `descontos-liquidacao` tem quatro cenários (prévia pelo líquido, edição dos itens, liquidado com os itens e ocorrência da recorrente) e grava `finance-descontos-liquidacao.png`.

## Verificação

- Testes: os 209 testes da área financeira passam com `vitest`, incluindo os cinco novos.
- Qualidade: ESLint, Prettier e a checagem de tipos sem erro.
- Regressão: dos cinco comandos do baseline, quatro deram o mesmo resultado. A diferença do primeiro foi um falso alarme do filtro de alerta, causado pela palavra "error" no nome do teste `cb01`, que passa. O usuário aceitou a diferença.
- Evidências: modo `descontos-liquidacao`, com 16 capturas e 0 falhas, na prancha `finance-descontos-liquidacao.png`, conferida pelo usuário.
- Ponto de atenção no desktop: rolar até o campo "Valor efetivo" ou o botão "Liquidar" recolhe o cabeçalho fixo, o que move a página, e o elemento não fica parado para o clique do Playwright. Por isso o script usa foco e teclado nesses dois pontos; o clique de uma pessoa não é afetado.

## Referências da spec

RF-09, RF-10, RF-11, RN-06, RN-07, RN-08, CB-01, CB-02, CB-05, CT-05, CT-06, FA-01, RNF-04, RNF-05; decisões 2, 13 e 16; risco "A base digitada proporcional não bate com a base real do holerite".

## Arquivos em comum

Na onda 6, esta tarefa e a TASK-09 dividem `apps/web/src/features/finance/i18n/pt-br.json` e `apps/web/scripts/evidence-finance.mjs`: o Coordenador as executa em sequência, nunca ao mesmo tempo.
