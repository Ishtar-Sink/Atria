<!-- Escrito no planejamento com o que a tarefa vai fazer e enriquecido na conclusão com o que foi feito. -->

Movimentações recorrentes, como o salário mensal, passam a ter os mesmos descontos e acréscimos da avulsa, e cada mês projetado mostra o líquido e os itens.
Ao liquidar o mês, a pessoa informa o líquido, pode corrigir um item (por exemplo, a alíquota do IRPF daquele mês) e o registro do mês guarda os valores da liquidação, sem mudar a regra dos meses seguintes.
Mudar os itens da recorrente vale dali para a frente; meses já liquidados ficam como estão.
Perfil julgamento, risco alto: mexe na liquidação das recorrentes e no contrato da API.
Depende da TASK-04 e libera o formulário e o detalhe na tela (TASK-07); roda em sequência com a TASK-06.

**O que foi feito.** A recorrente, como o salário, agora guarda o valor bruto e os descontos e acréscimos, como já acontecia com a movimentação avulsa, e cada mês previsto mostra o líquido e os itens. Ao liquidar um mês, a pessoa informa quanto recebeu e pode corrigir um item, como a alíquota do IRPF daquele mês; o registro do mês guarda esses valores sem mudar a regra dos meses seguintes. Mudar os itens da recorrente vale para o mês em aberto e para os próximos, enquanto os meses já liquidados ficam como foram fechados. Desfazer a liquidação reabre o mês com os itens atuais da regra. Os testes novos e os já existentes passaram, sem diferença de comportamento nas partes que já funcionavam.
