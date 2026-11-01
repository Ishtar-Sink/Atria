### Concluída quando

- [ ] Uma conta com movimentações pode ser excluída indicando outra conta, e as movimentações, as transferências e as recorrências passam para ela, com o saldo total da pessoa igual ao de antes (RF-05, RF-06, CT-04).

  > Como comprovar: em `account-deletion-tests.txt`, ver `ct04_deleting_account_moves_transactions_transfers_and_recurring_to_destination ... ok`.

- [ ] Uma transferência entre a conta excluída e a de destino é excluída, e a conta de destino fica com o saldo das duas de antes da transferência (RN-05, CB-04).

  > Como comprovar: em `account-deletion-tests.txt`, ver `cb04_transfer_between_deleted_and_destination_account_is_deleted ... ok`.

- [ ] Uma conta de destino em outra moeda é recusada com o código `currency_mismatch` (422), e a conta padrão continua sem poder ser excluída, mesmo com destino (RN-03, RN-04, CT-05, CB-03).

  > Como comprovar: em `account-deletion-tests.txt`, ver `ct05_destination_in_other_currency_is_refused_with_currency_mismatch ... ok` e `ct05_default_account_is_refused_even_with_destination ... ok`.

- [ ] Sem conta de destino, a conta com movimentações é recusada com `account_has_transactions`; destino igual à própria conta, de outra pessoa ou já excluído é recusado sem mudar nada; e a conta sem movimentações continua sendo excluída sem destino (RF-05, RN-04).

  > Como comprovar: em `account-deletion-tests.txt`, ver `account_with_transactions_without_destination_is_refused ... ok`, `destination_must_be_another_active_account_of_the_owner ... ok`, `destination_must_differ_from_deleted_account ... ok` e o teste antigo `creates_renames_and_deletes_account ... ok`.

- [ ] A mudança de conta, a exclusão das transferências e os dois saldos acontecem numa única transação do banco, com as travas na ordem do resto do contexto (RF-06, [project/database-03]).

  > Como comprovar: abrir o método `delete` de `apps/server/src/finance/infrastructure/pg_accounts.rs` e ver um único `begin` e um único `commit`, com as linhas travadas antes das contas; os testes acima passam.

- [ ] A formatação, o clippy, o build offline com a `.sqlx` regenerada e os testes do Financeiro, dos relatórios e do `http` passam, e o OpenAPI documenta o parâmetro `move_to` (RF-05).

  > Como comprovar: rodar a Verificação inteira e ver todos os comandos terminarem sem erro; no arquivo de evidência, `documents_all_finance_routes ... ok`.
