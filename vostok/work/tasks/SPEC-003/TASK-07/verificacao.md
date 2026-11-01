### Baseline

- `pnpm --filter @atria/contracts typecheck`
- `pnpm --filter @atria/contracts check`

### Verificação

O typecheck de `apps/web` fica de fora de propósito: ele quebra com o contrato novo até as TASK-10, TASK-13 e TASK-14 ajustarem as telas (passo 5).

```bash
cargo run -q -p atria-server -- openapi | cmp - packages/contracts/openapi.json
pnpm --filter @atria/contracts check
pnpm --filter @atria/contracts typecheck
test "$(git status --porcelain -- packages/contracts | grep -cvE 'packages/contracts/(openapi\.json|src/schema\.ts)$')" -eq 0
# evidência: contract-fields.txt
node -e 'const d=require(process.argv[1]);const s=d.components.schemas,p=d.paths;const str=x=>!!x&&(x.type==="string"||(Array.isArray(x.type)&&x.type.includes("string")));const del=k=>p[k]?.delete;const summary=s.FinancialSummaryResponse?.properties;const checks=[["sem /credit-cards",!Object.keys(p).some(k=>k.startsWith("/api/v1/credit-cards"))],["sem AccountKindDto",!("AccountKindDto" in s)],["sem CategoryColorDto e HighlightColor",!("CategoryColorDto" in s)&&!("HighlightColor" in s)],["DELETE /recurring-transactions/{id}",!!del("/api/v1/recurring-transactions/{id}")],["DELETE /accounts/{id} com move_to",(del("/api/v1/accounts/{id}")?.parameters??[]).some(x=>x.name==="move_to")],["FinancialSummaryResponse.monthly",!!summary?.monthly],["FinancialSummaryResponse sem credit_cards",!!summary&&!("credit_cards" in summary)],...["CategoryResponse","CreateCategoryRequest","UpdateCategoryRequest","WhereItemDto","HighlightResponse","CreateHighlightRequest","UpdateHighlightRequest"].map(n=>[`${n}.color string`,str(s[n]?.properties?.color)])];for(const [n,ok] of checks)console.log(`${ok?"ok":"FALHA"}  ${n}`);process.exit(checks.every(c=>c[1])?0:1)' "$PWD/packages/contracts/openapi.json"
```

Resultado esperado: o `openapi.json` igual ao que o servidor gera, o `schema.ts` igual ao gerado do `openapi.json`, os tipos do pacote compilando, só os dois arquivos mudados no pacote e as catorze linhas `ok` do contrato.

### Evidências

- `contract-fields.txt` (automática, da verificação)
  - Prova: o contrato publicado para o frontend reflete as tarefas de servidor: sem as rotas `/credit-cards`, sem `AccountKindDto` e sem os enums de cor por nome; com o `DELETE` da recorrência e o `DELETE` da conta com `move_to`; com `FinancialSummaryResponse.monthly` e sem `credit_cards`; e com a cor das categorias, do "Para onde foi" e dos destaques como `string` (RF-07, RF-17, RF-18, RF-19).
  - Trecho: catorze linhas começando por `ok`, entre elas `ok  sem /credit-cards`, `ok  DELETE /recurring-transactions/{id}`, `ok  DELETE /accounts/{id} com move_to`, `ok  FinancialSummaryResponse.monthly`, `ok  FinancialSummaryResponse sem credit_cards`, `ok  CategoryResponse.color string` e `ok  HighlightResponse.color string`.
  - Falha: qualquer linha `FALHA` (contrato sem a mudança de uma das tarefas de servidor, como antes desta tarefa) ou código de saída 1.
- `contract-sync.txt` (automática): `cargo run -q -p atria-server -- openapi | cmp - packages/contracts/openapi.json && echo 'openapi.json igual ao servidor' && pnpm --filter @atria/contracts check && echo 'schema.ts igual ao gerado'`
  - Prova: o contrato versionado é exatamente o que o servidor publica, e os tipos TypeScript são exatamente os gerados dele ([project/api-02], RF-07, RF-17, RF-18, RF-19).
  - Trecho: as linhas `openapi.json igual ao servidor` e `schema.ts igual ao gerado`.
  - Falha: `differ: byte` ou `differ: char` (contrato desatualizado, como antes da tarefa) e código de saída diferente de 0.
