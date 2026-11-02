### Baseline

- `pnpm --filter @atria/web exec vitest run src/features/finance --reporter=verbose 2>&1 | grep -E '^ +(✓|×|↓) ' | sed -E 's/ [0-9]+ms$//' | sort`
- `pnpm --filter @atria/web exec eslint src/features/finance --max-warnings 0`
- `pnpm --filter @atria/web exec prettier --check src/features/finance scripts/evidence-finance.mjs`
- `node --check apps/web/scripts/evidence-finance.mjs && echo sintaxe-ok`
- `pnpm --filter @atria/web exec tsc --noEmit --pretty false 2>&1 | grep -E '^src/' | grep -vE '^src/features/finance/screens/finance-panel-screen\.test\.tsx' | sed -E 's/\([0-9]+,[0-9]+\)//' | sort` (muda): o contrato regenerado pelas TASK-04 e TASK-05 pode deixar erros de tipo nas fixtures e telas do Financeiro que ainda não têm `gross_amount` e `adjustments`; esta tarefa os corrige e a saída fica vazia (a fixture do resumo do painel fica para a TASK-09).

### Verificação

```bash
# Editor de itens, detalhamento, formulário com o líquido ao vivo e hooks (Vitest + Testing Library + axe)
# evidência: descontos-form-testes.txt
pnpm --filter @atria/web exec vitest run src/features/finance/lib/adjustment-form.test.ts src/features/finance/components/adjustments.test.tsx src/features/finance/screens/transactions-screens.test.tsx src/features/finance/screens/recurrence-detail-screen.test.tsx src/features/finance/hooks/use-transactions.test.tsx src/features/finance/hooks/use-recurring-transactions.test.tsx --reporter=verbose
# O resto do Financeiro continua passando
pnpm --filter @atria/web exec vitest run src/features/finance
# Lint e formatação sem erro nem warning (o script fica fora do ESLint)
pnpm --filter @atria/web exec eslint src/features/finance --max-warnings 0
pnpm --filter @atria/web exec prettier --check src/features/finance scripts/evidence-finance.mjs
node --check apps/web/scripts/evidence-finance.mjs
# Nenhum erro de tipo fora da fixture do resumo do painel (corrigida pela TASK-09)
test "$(pnpm --filter @atria/web exec tsc --noEmit --pretty false 2>&1 | grep -E '^src/' | grep -vcE '^src/features/finance/screens/finance-panel-screen\.test\.tsx')" -eq 0
# Sem cor literal no CSS do Financeiro
! grep -nE "#[0-9a-fA-F]{3,6}\b|rgba?\(" apps/web/src/features/finance/components/finance.module.css
```

### Evidências

- `descontos-form-testes.txt` (automática, da verificação)
  - Prova: o editor mostra o campo da base só com "Base diferente do bruto", troca fixo e percentual, para em 20 itens e explica a alíquota efetiva; o formulário mostra o líquido previsto a cada mudança do bruto e de um percentual, com o mesmo valor do caso ct02 da tabela comum, e manda o bruto e os itens; recusa líquido zero ou negativo e base vazia; o detalhe mostra bruto, cada item e líquido no previsto e no liquidado, e a recorrente mostra os itens; a prévia da liquidação e os itens na liquidação estão nos hooks; sem violações no axe (RF-12, RF-13, CT-10, CT-11, CB-03, CB-06, CB-08, CB-09, RNF-04).
  - Trecho: as linhas `✓` de `rf06 shows the base field only when the base differs from the gross`, `cb08 stops adding at 20 items`, `shows that the percent is the effective rate`, `rf12 shows the gross, each item with its value and the net`, `rnf04 labels every field and has no axe violations`, `ct11 updates the expected net while editing the gross and a percent`, `ct11 shows the same net as the shared table case ct02 and sends gross and items`, `cb03 refuses items that leave the expected net at zero or below`, `ct10 shows the gross, each item and the net expected and settled`, `rf12 shows the items of the recurrence and the expected net`, `rf09 asks the server for the settlement preview` e `rf10 sends the edited items with the settlement`, e a linha `Tests` sem falhas.
  - Falha: `×`, `FAIL`, `failed` na linha `Tests` ou algum desses nomes ausente.
  - Espera: `ct11 shows the same net as the shared table case ct02 and sends gross and items`
- `finance-descontos-form.png` (print): `node apps/web/scripts/evidence-finance.mjs descontos-form`
  - Prova: com a API simulada, a nova entrada com INSS 11%, IRPF 15% sobre a base digitada de R$ 7.120,00 e Sindical fixo de R$ 40,00 mostra o líquido previsto de R$ 6.012,00 ao vivo, e o detalhe mostra o previsto (bruto R$ 8.000,00, líquido R$ 6.052,00) e o liquidado (bruto R$ 8.592,20, líquido R$ 6.500,00), e a recorrente mostra os itens; nos temas claro e escuro, em 1440 px e em 360 px, sem rolagem horizontal, sem vermelho e com o axe sem violações (RF-12, RF-13, CT-10, CT-11, RNF-04, RNF-05).
  - Trecho: as linhas `ok` de "editor com o líquido ao vivo", "detalhe previsto e liquidado", "recorrente com descontos", "sem rolagem horizontal" e "axe sem violações (inclusive color-contrast)" em cada tema e largura, a linha `png:` e a última linha `ok  0 falha(s)`.
  - Falha: alguma linha `FALHA`, `Evidência desconhecida`, a falta da linha `png:` ou código de saída diferente de 0; na prancha, campo cortado ou passando da tela em 360 px.
  - Espera: `0 falha(s)`
