### Concluída quando

- [x] Uma conta com movimentações pode ser excluída: o diálogo de exclusão pede a conta de destino, lista só as outras contas e não deixa seguir sem escolher (RF-05, CT-04).

  > Como comprovar: em `excluir-conta-testes.txt`, ver aprovados `rf05 asks for the destination account when the account has transactions`, `rf05 asks to choose the destination before deleting` e `rf05 sends the destination account in move_to`; no vídeo `finance-excluir-conta.webm`, ver o diálogo com "Conta de destino" e a escolha da Conta principal.

- [x] Ao confirmar, a conta some, o saldo da destino já aparece somado e as movimentações, transferências e saldos são relidos do servidor (RF-06, CT-04, [project/frontend-18]).

  > Como comprovar: em `excluir-conta-testes.txt`, ver aprovados `rf06 adds the balance of the deleted account to the destination right away` e `rf06 refreshes transactions, transfers and balances after moving`, e, no teste `rf05 asks for the destination account when the account has transactions`, a Conta principal com "R$ 3.550,00"; no vídeo, a Conta principal em R$ 5.600,00 e a compra movida para ela.

- [x] A conta de destino em outra moeda aparece como erro dentro do diálogo, com a lista restaurada e sem aviso solto, e a conta padrão continua sem "Excluir" (RF-05, CT-05, CB-03, FA-02, [project/frontend-09]).

  > Como comprovar: em `excluir-conta-testes.txt`, ver aprovados `ct05 shows a destination in another currency inside the dialog`, `rf05 keeps a destination in another currency inside the dialog` e `disables delete for the default account with a hint`; na saída do `excluir-conta`, a linha `ok` de `conta de destino em outra moeda`.

- [x] A conta sem movimentações continua sendo excluída com uma só confirmação, sem pedir a conta de destino (FA-03, RF-05).

  > Como comprovar: em `excluir-conta-testes.txt`, ver aprovado `deletes a common account after confirmation` (o `DELETE` sem `move_to`); na saída do `excluir-conta`, as linhas `ok` de `conta sem movimentações`.

- [x] O diálogo da conta de destino não tem violações de acessibilidade nem rolagem horizontal, nos temas claro e escuro e em desktop e 360 px (RNF-02, [project/frontend-10]).

  > Como comprovar: rodar `node apps/web/scripts/evidence-finance.mjs excluir-conta` e ver a última linha `ok  0 falha(s)`, com as linhas de axe sem violações nos cenários `excluir-conta`.

- [x] O e2e do CT-04 está escrito e compila (CT-04).

  > Como comprovar: em `excluir-conta-e2e-list.txt`, ver a linha `ct04 deleting an account with transactions moves them to the destination`.

- [x] Os arquivos da tarefa passam no ESLint e no Prettier sem warnings e sem erros de tipo ([project/code-style-01]).

  > Como comprovar: rodar o bloco de "Verificação" e ver todos os comandos terminarem com código 0.
