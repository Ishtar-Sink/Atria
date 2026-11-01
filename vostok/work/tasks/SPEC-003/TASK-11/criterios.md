### Concluída quando

- [ ] A recorrência tem "Excluir" no "Mais ações" e é excluída depois de uma confirmação, sem precisar liquidar antes; cancelar não exclui (RF-01, CT-01, PD-14).

  > Como comprovar: em `recorrencia-testes.txt`, ver aprovados `rf01 deletes a recurrence from more actions after confirmation` e `rf01 keeps the recurrence when the deletion is cancelled`; no vídeo `finance-recorrencia.webm`, ver o menu, o diálogo "Excluir esta recorrência?" e a volta para Saídas com o aviso.

- [ ] Ao excluir, a ocorrência aberta e a previsão somem das listas na hora, e as cópias liquidadas continuam no histórico sem mudar o saldo (RF-02, RF-03, CT-01).

  > Como comprovar: em `recorrencia-testes.txt`, ver aprovados `rf02 removes the open occurrence and the forecast from the lists optimistically`, `ct01 keeps the settled copies and the balance when deleting` e `ct01 keeps the settled copies in the history after deleting the recurrence`; no vídeo, a cópia de agosto ainda em Saídas e nenhuma linha atrasada ou prevista do Aluguel.

- [ ] Se o servidor recusar a exclusão, as listas voltam ao que eram e a pessoa é avisada ([project/frontend-18], RF-01).

  > Como comprovar: em `recorrencia-testes.txt`, ver aprovado `rf01 rolls back and warns when the recurrence delete is refused`.

- [ ] A cópia liquidada oferece "Desfazer liquidação" no lugar de "Excluir", e a confirmação explica que o valor volta ao saldo e que a ocorrência volta a ficar aberta (RF-04, CT-03).

  > Como comprovar: em `recorrencia-testes.txt`, ver aprovados `rf04 offers undo instead of delete on a settled copy`, `ct03 undoing a settled copy explains the reopening and reopens the occurrence` e `confirms before undoing the settlement of a recurring copy`; no vídeo, o cabeçalho da cópia sem "Mais ações", o diálogo com a explicação e a ocorrência de 30/09 reaberta.

- [ ] Os diálogos da exclusão e do desfazer não têm violações de acessibilidade nem rolagem horizontal, nos temas claro e escuro e em desktop e 360 px (RNF-02, [project/frontend-10]).

  > Como comprovar: rodar `node apps/web/scripts/evidence-finance.mjs recorrencia` e ver a última linha `ok  0 falha(s)`, com as linhas de axe sem violações nos cenários `recorrencia`.

- [ ] Os e2e do CT-01 e do CT-03 estão escritos e compilam (CT-01, CT-03).

  > Como comprovar: em `recorrencia-e2e-list.txt`, ver as linhas `ct01 deleting a recurrence keeps the settled copies` e `ct03 undoing a settled copy reopens the occurrence`.

- [ ] Os arquivos da tarefa passam no ESLint e no Prettier sem warnings e sem erros de tipo ([project/code-style-01]).

  > Como comprovar: rodar o bloco de "Verificação" e ver todos os comandos terminarem com código 0.
