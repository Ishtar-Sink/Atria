### Concluída quando

- [x] As entradas aparecem em verde com "+" e as saídas na cor do texto com "−", nas listas e no painel (RF-11, CT-08).

  > Como comprovar: em `signs-tests.txt`, ver aprovados `rf11 shows incomes in green with plus and expenses with minus` e `ct08 shows incomes with plus in green and expenses with minus in the lists`; na prancha `finance-sinais.png`, ver Entradas com "+" em verde e Saídas com "−".

- [x] O sinal e a cor seguem o tipo da movimentação, nunca o sinal do número guardado (RN-06).

  > Como comprovar: em `signs-tests.txt`, ver aprovado `rn06 takes the sign from the kind, never from the stored number`.

- [x] Saldos e sobra prevista aparecem em verde quando positivos, em âmbar com "−" quando negativos e, quando zero, na cor do texto sem sinal (RF-12, CB-07, CT-08).

  > Como comprovar: em `signs-tests.txt`, ver aprovados `rf12 shows a positive balance in green and a negative one in amber`, `rf12 shows the balance and each account in green or amber`, `cb07 shows a zero balance in the text color without sign` e `cb07 shows a zero surplus without color or sign`; na prancha, as linhas `ok` de "saldo negativo em âmbar" e "saldo zero sem cor".

- [x] Nenhum valor usa vermelho, o sinal fica em texto ao lado da cor e o contraste é AA nos dois temas (RN-07, RNF-02, RNF-03).

  > Como comprovar: em `signs-tests.txt`, ver aprovados `rn07 never paints an amount in red`, `rnf03 keeps the sign as text next to the color` e `rnf02 has no axe violations with signed amounts`; na prancha, as linhas `ok` de "sem vermelho" e do axe nos dois temas e larguras.

- [x] Testes do Financeiro, tipos, ESLint e Prettier passam sem warning.

  > Como comprovar: rodar a "Verificação" inteira e ver que termina com código 0.
