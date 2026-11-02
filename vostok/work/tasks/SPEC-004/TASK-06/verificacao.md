### Baseline

- `cargo test -p atria-server finance:: 2>&1 | grep ' \.\.\. ' | grep -v 'summaries::adj_\|summary::tests::adj_' | sort`
- `cargo test -p atria-server -- reports:: http::tests:: 2>&1 | grep ' \.\.\. ' | sort`
- `cargo clippy -q -p atria-server --all-targets -- -D warnings`
- `cargo fmt --check`
- `pnpm --filter @atria/contracts check`
- `pnpm --filter @atria/contracts typecheck`

### Verificação

O typecheck de `apps/web` fica de fora de propósito: o campo novo e obrigatório do resumo quebra o objeto de teste tipado do painel até a TASK-09 ajustar.

```bash
cargo fmt --check
cargo clippy -p atria-server --all-targets -- -D warnings
# evidência: adjustments-summary-tests.txt
cargo test -p atria-server -- finance::domain::summary::tests::adj_ finance::tests::summaries::adj_ finance::interface::openapi::tests::documents_all_finance_routes
cargo test -p atria-server finance::
cargo test -p atria-server -- reports:: http::tests::
cargo run -q -p atria-server -- openapi | cmp - packages/contracts/openapi.json
pnpm --filter @atria/contracts check
pnpm --filter @atria/contracts typecheck
test "$(git status --porcelain -- packages/contracts | grep -cvE 'packages/contracts/(openapi\.json|src/schema\.ts)$')" -eq 0
# evidência: adjustments-summary-contract.txt
cargo run -q -p atria-server -- openapi | node -e 'let t="";process.stdin.on("data",c=>t+=c).on("end",()=>{const s=JSON.parse(t).components.schemas;const has=(n,fs)=>fs.every(f=>!!s[n]?.properties?.[f]);const checks=[["FinancialSummaryResponse.adjustments_by_name",has("FinancialSummaryResponse",["adjustments_by_name"])],["AdjustmentTotalDto",has("AdjustmentTotalDto",["name","direction","expected","settled"])]];for(const [n,ok] of checks)console.log(`${ok?"ok":"FALHA"}  ${n}`);process.exit(checks.every(c=>c[1])?0:1)})'
```

Resultado esperado: formatação e clippy sem aviso, `test result: ok` nos testes do total por nome, do OpenAPI, do Financeiro inteiro, dos relatórios e do `http`, o `openapi.json` igual ao que o servidor gera, o `schema.ts` igual ao gerado dele, só os dois arquivos mudados no pacote e as duas linhas `ok` do contrato.

### Evidências

- `adjustments-summary-tests.txt` (automática, da verificação)
  - Prova: o resumo do período traz os descontos e os acréscimos somados por nome, com "INSS" e "inss" (e nomes que diferem só por acento) numa linha só, a liquidada pelos valores da liquidação e as previstas pelos previstos, descontos antes dos acréscimos, sem transferências nem movimentações de fora do período, e lista vazia quando não há itens; o OpenAPI documenta o campo (RF-14, RN-11, CT-12, CB-07).
  - Trecho: as linhas `test finance::tests::summaries::adj_ct12_summary_sums_adjustments_by_name_ignoring_case ... ok`, `test finance::tests::summaries::adj_summary_without_adjustments_has_empty_list ... ok`, `test finance::domain::summary::tests::adj_adjustments_by_name_groups_names_ignoring_case_and_accents ... ok`, `test finance::domain::summary::tests::adj_adjustments_by_name_uses_settled_values_for_settled_items ... ok`, `test finance::domain::summary::tests::adj_adjustments_by_name_orders_deductions_then_additions_and_skips_transfers ... ok`, `test finance::interface::openapi::tests::documents_all_finance_routes ... ok` e `test result: ok. 6 passed`.
  - Falha: `FAILED`, `test result: FAILED`, uma diferença no `json!` de `adjustments_by_name` na asserção ou `running 0 tests` (testes ausentes).
- `adjustments-summary-contract.txt` (automática, da verificação)
  - Prova: o contrato que o servidor publica tem o total por nome no resumo, com nome, sentido, previsto e liquidado ([project/api-02], RF-14).
  - Trecho: as linhas `ok  FinancialSummaryResponse.adjustments_by_name` e `ok  AdjustmentTotalDto`.
  - Falha: qualquer linha `FALHA` (como antes da tarefa) ou código de saída 1.
