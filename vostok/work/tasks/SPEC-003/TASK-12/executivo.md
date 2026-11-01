<!-- Escrito no planejamento com o que a tarefa vai fazer e enriquecido na conclusão com o que foi feito. -->

## O que a tarefa entregou

Excluir uma conta que já tem movimentações agora pede a conta que vai recebê-las. A pessoa escolhe a conta de destino num campo dentro do próprio diálogo, e as movimentações, as transferências e as recorrências da conta excluída passam para ela. O saldo da conta excluída é somado ao da conta de destino na hora.

Se a conta de destino estiver em outra moeda, o aviso aparece no próprio diálogo e nada é apagado. Se a pessoa não escolher um destino, o campo pede a escolha antes de continuar. Os atalhos antigos, "Renomear" e "Ver movimentações", saíram do diálogo.

## Por que importa

Quem quer encerrar uma conta consegue fazer isso em um passo, sem mover lançamento por lançamento e sem perder o histórico. O saldo da conta que recebeu já reflete o que chegou. Um erro de moeda é explicado sem fechar o diálogo. Contas sem movimentações continuam sendo excluídas com uma confirmação simples.

## Como foi conferido

Testes automáticos das telas e das regras de conta, incluindo a escolha obrigatória do destino e o caso de moeda diferente. Também há um teste ponta a ponta no app real e um vídeo de demonstração (`finance-excluir-conta.webm`), que foi conferido e aprovado.
