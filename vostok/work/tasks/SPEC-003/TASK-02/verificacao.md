### Baseline

- `cargo test -p atria-server finance:: 2>&1 | grep ' \.\.\. ' | grep -v 'recurring_transactions::ct0\|undo_settlement_of_copy_after_recurring_deletion' | sort`
- `cargo test -p atria-server -- reports:: http::tests:: 2>&1 | grep ' \.\.\. ' | sort`
- `cargo clippy -q -p atria-server --all-targets -- -D warnings`
- `cargo fmt --check`

### Verificação

```bash
cargo fmt --check
cargo clippy -p atria-server --all-targets -- -D warnings
SQLX_OFFLINE=true cargo build -q -p atria-server
# evidência: recurring-deletion-tests.txt
cargo test -p atria-server -- finance::tests::recurring_transactions::ct01_ finance::tests::recurring_transactions::ct02_ finance::tests::recurring_transactions::undo_settlement_of_copy_after_recurring_deletion finance::tests::authorization::other_user_resources_return_404 finance::interface::openapi::tests::documents_all_finance_routes
cargo test -p atria-server finance::
cargo test -p atria-server -- reports:: http::tests::
```

Resultado esperado: formatação e clippy sem aviso, o build offline compilando com a `.sqlx` regenerada e `test result: ok` nos testes da exclusão da recorrente, da autorização, do OpenAPI, do Financeiro inteiro, dos relatórios e do `http` (inclusive `every_openapi_path_is_routed` com o `DELETE` novo).

### Evidências

- `recurring-deletion-tests.txt` (automática, da verificação)
  - Prova: excluir uma recorrente responde 204, tira a recorrente e a ocorrência aberta das listas, mantém as duas cópias liquidadas no histórico como movimentações pontuais e não muda o saldo; uma recorrente nunca liquidada some sem histórico e a segunda exclusão responde 404; desfazer a liquidação de uma cópia solta a deixa prevista; outra pessoa recebe 404 no `DELETE`; e o OpenAPI documenta a rota (RF-01, RF-02, RF-03, CT-01, CT-02, CB-01, CB-02).
  - Trecho: as linhas `test finance::tests::recurring_transactions::ct01_deleting_recurring_keeps_settled_copies_as_one_off_history ... ok`, `test finance::tests::recurring_transactions::ct02_deleting_never_settled_recurring_leaves_no_history_and_second_delete_is_404 ... ok`, `test finance::tests::recurring_transactions::undo_settlement_of_copy_after_recurring_deletion_keeps_it_as_one_off ... ok`, `test finance::tests::authorization::other_user_resources_return_404 ... ok` e `test finance::interface::openapi::tests::documents_all_finance_routes ... ok`, e `test result: ok. 5 passed`.
  - Falha: `FAILED`, `test result: FAILED`, `405` na asserção do `DELETE` ou `running 0 tests` (testes ausentes).
