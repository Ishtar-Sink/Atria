### Baseline

- `cargo test -p atria-server finance:: 2>&1 | grep ' \.\.\. ' | grep -v 'monthly_series_\|summaries::ct11_' | sort`
- `cargo test -p atria-server -- reports:: http::tests:: 2>&1 | grep ' \.\.\. ' | sort`
- `cargo clippy -q -p atria-server --all-targets -- -D warnings`
- `cargo fmt --check`

### Verificação

```bash
cargo fmt --check
cargo clippy -p atria-server --all-targets -- -D warnings
# evidência: monthly-series-tests.txt
cargo test -p atria-server -- finance::domain::summary::tests::monthly_series_ finance::tests::summaries::ct11_ finance::tests::summaries::monthly_series_ finance::interface::openapi::tests::documents_all_finance_routes
cargo test -p atria-server finance::
cargo test -p atria-server -- reports:: http::tests::
```

Resultado esperado: formatação e clippy sem aviso e `test result: ok` nos testes da série mensal, do OpenAPI, do Financeiro inteiro, dos relatórios e do `http`.

### Evidências

- `monthly-series-tests.txt` (automática, da verificação)
  - Prova: o resumo do Financeiro traz `monthly` com 12 meses consecutivos, os 6 realizados até o mês de hoje com as liquidadas e o saldo ao fim de cada mês, e os 6 seguintes com `projected: true`, somando as pendentes e as ocorrências das recorrentes pela data prevista; o pedido não grava nenhuma linha; um mês sem movimentação aparece com zeros; e o OpenAPI documenta o campo (RF-17, RN-08, CT-11, CB-08).
  - Trecho: as linhas `test finance::tests::summaries::ct11_summary_monthly_series_has_6_realized_and_6_projected_months ... ok`, `test finance::tests::summaries::monthly_series_without_movements_has_12_zero_months ... ok`, `test finance::domain::summary::tests::monthly_series_has_6_realized_and_6_projected_consecutive_months ... ok`, `test finance::domain::summary::tests::monthly_series_realized_months_sum_settled_and_go_back_from_current_balance ... ok`, `test finance::domain::summary::tests::monthly_series_projected_months_use_pending_by_expected_date ... ok` e `test finance::interface::openapi::tests::documents_all_finance_routes ... ok`, e `test result: ok. 6 passed`.
  - Falha: `FAILED`, `test result: FAILED`, uma diferença no `json!` de `monthly` na asserção ou `running 0 tests` (testes ausentes).
