### Baseline

- `cargo test -p atria-server finance:: 2>&1 | grep ' \.\.\. ' | grep -v 'recurring_transactions::adj_\|recurring_transaction::tests::adj_\|forecast::tests::adj_virtual_' | sort`
- `cargo test -p atria-server -- reports:: http::tests:: search:: 2>&1 | grep ' \.\.\. ' | sort`
- `cargo clippy -q -p atria-server --all-targets -- -D warnings`
- `cargo fmt --check`
- `pnpm --filter @atria/contracts check`
- `pnpm --filter @atria/contracts typecheck`

### Verificação

O typecheck de `apps/web` fica de fora de propósito, como na TASK-04: os campos novos e obrigatórios das respostas quebram os objetos de teste tipados com o contrato até as tarefas de tela ajustarem.

```bash
cargo fmt --check
cargo clippy -p atria-server --all-targets -- -D warnings
SQLX_OFFLINE=true cargo build -q -p atria-server
# evidência: adjustments-recurring-tests.txt
cargo test -p atria-server -- finance::tests::recurring_transactions::adj_ finance::domain::recurring_transaction::tests::adj_ finance::domain::forecast::tests::adj_virtual_ finance::interface::openapi::tests::documents_all_finance_routes
cargo test -p atria-server finance::
cargo test -p atria-server -- reports:: http::tests:: search::
cargo run -q -p atria-server -- openapi | cmp - packages/contracts/openapi.json
pnpm --filter @atria/contracts check
pnpm --filter @atria/contracts typecheck
test "$(git status --porcelain -- packages/contracts | grep -cvE 'packages/contracts/(openapi\.json|src/schema\.ts)$')" -eq 0
# evidência: adjustments-recurring-contract.txt
cargo run -q -p atria-server -- openapi | node -e 'let t="";process.stdin.on("data",c=>t+=c).on("end",()=>{const s=JSON.parse(t).components.schemas;const has=(n,fs)=>fs.every(f=>!!s[n]?.properties?.[f]);const req=(n,f)=>(s[n]?.required??[]).includes(f);const checks=[["CreateRecurringTransactionRequest com gross_amount e adjustments",has("CreateRecurringTransactionRequest",["gross_amount","adjustments"])],["CreateRecurringTransactionRequest.expected_amount opcional",!!s.CreateRecurringTransactionRequest&&!req("CreateRecurringTransactionRequest","expected_amount")],["UpdateRecurringTransactionRequest com gross_amount e adjustments",has("UpdateRecurringTransactionRequest",["gross_amount","adjustments"])],["SettleOccurrenceRequest.adjustments",has("SettleOccurrenceRequest",["adjustments"])],["RecurringTransactionResponse com bruto e itens",has("RecurringTransactionResponse",["gross_amount","adjustments"])]];for(const [n,ok] of checks)console.log(`${ok?"ok":"FALHA"}  ${n}`);process.exit(checks.every(c=>c[1])?0:1)})'
```

Resultado esperado: formatação e clippy sem aviso, o build offline compilando com a `.sqlx` regenerada, `test result: ok` nos testes das recorrentes com itens, do Financeiro inteiro, dos relatórios, da busca e do `http`, o `openapi.json` igual ao que o servidor gera, o `schema.ts` igual ao gerado dele, só os dois arquivos mudados no pacote e as cinco linhas `ok` do contrato.

### Evidências

- `adjustments-recurring-tests.txt` (automática, da verificação)
  - Prova: a recorrente grava o bruto e os itens da regra e cada ocorrência virtual da projeção tem o líquido e os itens; liquidar a ocorrência pelo líquido grava na cópia os itens previstos e os da liquidação, com o bruto recalculado e a base na proporção; itens editados na liquidação não mudam a regra; mudar os itens da regra vale para a aberta e as seguintes, sem mudar as cópias; e desfazer reabre a ocorrência com os itens da regra (RF-02, RF-08, RF-10, RF-11, RN-10, CT-04, CT-05, CT-06).
  - Trecho: as linhas `test finance::tests::recurring_transactions::adj_ct04_recurring_with_adjustments_projects_net_and_items ... ok`, `adj_ct05_settling_occurrence_by_net_stores_settled_items_on_copy ... ok`, `adj_ct06_edited_adjustments_on_settlement_keep_rule ... ok`, `adj_rn10_changing_adjustments_affects_open_and_following_but_not_copies ... ok`, `adj_recurring_amount_fields_are_validated ... ok`, `adj_undo_settlement_of_copy_reopens_occurrence_with_rule_items ... ok`, `finance::domain::recurring_transaction::tests::adj_settle_open_with_edited_items_keeps_rule_items ... ok`, `finance::domain::forecast::tests::adj_virtual_occurrence_carries_model_gross_and_adjustments ... ok`, `finance::interface::openapi::tests::documents_all_finance_routes ... ok` e `test result: ok.` sem `FAILED`.
  - Falha: `FAILED`, `test result: FAILED`, um valor diferente na asserção (`left: ... right: ...`), `running 0 tests` ou a falta de uma das linhas acima (teste ausente).
- `adjustments-recurring-contract.txt` (automática, da verificação)
  - Prova: o contrato que o servidor publica tem o bruto e os itens na criação, na mudança e na resposta da recorrente, os itens editados na liquidação da ocorrência e `expected_amount` opcional na criação, compatível com os clientes de hoje (RF-02, RF-10, [project/api-02]).
  - Trecho: cinco linhas começando por `ok`, entre elas `ok  SettleOccurrenceRequest.adjustments` e `ok  RecurringTransactionResponse com bruto e itens`.
  - Falha: qualquer linha `FALHA` (como antes da tarefa) ou código de saída 1.
