<!-- Escrito no planejamento com o que a tarefa vai fazer e enriquecido na conclusão com o que foi feito. -->

## O que a tarefa entregou

A recorrência ganhou "Excluir" na tela de detalhe, com confirmação, usando `DELETE /recurring-transactions/{id}` (204) do contrato regerado na TASK-07. A cópia liquidada perdeu "Excluir" e ganhou "Desfazer liquidação", com o diálogo que explica a reabertura da ocorrência (RF-01 a RF-04, PD-14, PD-51).

## Como foi feito

- `use-recurring-transactions.ts`: novo `useDeleteRecurringTransaction(id)`, uma mutação otimista. `onMutate` cancela as consultas em andamento, guarda um snapshot de movimentações e da recorrência e tira da lista os itens sem `id` (a ocorrência aberta e as previsões). As cópias liquidadas têm `id` e ficam. Não há alteração de saldo no cliente (RN-01). `onError` restaura o snapshot e chama `warnRefusal`. `onSuccess` invalida a recorrência com `refetchType: 'none'`, porque a tela já está saindo e uma releitura daria 404; `onSettled` invalida movimentações e resumo.
- `recurrence-detail-screen.tsx`: "Mais ações" no cabeçalho, com "Excluir" em vermelho, abre o `ConfirmDialog`. Confirmada a exclusão, mostra o aviso de sucesso e navega para `/finance/income` ou `/finance/expenses`, conforme o tipo. O `catch` fica vazio e comentado, porque a recusa já restaurou as listas e avisou.
- `transaction-detail-screen.tsx`: o "Mais ações" só é renderizado quando a movimentação não é cópia de recorrência. A cópia liquidada oferece só "Desfazer liquidação". O diálogo de exclusão usa o texto próprio de movimentação.
- `i18n/pt-br.json`: texto de "Desfazer liquidação" reescrito para explicar a reabertura; novas chaves `recurrence_detail.delete_title`, `delete_description` e `deleted`; removida `transaction_detail.delete_copy_description`, que só o detalhe usava (conferido por grep antes).
- `recurrence-detail-screen.test.tsx` (novo): exclusão com confirmação e sem `DELETE` antes dela, cancelamento, cópia sem "Excluir", desfazer com reabertura, exclusão mantendo as cópias no histórico, com axe nos diálogos.
- `use-recurring-transactions.test.tsx`: testes da mutação (rota, lista otimista, cópias e saldo mantidos, rollback com aviso na recusa).
- `transactions-screens.test.tsx`: saiu o teste que excluía a cópia pelo "Mais ações"; o comportamento novo está no teste de desfazer da tela de recorrência.
- `test-utils.tsx`: rota `DELETE /recurring-transactions/:id` no `financeServer`, que responde 404 por padrão. Cada teste define a resposta em `override`.
- `finance.e2e.ts`: dois testes contra o servidor real, um para a exclusão mantendo as cópias e outro para desfazer reabrindo a ocorrência.
- `apps/web/scripts/evidence-finance.mjs`: rotas simuladas de desfazer liquidação e de excluir recorrência; `withVideo` extraído de `recordFormVideo`; grupo de cenários `recorrencia`; `recordRecurrenceVideo` gravando `finance-recorrencia.webm`.

## Decisões

- Excluir a recorrência não mexe no saldo. As cópias liquidadas continuam no histórico (RF-03). Só a ocorrência aberta e as previsões saem, e isso acontece de forma otimista.
- Desfazer uma cópia usa a rota já existente de desfazer liquidação (`DELETE /transactions/{id}/settlement`). O servidor devolve o valor ao saldo e reabre a ocorrência (DEC-004 e DEC-005). Por isso o teste de desfazer confere a releitura de `GET /accounts` depois da chamada.
- A cópia liquidada não oferece exclusão direta, só desfazer. Assim o histórico não se apaga por engano.

## Verificação

- A Verificação passou sem falhas.
- A regressão, comparada com o baseline, ficou em 4 comandos iguais, 2 com acréscimo e 1 mudança esperada.
- Evidência: `finance-recorrencia.webm`, gravada e conferida pelo usuário, em `TASK-11/evidencias/`.

## Pontos de atenção

- `pt-br.json`, `finance.e2e.ts` e `evidence-finance.mjs` também foram alterados pela TASK-12 na mesma onda. Foram executados em sequência; ao mexer neles, considere que as duas tarefas convivem.
- A rota de exclusão existe no `schema.ts` gerado. Antes de começar, a execução conferiu isso, porque a ausência indicaria falha da TASK-02 ou da TASK-07.
- Testes que dependem da exclusão precisam definir o `override` da rota no `financeServer`; sem ele, a resposta padrão é 404.
- O script de evidência não passa pelo ESLint, porque `scripts` é ignorado em `eslint.config.js`.
