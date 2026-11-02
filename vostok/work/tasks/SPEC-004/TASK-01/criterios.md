### Concluída quando

- [x] O estudo `docs/estudos/financeiro-descontos.md` existe, no formato dos estudos do Financeiro, com todas as seções pedidas (RF-16, CT-15).

  > Como comprovar: rodar a Verificação e ver o script terminar sem a mensagem "seção ausente"; abrir o arquivo e ver os títulos de "Pergunta" até "Fontes".

- [x] A prática contábil da folha de 2026 (INSS por faixas, IRRF sobre o bruto menos o INSS com o redutor da Lei 15.270/2025 e contribuição sindical) aparece como exemplo, com o aviso de que o sistema não calcula as tabelas oficiais (RF-16, CT-15).

  > Como comprovar: na seção "Prática contábil da folha de 2026", ver as tabelas do INSS e do IRRF, o exemplo do salário de R$ 8.000,00 e a frase em negrito "Exemplo, não regra do sistema"; em "Fontes", ver pelo menos dois links.

- [x] O modelo de dados compara a tabela de itens com a coluna `JSONB`, recomenda uma das duas e explica as colunas novas, o `expected_amount` como líquido, a restrição `transactions_settlement_coherent` e a migração sem mudar valores existentes (RF-16, CT-15).

  > Como comprovar: na seção "Modelo de dados", ver a tabela das duas opções, a opção recomendada com o motivo e os três parágrafos sobre `expected_amount`, a restrição e a migração só com DDL.

- [x] O arredondamento e o cálculo reverso trazem a regra em inteiros e os mesmos números da tabela de casos das TASK-02 e TASK-03 (RF-16, CT-15).

  > Como comprovar: em "Cálculo reverso", ver o ct05 com bruto R$ 8.592,20 e o ct07 com o IRPF de R$ 1.887,09 depois do centavo; em "Arredondamento", ver o exemplo de 4.166,625 que vira 4.167.

- [x] A recomendação diz, ponto a ponto, o que confirma ou muda no contrato da spec, e o impacto no forecast e no resumo está descrito (RF-16, CT-15).

  > Como comprovar: na seção "O que muda no contrato da spec", ver uma linha por ponto do contrato com "confirma" ou a mudança; se houver mudança, ver a frase de que ela volta para a spec por ajuste antes da TASK-02.
