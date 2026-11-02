### Baseline

- `cargo test -p atria-server finance:: 2>&1 | grep ' \.\.\. ' | grep -v 'transactions::adj_\|transaction::tests::adj_\|settlement::tests::adj_\|forecast::tests::adj_' | sort`
- `cargo test -p atria-server -- reports:: http::tests:: search:: 2>&1 | grep ' \.\.\. ' | sort`
- `cargo clippy -q -p atria-server --all-targets -- -D warnings`
- `cargo fmt --check`
- `pnpm --filter @atria/contracts check`
- `pnpm --filter @atria/contracts typecheck`

### Verificação

O typecheck de `apps/web` fica de fora de propósito: os campos novos e obrigatórios das respostas quebram os objetos de teste tipados com o contrato até as tarefas de tela ajustarem (decisão "Typecheck do `apps/web`").

```bash
cargo fmt --check
cargo clippy -p atria-server --all-targets -- -D warnings
SQLX_OFFLINE=true cargo build -q -p atria-server
# evidência: adjustments-transactions-tests.txt
cargo test -p atria-server -- finance::tests::transactions::adj_ finance::domain::transaction::tests::adj_ finance::domain::settlement::tests::adj_ finance::domain::forecast::tests::adj_ finance::interface::openapi::tests::documents_all_finance_routes
cargo test -p atria-server finance::
cargo test -p atria-server -- reports:: http::tests:: search::
cargo run -q -p atria-server -- openapi | cmp - packages/contracts/openapi.json
pnpm --filter @atria/contracts check
pnpm --filter @atria/contracts typecheck
test "$(git status --porcelain -- packages/contracts | grep -cvE 'packages/contracts/(openapi\.json|src/schema\.ts)$')" -eq 0
# evidência: adjustments-contract.txt
cargo run -q -p atria-server -- openapi | node -e 'let t="";process.stdin.on("data",c=>t+=c).on("end",()=>{const d=JSON.parse(t),s=d.components.schemas,p=d.paths;const has=(n,fs)=>fs.every(f=>!!s[n]?.properties?.[f]);const req=(n,f)=>(s[n]?.required??[]).includes(f);const item=["name","direction","mode","amount","rate_bp","base_amount","computed_amount"];const checks=[["POST /transactions/settlement-preview",!!p["/api/v1/transactions/settlement-preview"]?.post],["AdjustmentDto",has("AdjustmentDto",item)],["BreakdownDto",has("BreakdownDto",["gross_amount","net_amount","adjustments"])],["SettlementPreviewRequest",has("SettlementPreviewRequest",["settled_amount","adjustments","expected_gross_amount"])],["CreateTransactionRequest com gross_amount e adjustments",has("CreateTransactionRequest",["gross_amount","adjustments"])],["CreateTransactionRequest.expected_amount opcional",!!s.CreateTransactionRequest&&!req("CreateTransactionRequest","expected_amount")],["UpdateTransactionRequest com gross_amount e adjustments",has("UpdateTransactionRequest",["gross_amount","adjustments"])],["SettleTransactionRequest.adjustments",has("SettleTransactionRequest",["adjustments"])],...["TransactionResponse","TransactionItemResponse"].map(n=>[`${n} com bruto e itens`,has(n,["gross_amount","adjustments","settled_gross_amount","settled_adjustments"])])];for(const [n,ok] of checks)console.log(`${ok?"ok":"FALHA"}  ${n}`);process.exit(checks.every(c=>c[1])?0:1)})'
```

Resultado esperado: formatação e clippy sem aviso, o build offline compilando com a `.sqlx` regenerada, `test result: ok` nos testes dos ajustes, do Financeiro inteiro, dos relatórios, da busca e do `http`, o `openapi.json` igual ao que o servidor gera, o `schema.ts` igual ao gerado dele, só os dois arquivos mudados no pacote e as dez linhas `ok` do contrato.

### Evidências

- `adjustments-transactions-tests.txt` (automática, da verificação)
  - Prova: uma entrada ou saída avulsa grava o bruto e os itens, e o líquido calculado vira o valor previsto usado no saldo, nas listagens e no resumo; liquidar pelo líquido recalcula o bruto e os percentuais, com a base digitada na proporção do bruto, os fixos mantidos, o centavo residual no último percentual e a diferença sobre o líquido; os itens podem ser editados na liquidação; líquido zero usa os fixos ou é recusado sem bruto possível; desfazer devolve o bruto e os itens ao previsto; a prévia calcula sem gravar; até 20 itens; e a migração mantém saldos, resumo e liquidações antigas com bruto igual ao líquido (RF-01, RF-08, RF-09, RF-15, RNF-03, CT-03, CT-05, CT-08, CT-09, CT-14, CB-01, CB-02, CB-06, CB-08).
  - Trecho: as linhas `test finance::tests::transactions::adj_rf01_income_with_adjustments_stores_gross_items_and_net ... ok`, `adj_ct03_expense_settles_net_with_deduction_and_addition ... ok`, `adj_ct05_settlement_by_net_recalculates_gross_and_percentages ... ok`, `adj_ct08_difference_is_between_settled_and_expected_net ... ok`, `adj_ct09_undo_settlement_returns_items_and_gross_to_expected ... ok`, `adj_cb01_zero_net_settlement_uses_fixed_items_or_is_refused ... ok`, `adj_cb02_fixed_only_settlement_adds_fixed_deductions_to_net ... ok`, `adj_cb08_twenty_adjustments_are_accepted_and_twenty_one_refused ... ok`, `adj_preview_calculates_gross_for_net_without_writing ... ok`, `adj_ct14_migration_keeps_balances_summary_and_settled_history ... ok`, as de `finance::domain::transaction::tests::adj_`, `finance::domain::settlement::tests::adj_ct08_difference_uses_net_amounts ... ok`, `finance::interface::openapi::tests::documents_all_finance_routes ... ok` e `test result: ok.` sem `FAILED`.
  - Falha: `FAILED`, `test result: FAILED`, um valor diferente na asserção (`left: ... right: ...`), `running 0 tests` ou a falta de uma das linhas acima (teste ausente).
- `adjustments-contract.txt` (automática, da verificação)
  - Prova: o contrato que o servidor publica tem o item de ajuste, a rota da prévia com o pedido e a resposta, o bruto e os itens nos pedidos de criação, edição e liquidação e nas respostas, e `expected_amount` opcional no pedido de criação, compatível com os clientes de hoje (RF-01, RF-09, [project/api-02]).
  - Trecho: dez linhas começando por `ok`, entre elas `ok  POST /transactions/settlement-preview`, `ok  AdjustmentDto`, `ok  CreateTransactionRequest.expected_amount opcional` e `ok  TransactionResponse com bruto e itens`.
  - Falha: qualquer linha `FALHA` (como antes da tarefa) ou código de saída 1.
