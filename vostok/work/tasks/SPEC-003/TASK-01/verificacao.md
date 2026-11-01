### Baseline

- `cargo test -p atria-server finance:: 2>&1 | grep ' \.\.\. ' | grep -v 'credit_card\|installment\|card_used_limit\|summary_cards_show' | sort`
- `cargo test -p atria-server -- reports:: search:: 2>&1 | grep ' \.\.\. ' | sort`
- `cargo test -p atria-server http::tests:: 2>&1 | grep ' \.\.\. ' | sort`
- `cargo clippy -q -p atria-server --all-targets -- -D warnings`
- `cargo fmt --check`
- `git grep -n -e 'mod credit_card;' -e 'mod credit_cards;' -- apps/server/src/finance` (muda): as declarações dos módulos removidos (`domain/credit_card.rs`, `application/credit_cards.rs` e `tests/credit_cards.rs`) somem, e o comando passa a não achar nada

### Verificação

```bash
cargo fmt --check
cargo clippy -p atria-server --all-targets -- -D warnings
SQLX_OFFLINE=true cargo build -q -p atria-server
test -z "$(git status --porcelain -- apps/server/src/finance/migrations/20261101*.sql apps/server/src/finance/migrations/20261102*.sql)"
# evidência: card-migration-tests.txt
cargo test -p atria-server finance::tests::credit_card_migration
# evidência: card-removal-tests.txt
cargo test -p atria-server -- finance::tests::accounts::account_has_no_card_fields finance::tests::transactions::installments_are_no_longer_accepted finance::tests::transactions::updates_unsettled_transaction_fields finance::tests::authorization:: finance::tests::summaries::summary_balance_has_current_forecast_at_period_end_and_per_account finance::interface::openapi::tests::
cargo test -p atria-server finance::
cargo test -p atria-server -- reports:: search::
cargo test -p atria-server http::tests::
```

Resultado esperado: formatação e clippy sem aviso, o build offline compilando com a `.sqlx` regenerada, as migrações antigas do Financeiro intocadas e `test result: ok` nos testes da migração do cartão, da remoção do cartão, do Financeiro inteiro, dos relatórios, da busca e do `http` (isolamento, rotas, documento OpenAPI e migrações).

### Evidências

- `card-migration-tests.txt` (automática, da verificação)
  - Prova: aplicar a migração sobre um banco com cartão, compra em três parcelas, fatura paga por transferência e uma recorrente no cartão mantém as mesmas contagens, valores, datas, liquidações e saldos; o cartão vira uma conta comum que aparece no saldo do painel; as parcelas viram três saídas independentes, com a mesma data e o mesmo valor; e a transferência da fatura continua, com o mesmo valor e sem período de fatura (RF-07, RF-10, CT-06, CB-05, CB-06, RNF-01).
  - Trecho: as linhas `test finance::tests::credit_card_migration::ct06_rnf01_card_migration_keeps_counts_and_balances ... ok`, `test finance::tests::credit_card_migration::cb05_installments_become_independent_expenses ... ok` e `test finance::tests::credit_card_migration::cb06_paid_statement_transfer_keeps_amount_without_period ... ok`, e `test result: ok. 3 passed`.
  - Falha: `FAILED`, `test result: FAILED`, `panicked` com a diferença das contagens ou dos saldos, ou `running 0 tests` (arquivo de teste ausente).
  - Requer: `apps/server/src/finance/tests/credit_card_migration.rs`, `apps/server/src/finance/migrations/20261103010001_remove-credit-cards.sql`
- `card-removal-tests.txt` (automática, da verificação)
  - Prova: o servidor não tem mais cartão: a conta não aceita nem devolve tipo, limite, fechamento ou vencimento; a movimentação não aceita parcelas nem devolve parcela ou fatura; as rotas de fatura e de pagamento de fatura respondem 404; o resumo do Financeiro não tem mais Cartões e lista todas as contas no saldo; e o contrato OpenAPI não tem mais as rotas, os schemas nem os campos de cartão (RF-07, RF-09).
  - Trecho: as linhas `account_has_no_card_fields ... ok`, `installments_are_no_longer_accepted ... ok`, `updates_unsettled_transaction_fields ... ok`, `statement_routes_are_gone ... ok`, `summary_balance_has_current_forecast_at_period_end_and_per_account ... ok`, `documents_all_finance_routes ... ok` e `card_schemas_are_gone_from_contract ... ok`, e `test result: ok` sem nenhum `FAILED`.
  - Falha: `FAILED` em qualquer uma dessas linhas, `test result: FAILED`, ou a ausência de `account_has_no_card_fields`, `installments_are_no_longer_accepted`, `statement_routes_are_gone` ou `card_schemas_are_gone_from_contract` (testes não escritos).
