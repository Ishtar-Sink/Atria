<!-- Escrito no planejamento com o que a tarefa vai fazer e enriquecido na conclusão com o que foi feito. -->

O resumo do Financeiro passa a trazer, para o período escolhido, quanto foi descontado e acrescentado em cada nome (INSS, IRPF, Sindical, juros), base do cartão "Descontos do período" do painel.
Nomes escritos de jeitos diferentes, como "INSS" e "inss", somam numa linha só; o que já foi liquidado entra pelo valor real e o resto pelo previsto.
Perfil padrão, risco baixo: só soma o que as movimentações já guardam, sem mudar o banco.
Depende da TASK-04, roda em sequência com a TASK-05 e libera o cartão na tela (TASK-09).

**O que foi feito.** O resumo do Financeiro agora traz, para o período escolhido, o total de descontos e acréscimos de cada nome, como INSS, IRPF, Sindical e juros, que será a base do cartão "Descontos do período" do painel. Nomes escritos com maiúsculas, minúsculas ou acentos diferentes são somados numa linha só, e os descontos aparecem antes dos acréscimos. Para cada nome, o total mostra o previsto e também o que já foi liquidado pelo valor real. Os movimentos do período, inclusive os das recorrentes, entram nessa conta, sem mudar o banco de dados nem criar dependências novas. Os testes novos passaram e nenhuma parte que já funcionava foi afetada.
