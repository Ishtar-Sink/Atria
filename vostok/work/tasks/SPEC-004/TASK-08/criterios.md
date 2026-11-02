### Concluída quando

- [ ] Na liquidação, a pessoa informa o líquido e vê, antes de confirmar, o bruto e cada item recalculados pelo servidor, com a base digitada ajustada na proporção do bruto (RF-09, CT-05).

  > Como comprovar: em `descontos-liquidacao-testes.txt`, ver aprovado `rf09 settles by the net and shows the gross recalculated by the server` (bruto R$ 8.592,20 e base R$ 7.647,06 para o líquido de R$ 6.500,00); na prancha `finance-descontos-liquidacao.png`, a "Prévia da liquidação".

- [ ] Os itens podem ser editados antes de confirmar; o bruto é recalculado com o item editado e a regra da recorrente não muda (RF-10, CT-06).

  > Como comprovar: em `descontos-liquidacao-testes.txt`, ver aprovados `rf10 edits an item before settling` (bruto R$ 9.423,70 com o IRPF em 22,5%) e `ct06 settles the occurrence with an edited item and keeps the rule`; na prancha, o cenário "edição dos itens antes de confirmar".

- [ ] Sem bruto possível, o cartão mostra o erro; sem itens, a liquidação continua como antes.

  > Como comprovar: em `descontos-liquidacao-testes.txt`, ver aprovados `cb01 shows the error when there is no gross for the net`, `keeps the settlement of a transaction without items as before` e `settles below expected and shows saving`.

- [ ] O cartão de liquidação com a prévia e o editor é acessível e funciona em 360 px sem rolagem horizontal, sem vermelho (RNF-04, RNF-05).

  > Como comprovar: na prancha `finance-descontos-liquidacao.png`, conferida pelo usuário, as linhas `ok` do axe e de "sem rolagem horizontal" nos dois temas e larguras.

- [ ] Testes do Financeiro, ESLint, Prettier e tipos passam sem warning.

  > Como comprovar: rodar a "Verificação" inteira e ver que termina com código 0.
