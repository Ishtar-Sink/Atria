### Concluída quando

- [x] O Previsto x realizado usa barras horizontais nas cores de entrada e saída, com os valores e os textos que dizem o que cada barra é (RF-14, CT-09).

  > Como comprovar: em `charts-tests.txt`, ver aprovado `rf14 draws expected and settled as horizontal bars with labels`; na prancha `finance-graficos.png`, ver as barras deitadas com "Previsto R$ …" e "Realizado R$ …".

- [x] Passar o mouse ou focar pelo teclado no Previsto x realizado mostra a dica com o valor e a diferença (RF-13, CT-09, RNF-05).

  > Como comprovar: em `charts-tests.txt`, ver aprovado `rf13 shows the value and the difference in the tooltip on focus`; no vídeo `finance-graficos.webm`, ver a dica aparecendo pelo mouse e pelas setas, com o contorno de foco.

- [x] O painel tem o card "Mês a mês" abaixo do Fechamento, em barras verticais, uma coluna por mês, com 6 meses realizados e 6 projetados em tom mais claro, e o mês sem movimentação aparece com zero (RF-15, CT-10, CB-08).

  > Como comprovar: em `charts-tests.txt`, ver aprovados `rf15 draws one column per month with the projected months lighter`, `cb08 shows a month without transactions as zero` e `rf15 shows the monthly card below the closing`; na prancha, ver as 12 colunas com as 6 últimas mais claras.

- [x] O "Mês a mês" alterna entre "Entradas e saídas" e "Saldo", a escolha fica na URL e o saldo negativo aparece em âmbar, sem vermelho (RF-16, RN-07, CT-10).

  > Como comprovar: em `charts-tests.txt`, ver aprovados `rf16 switches the monthly card between incomes and expenses and balance through the url` e `rn07 shows a negative balance in amber, never red`; na prancha, a linha `ok` de "Mês a mês em Saldo".

- [x] Os dois gráficos têm tabela acessível e funcionam pelo teclado, com contraste AA nos dois temas (RNF-02, RNF-03, RNF-05).

  > Como comprovar: em `charts-tests.txt`, ver aprovados `rnf03 keeps the accessible table with the difference` e `rnf05 moves the monthly tooltip with the keyboard`; na prancha, as linhas `ok` do axe nos dois temas e larguras.

- [x] A biblioteca de gráficos (recharts 3.10.1, MIT) está com versão exata e só é carregada no painel do Financeiro, num chunk separado (RNF-04, [project/stack-12]).

  > Como comprovar: em `charts-chunk.txt`, ver `recharts 3.10.1 · licença MIT` e `biblioteca nos iniciais: 0`; em `apps/web/package.json`, ver `"recharts": "3.10.1"` sem `^`.

- [x] Testes do Financeiro, tipos, ESLint, Prettier e o build passam sem warning.

  > Como comprovar: rodar a "Verificação" inteira e ver que termina com código 0.
