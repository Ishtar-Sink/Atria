<!-- Escrito no planejamento com o que a tarefa vai fazer e enriquecido na conclusão com o que foi feito. -->

Antes de qualquer código, esta tarefa escreve o estudo que define como os descontos e acréscimos (INSS, IRPF, sindical, juros) serão guardados e calculados, inclusive o caminho inverso: partir do valor que caiu na conta e chegar ao bruto.
O benefício é decidir uma vez, com números conferidos, o que as nove tarefas seguintes vão implementar, e evitar retrabalho no banco e na tela.
Perfil padrão (texto e pesquisa, sem código), com risco baixo: o estudo só recomenda.
Ela libera as tarefas do cálculo no servidor (TASK-02) e na tela (TASK-03); se recomendar mudar o contrato da spec, a spec volta para ajuste antes delas.

**O que foi feito.** O estudo está em `docs/estudos/financeiro-descontos.md`, com números conferidos nas fontes de 2026:
- Até R$ 5.000,00 por mês fica isento de IR, e até R$ 7.350,00 paga menos.
- Um salário de R$ 8.000,00 tem INSS de R$ 921,51 e IR de R$ 1.037,85.
- Os itens ficam guardados junto com a própria movimentação.
- O cálculo é exato em centavos e, na liquidação, refaz o bruto a partir do valor que caiu na conta.

Nenhuma das nove tarefas seguintes muda. A spec precisa de dois acertos de contrato antes da TASK-02: a prévia da liquidação passa a receber o bruto previsto, e a rota do resumo é `/api/v1/financial-summaries`.
