<!-- Escrito no planejamento com o que a tarefa vai fazer e enriquecido na conclusão com o que foi feito. -->

## O que a tarefa entregou

A exclusão de conta, na tela de detalhe, pede a conta de destino quando há movimentações (RF-05, RF-06), usando `DELETE /accounts/{id}?move_to=<account_id>` (204) do contrato regerado na TASK-07. Sem `move_to`, o servidor responde 409 `account_has_transactions`; com moeda diferente, 422 `currency_mismatch`. Nos dois casos o diálogo continua aberto e explica o problema (CB-03, PD-14, PD-09).

## Como foi feito

- `use-accounts.ts`: `DeleteAccountVariables` (`id` e `move_to` opcional) e `DeleteAccountState` (`idle`, `has_transactions`, `currency_mismatch`). A `mutationFn` envia `move_to` na URL. O cliente HTTP não aceita query em `delete`, então o parâmetro vai no caminho, como o `replacement_id` das categorias. `onMutate` tira a conta da lista e, com `move_to` e a conta encontrada no cache, soma o saldo dela à destino com `adjustBalance`. `onError` restaura e chama `warnRefusal` só para códigos fora de `DIALOG_ERRORS`, porque esses dois aparecem no diálogo. `onSuccess` remove a consulta da conta excluída e, com destino, invalida `financeKeys.all`, já que movimentações, transferências, recorrências e saldos mudaram de conta. `onSettled` invalida as contas.
- `account-detail-screen.tsx`: o diálogo virou uma máquina de três passos (`closed`, `confirm`, `destination`). Uma conta sem movimentações segue com o `ConfirmDialog` simples. Se a resposta for `account_has_transactions` ou `currency_mismatch`, o passo vai para `destination`, com um `FinanceDialog` que traz o `SelectField` "Conta de destino" (sem a própria conta), o botão "Mover e excluir" e o `role="alert"` da moeda. Sem outra conta, o diálogo pede para criar uma. O padrão segue o da exclusão de categoria com destino (`category-detail-screen.tsx`).
- `i18n/pt-br.json`: textos novos do diálogo, da escolha obrigatória e do aviso de conclusão ("As movimentações passaram para {name}."); `errors.account_has_transactions` reescrito; `errors.currency_mismatch` incluído. Saíram `account_detail.has_transactions_title`, `rename` e `view_transactions`, que só o detalhe usava (conferido por grep antes).
- `use-accounts.test.tsx`: testes do `move_to` na URL, da soma do saldo na hora, da invalidação depois de mover e da moeda diferente com rollback silencioso.
- `accounts-screens.test.tsx`: saiu o teste de "Renomear" e "Ver movimentações"; entraram os testes da conta de destino, da escolha obrigatória e da moeda diferente, com uma função local `chooseOption`. O teste de exclusão sem movimentações passou a conferir que não há `move_to`.
- `finance.e2e.ts`: teste `ct04` contra o servidor real. Cria uma conta, uma saída de 100,00 com 80,00 liquidados, exclui a conta pela lista escolhendo o destino e confere que a saída passou para a conta nova.
- `apps/web/scripts/evidence-finance.mjs`: rota simulada `DELETE /accounts/:id` com as regras do servidor (404 sem destino, 409 para conta padrão, 409 com movimentações sem destino, 422 para moeda diferente, soma do saldo, passagem de movimentações, recorrências e transferências); grupo de cenários `excluir-conta`; `recordAccountDeleteVideo` gravando `finance-excluir-conta.webm` com `withVideo`.

## Decisões

- A escolha do destino fica no mesmo diálogo, sem um modal novo. Isso segue o padrão de categoria e a regra de que o modal serve para confirmação.
- O saldo da conta de destino é ajustado pelo cliente antes da resposta. Depois, a invalidação de `financeKeys.all` traz o valor oficial do servidor.
- A conta padrão continua não excluível. O botão segue desabilitado, como antes.

## Verificação

- A Verificação passou sem falhas.
- A regressão, comparada com o baseline, ficou em 5 comandos iguais, 1 com acréscimo e 1 mudança esperada.
- Evidência: `finance-excluir-conta.webm`, gravada e conferida pelo usuário, em `TASK-12/evidencias/`.

## Pontos de atenção

- Se a conta excluída não estiver no cache, o saldo não é somado na hora. Ele só aparece depois da releitura das listas, pela invalidação.
- `pt-br.json`, `finance.e2e.ts` e `evidence-finance.mjs` também foram alterados pela TASK-11 na mesma onda, executados em sequência.
- O cenário de vídeo depende de `withVideo`, criado na TASK-11. Se ela não tivesse sido executada antes, o script não funcionaria.
- O script de evidência não passa pelo ESLint, porque `scripts` é ignorado em `eslint.config.js`.
