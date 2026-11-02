### Concluída quando

- [ ] O formulário da movimentação tem o editor de descontos e acréscimos, com nome, sentido, valor fixo ou percentual e a caixa "Base diferente do bruto" que mostra o campo da base, e explica que o percentual é a alíquota efetiva (RF-13).

  > Como comprovar: em `descontos-form-testes.txt`, ver aprovados `rf06 shows the base field only when the base differs from the gross` e `shows that the percent is the effective rate`; na prancha `finance-descontos-form.png`, ver o editor com a base digitada.

- [ ] O líquido previsto muda a cada edição do bruto e dos itens e é igual ao da tabela de casos usada pelo servidor (RF-13, CT-11).

  > Como comprovar: em `descontos-form-testes.txt`, ver aprovados `ct11 updates the expected net while editing the gross and a percent` e `ct11 shows the same net as the shared table case ct02 and sends gross and items` (líquido R$ 6.052,00); na prancha, o líquido R$ 6.012,00 com o Sindical.

- [ ] O formulário recusa líquido zerado ou negativo, base marcada sem valor e mais de 20 itens, com o erro no próprio formulário.

  > Como comprovar: em `descontos-form-testes.txt`, ver aprovados `cb03 refuses items that leave the expected net at zero or below`, `cb09 refuses a different base without a value` e `cb08 stops adding at 20 items`.

- [ ] O detalhe da movimentação mostra o bruto, cada item com o valor calculado e o líquido, no previsto e no liquidado, e o detalhe da recorrente mostra os itens; sem itens, a tela fica como antes (RF-12, CT-10).

  > Como comprovar: em `descontos-form-testes.txt`, ver aprovados `ct10 shows the gross, each item and the net expected and settled`, `rf12 shows the items of the recurrence and the expected net` e `cb06 shows a transaction without items as before`; na prancha, os blocos "Previsto" e "Liquidado".

- [ ] Editor e detalhamento são acessíveis e funcionam em 360 px sem rolagem horizontal, sem vermelho (RNF-04, RNF-05).

  > Como comprovar: em `descontos-form-testes.txt`, ver aprovados `rnf04 labels every field and has no axe violations` e `rn07 shows deductions and additions without red`; na prancha, as linhas `ok` do axe e de "sem rolagem horizontal" nos dois temas e larguras, conferida pelo usuário.

- [ ] Testes do Financeiro, ESLint, Prettier e tipos passam sem warning.

  > Como comprovar: rodar a "Verificação" inteira e ver que termina com código 0.
