### Baseline

- `cargo test -p atria-server finance:: 2>&1 | grep ' \.\.\. ' | grep -v 'accounts::ct04_\|accounts::ct05_\|accounts::cb04_\|account_with_transactions_without_destination\|destination_must_be_another_active_account\|destination_must_differ_from_deleted_account' | sort`
- `cargo test -p atria-server -- reports:: http::tests:: 2>&1 | grep ' \.\.\. ' | sort`
- `cargo clippy -q -p atria-server --all-targets -- -D warnings`
- `cargo fmt --check`

### Verificação

```bash
cargo fmt --check
cargo clippy -p atria-server --all-targets -- -D warnings
SQLX_OFFLINE=true cargo build -q -p atria-server
# evidência: account-deletion-tests.txt
cargo test -p atria-server -- finance::tests::accounts:: finance::application::accounts::tests:: finance::domain::error::tests::codes_are_stable finance::interface::openapi::tests::documents_all_finance_routes
cargo test -p atria-server finance::
cargo test -p atria-server -- reports:: http::tests::
```

Resultado esperado: formatação e clippy sem aviso, o build offline compilando com a `.sqlx` regenerada e `test result: ok` nos testes das contas, da regra do destino, dos códigos de erro, do OpenAPI, do Financeiro inteiro, dos relatórios e do `http`.

### Evidências

- `account-deletion-tests.txt` (automática, da verificação)
  - Prova: excluir uma conta com movimentações, transferência e recorrência, escolhendo outra conta, responde 204, passa tudo para a conta de destino e mantém o saldo total; a transferência entre as duas contas é excluída e o destino fica com o saldo das duas de antes dela; destino em outra moeda é recusado com `currency_mismatch`; a conta padrão continua recusada; sem destino, a conta com movimentações é recusada; destino igual, de outra pessoa ou excluído é recusado sem mudar nada; e o OpenAPI documenta `move_to` (RF-05, RF-06, RN-03, RN-04, RN-05, CT-04, CT-05, CB-03, CB-04).
  - Trecho: as linhas `test finance::tests::accounts::ct04_deleting_account_moves_transactions_transfers_and_recurring_to_destination ... ok`, `test finance::tests::accounts::cb04_transfer_between_deleted_and_destination_account_is_deleted ... ok`, `test finance::tests::accounts::ct05_destination_in_other_currency_is_refused_with_currency_mismatch ... ok`, `test finance::tests::accounts::ct05_default_account_is_refused_even_with_destination ... ok`, `test finance::tests::accounts::account_with_transactions_without_destination_is_refused ... ok`, `test finance::tests::accounts::destination_must_be_another_active_account_of_the_owner ... ok` e `test finance::application::accounts::tests::destination_must_differ_from_deleted_account ... ok`, e `test result: ok.` sem nenhum teste com `FAILED`.
  - Falha: `FAILED`, `test result: FAILED`, um saldo diferente na asserção (`left: ... right: ...`) ou a falta de uma das linhas acima (teste ausente).
