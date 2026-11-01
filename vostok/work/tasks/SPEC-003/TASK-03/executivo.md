<!-- Escrito na finalização da tarefa. -->

## Resumo

Agora é possível excluir uma conta que tem movimentações, desde que a pessoa escolha outra conta dela para recebê-las. Antes, o sistema recusava a exclusão de qualquer conta com movimentações.

## O que acontece ao excluir uma conta

Ao escolher a conta de destino, tudo o que estava na conta excluída passa para ela:

- os lançamentos, realizados ou previstos;
- as recorrências, como contas que se repetem todo mês;
- as transferências com outras contas;
- o saldo que restava na conta excluída.

As transferências feitas entre a conta excluída e a conta de destino deixam de existir, pois transferir dinheiro de uma conta para ela mesma não faz sentido. O efeito dessas transferências nos saldos é desfeito antes, então nenhum valor se perde.

Contas sem movimentações continuam sendo excluídas normalmente, sem precisar escolher destino.

## Quando a exclusão é recusada

- A conta principal da pessoa nunca pode ser excluída, mesmo com outro destino escolhido.
- O destino precisa ser outra conta ativa da mesma pessoa, na mesma moeda. Caso contrário, a exclusão é recusada com uma mensagem explicando o motivo: conta igual à que está sendo excluída, conta inexistente ou já excluída, conta que não é da pessoa, ou conta em outra moeda.
- Quando a exclusão é recusada, nada muda: a conta e seus lançamentos continuam exatamente como estavam.

## Valor para o negócio

- O total de dinheiro da pessoa não muda com a exclusão.
- Os lançamentos, as recorrências e o saldo da conta excluída não se perdem: passam para a conta de destino.
- Quando duas operações acontecem ao mesmo tempo sobre a mesma conta, o sistema as coordena para não falhar.

## Como foi verificado

- Foram criados testes automatizados para os principais cenários: exclusão com destino, tratamento das transferências entre as duas contas, recusa por moeda diferente, recusa da conta principal, recusa sem destino e recusa de destino inválido. Todos passaram.
- A verificação de que o restante do sistema não foi afetado também passou.
- Foi registrada 1 evidência da entrega.

## Pontos de atenção

- Quem usa a função de excluir contas precisa passar a perguntar a conta de destino quando a conta tiver movimentações. Sem ela, a exclusão será recusada.
