### Concluída quando

- [ ] Uma recorrente pode ser excluída sem liquidar antes, com resposta 204, e some junto com a ocorrência aberta das listas (RF-01, RF-02, CT-01).

  > Como comprovar: em `recurring-deletion-tests.txt`, ver `ct01_deleting_recurring_keeps_settled_copies_as_one_off_history ... ok`.

- [ ] As cópias já liquidadas continuam no histórico como movimentações pontuais, sem ligação com a recorrente, e o saldo da conta não muda (RF-03, RN-01, CT-01).

  > Como comprovar: no mesmo arquivo, o teste `ct01_...` passa conferindo as duas cópias com `generated_from` nulo e o saldo igual ao de antes; e `undo_settlement_of_copy_after_recurring_deletion_keeps_it_as_one_off ... ok` mostra que desfazer a liquidação de uma delas a deixa prevista, sem apagá-la.

- [ ] Uma recorrente nunca liquidada some sem deixar histórico, e excluir a mesma recorrente de novo responde 404 sem mudar nada (CT-02, CB-01, CB-02).

  > Como comprovar: em `recurring-deletion-tests.txt`, ver `ct02_deleting_never_settled_recurring_leaves_no_history_and_second_delete_is_404 ... ok`.

- [ ] Outra pessoa recebe 404 ao excluir a recorrente, e o OpenAPI documenta o `DELETE /recurring-transactions/{id}` (RF-01).

  > Como comprovar: em `recurring-deletion-tests.txt`, ver `other_user_resources_return_404 ... ok` e `documents_all_finance_routes ... ok`.

- [ ] A formatação, o clippy, o build offline com a `.sqlx` regenerada e os testes do Financeiro, dos relatórios e do `http` passam (RF-01).

  > Como comprovar: rodar a Verificação inteira e ver todos os comandos terminarem sem erro, com `test result: ok` em cada `cargo test`.
