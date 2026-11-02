### Concluída quando

- [x] O fluxo completo roda contra o servidor real: entrada com descontos, liquidada pelo líquido, com o bruto recalculado na prévia e o líquido no saldo e no painel (RF-08, RF-09, CT-05).

  > Como comprovar: em `descontos-e2e.txt`, ver `ok` em `ct05 settles an income with deductions by the net and the balance gets the net` nas duas larguras.

- [x] Uma saída com desconto e acréscimo tira do saldo só o líquido (RF-08, FA-02).

  > Como comprovar: em `descontos-e2e.txt`, ver `ok` em `fa02 an expense with discount and fee takes the net from the balance` nas duas larguras.

- [x] Formulário, detalhe e painel passam no axe e não têm rolagem horizontal em 360 px nem em desktop (RNF-04, RNF-05).

  > Como comprovar: os dois testes chamam `checkPage` em cada tela; em `descontos-e2e.txt`, ver os testes aprovados em `[w360-session]` e `[desktop-session]` e a linha final sem `failed`.

- [x] O vídeo do fluxo mostra o líquido ao vivo, a prévia da liquidação e o cartão do painel.

  > Como comprovar: abrir `finance-descontos.webm`, conferido pelo usuário, e ver as quatro linhas `ok` das etapas e `ok  0 falha(s)` na saída do comando.

- [x] Os e2e de antes do Financeiro continuam passando, e tipos, ESLint e Prettier passam sem warning.

  > Como comprovar: rodar a "Verificação" inteira (com a pilha de pé) e ver que termina com código 0.
