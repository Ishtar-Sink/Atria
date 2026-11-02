### Concluída quando

- [ ] O painel tem o cartão "Descontos do período" com o total dos descontos e o dos acréscimos do período, agrupados por nome (RF-14).

  > Como comprovar: em `descontos-painel-testes.txt`, ver aprovado `rf14 shows the deductions and additions of the period by name`; na prancha `finance-descontos-painel.png`, ver INSS e IRPF em "Descontos" e Juros em "Acréscimos".

- [ ] Cada nome aparece uma vez, com o total que o servidor somou, inclusive nomes que diferem só por maiúsculas (CT-12, CB-07).

  > Como comprovar: em `descontos-painel-testes.txt`, ver aprovado `ct12 shows each name once with the total from the server`.

- [ ] Sem descontos no período, o cartão mostra o texto explicativo; no erro, o cartão tem a própria tentativa, e os cartões continuam pareados.

  > Como comprovar: em `descontos-painel-testes.txt`, ver aprovados `shows the empty adjustments card`, `shows the panel empty, loading and error states` e `pairs the panel cards in rows`; na prancha, o cenário "cartão sem descontos".

- [ ] O cartão não usa vermelho, é acessível e funciona em 360 px sem rolagem horizontal (RNF-04, RNF-05).

  > Como comprovar: em `descontos-painel-testes.txt`, ver aprovados `rn07 shows the adjustments of the period without red` e `rnf04 has no axe violations with the adjustments card`; na prancha, conferida pelo usuário, as linhas `ok` de "sem vermelho", do axe e de "sem rolagem horizontal".

- [ ] Testes do Financeiro, a checagem de tipos do app inteiro, ESLint e Prettier passam sem warning.

  > Como comprovar: rodar a "Verificação" inteira e ver que termina com código 0.
