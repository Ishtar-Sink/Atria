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
- Os itens vão no envio sempre que a movimentação tem itens, mesmo sem edição. Descartado: só quando editados, que exigiria comparar o formulário com o previsto sem ganho, porque o servidor usa os mesmos itens.

## Riscos

- Os números dos testes (ct05: bruto 859220, base 764706; ct06: bruto 942370, IRPF 188709 com o centavo residual) seguem a regra da convenção; se o `grossForNet` da TASK-03 ou o servidor da TASK-04 derem outros, o passo 2 manda parar.
- A prévia é uma consulta por valor digitado; com `keepPreviousData`, o valor anterior fica na tela enquanto a nova resposta chega, sem piscar.

## Referências da spec

RF-09, RF-10, RF-11, RN-06, RN-07, RN-08, CB-01, CB-02, CB-05, CT-05, CT-06, FA-01, RNF-04, RNF-05; decisões 2, 13 e 16; risco "A base digitada proporcional não bate com a base real do holerite".

## Arquivos em comum

Na onda 6, esta tarefa e a TASK-09 dividem `apps/web/src/features/finance/i18n/pt-br.json` e `apps/web/scripts/evidence-finance.mjs`: o Coordenador as executa em sequência, nunca ao mesmo tempo.
