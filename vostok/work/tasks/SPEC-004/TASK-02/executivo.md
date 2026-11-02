<!-- Escrito no planejamento com o que a tarefa vai fazer e enriquecido na conclusão com o que foi feito. -->

Esta tarefa cria no servidor o cálculo dos descontos e acréscimos: do bruto chega ao líquido e, na liquidação, do líquido que caiu na conta volta ao bruto, ajustando os percentuais e a base digitada.
O benefício é ter uma regra única, exata em centavos, que todas as telas e relatórios vão usar, provada por uma tabela de casos que a tela também roda.
Perfil julgamento: é o ponto de maior risco da spec, porque o centavo do arredondamento precisa fechar sempre.
Depende do estudo (TASK-01) e libera a gravação dos descontos nas movimentações (TASK-04).

**O que foi feito.** Foi criada no servidor a regra que calcula descontos e acréscimos sobre o valor de cada movimentação: a partir do valor bruto, ela mostra quanto sobra de líquido e, na liquidação, descobre de volta o bruto que gera o valor que caiu na conta. Os cálculos são feitos em centavos, sem arredondamentos aproximados, e a diferença de um centavo que sobra do arredondamento vai sempre para o último percentual, de modo que o valor fecha sem sobra. Quando não existe um bruto possível ou os dados são inválidos, o sistema recusa com um motivo claro, em vez de gravar um número errado. Os 17 casos da tabela de referência passam, e a mesma tabela foi repetida na tela, para que o valor mostrado seja o mesmo que será gravado. Por enquanto a regra ainda não aparece para o usuário: as próximas tarefas é que a ligam ao formulário e à gravação.
