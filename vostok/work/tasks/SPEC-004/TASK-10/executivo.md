<!-- Escrito no planejamento com o que a tarefa vai fazer e enriquecido na conclusão com o que foi feito. -->

Esta tarefa fecha a entrega com o teste ponta a ponta do fluxo completo, no sistema de verdade: cadastrar um salário com INSS e IRPF, liquidar pelo líquido que caiu na conta e conferir o saldo, o detalhe e o painel, em computador e em celular, com a checagem de acessibilidade.
Também testa uma conta com desconto à vista e taxa, e grava um vídeo do fluxo para a revisão.
O benefício é a garantia de que as partes funcionam juntas antes da entrega. Perfil mecânico, de risco baixo.
Depende da liquidação pela tela e do cartão do painel; é a última tarefa da spec.

## O que mudou

- Agora há dois testes automáticos do fluxo completo de descontos, rodados contra o sistema real: um salário com INSS e IRPF, liquidado pelo valor que cai na conta, e uma conta a pagar com desconto à vista e taxa.
- Os dois testes passam no computador e na largura de celular (360 px), com a checagem de acessibilidade e sem rolagem lateral.
- Os 29 testes da área Financeiro passam nas duas larguras.
- Foi gerado um vídeo do fluxo: do formulário com os descontos, passando pela prévia da liquidação, até o cartão do painel. O vídeo foi conferido pelo usuário.
- Dois testes antigos (o do aluguel no dia 31 e o da exclusão de conta) estavam desatualizados por mudanças de tarefas anteriores, que nunca tinham sido refletidas neles. Com autorização do usuário, foram ajustados ao comportamento atual.
- Ponto de atenção: os dados de teste da mesma pessoa se acumulam e deixam as listas mais lentas. Numa rodada intermediária, um teste estourou o tempo limite e passou nas seguintes. Isso afeta a verificação, não quem usa o sistema.

## Arquivos alterados

- Testes automáticos da área Financeiro: os dois testes novos de descontos e os ajustes nos testes antigos.
- Roteiro que grava o vídeo do fluxo de descontos, do formulário ao painel.
