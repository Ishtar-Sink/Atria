<!-- Escrito no planejamento com o que a tarefa vai fazer e enriquecido na conclusão com o que foi feito. -->

Esta tarefa leva para a tela o mesmo cálculo de descontos e acréscimos do servidor, para o formulário mostrar o líquido previsto enquanto a pessoa digita o bruto e os itens.
O benefício é a resposta imediata, sem esperar o servidor, com a garantia de que o valor mostrado é igual ao que será gravado: a tela roda a mesma tabela de casos do servidor.
Perfil padrão, com risco médio (a tela e o servidor calcularem diferente), mitigado pela tabela comum.
Depende do estudo (TASK-01), roda em paralelo com o cálculo do servidor (TASK-02) e libera o editor de ajustes no formulário (TASK-07).

**O que foi feito.** A mesma regra de descontos e acréscimos foi levada para a tela, em uma parte do sistema que roda no próprio navegador. Com isso, o formulário poderá mostrar o valor líquido previsto enquanto a pessoa digita, sem esperar pelo servidor. Os 17 casos da tabela de referência passam também na tela, com os mesmos números e os mesmos motivos de recusa, e o trecho passou na checagem de tipos e de estilo. O valor mostrado na tela é, portanto, o mesmo que o servidor vai gravar. A tela ainda não exibe nada disso: essa parte entra nas tarefas seguintes do editor de ajustes.
