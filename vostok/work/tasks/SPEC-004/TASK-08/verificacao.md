### Baseline

- `pnpm --filter @atria/web exec vitest run src/features/finance --reporter=verbose 2>&1 | grep -E '^ +(✓|×|↓) ' | sed -E 's/ [0-9]+ms$//' | sort`
- `pnpm --filter @atria/web exec eslint src/features/finance --max-warnings 0`
- `pnpm --filter @atria/web exec prettier --check src/features/finance scripts/evidence-finance.mjs`
- `node --check apps/web/scripts/evidence-finance.mjs && echo sintaxe-ok`
- `pnpm --filter @atria/web exec tsc --noEmit --pretty false 2>&1 | grep -E '^src/' | grep -vE '^src/features/finance/screens/finance-panel-screen\.test\.tsx' | sed -E 's/\([0-9]+,[0-9]+\)//' | sort`

### Verificação

```bash
# Liquidação pelo líquido: prévia do servidor, edição dos itens e erro (Vitest + Testing Library + axe)
# evidência: descontos-liquidacao-testes.txt
pnpm --filter @atria/web exec vitest run src/features/finance/screens/transactions-screens.test.tsx src/features/finance/components/adjustments.test.tsx --reporter=verbose
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

- `descontos-liquidacao-testes.txt` (automática, da verificação)
  - Prova: ao informar o líquido de R$ 6.500,00, a prévia do servidor mostra o bruto de R$ 8.592,20, a base do IRPF ajustada para R$ 7.647,06 e os itens recalculados, e a liquidação manda o líquido e os itens; editar o IRPF para 22,5% recalcula o bruto (R$ 9.423,70) com o centavo no último percentual; na recorrente, a liquidação leva o item editado sem mudar a regra; sem bruto possível, o erro aparece no cartão; sem itens, a liquidação é a de antes; sem violações no axe (RF-09, RF-10, RF-11, CT-05, CT-06, CB-01, RNF-04).
  - Trecho: as linhas `✓` de `rf09 settles by the net and shows the gross recalculated by the server`, `rf10 edits an item before settling`, `cb01 shows the error when there is no gross for the net`, `keeps the settlement of a transaction without items as before`, `ct06 settles the occurrence with an edited item and keeps the rule`, `settles below expected and shows saving` e `settles the open occurrence and shows the next forecast`, e a linha `Tests` sem falhas.
  - Falha: `×`, `FAIL`, `failed` na linha `Tests` ou algum desses nomes ausente.
  - Espera: `rf09 settles by the net and shows the gross recalculated by the server`
- `finance-descontos-liquidacao.png` (print): `node apps/web/scripts/evidence-finance.mjs descontos-liquidacao`
  - Prova: com a API simulada, o cartão de liquidação do salário mostra a prévia pelo líquido (bruto R$ 8.592,20, base do IRPF R$ 7.647,06), a edição dos itens com o IRPF em 22,5% (bruto R$ 9.423,70) e o liquidado no detalhe; a ocorrência da recorrente mostra a prévia; nos temas claro e escuro, em 1440 px e em 360 px, sem rolagem horizontal, sem vermelho e com o axe sem violações (RF-09, RF-10, CT-05, CT-06, RNF-04, RNF-05).
  - Trecho: as linhas `ok` de "prévia pelo líquido", "edição dos itens antes de confirmar", "liquidado com os itens", "ocorrência da recorrente", "sem rolagem horizontal" e "axe sem violações (inclusive color-contrast)" em cada tema e largura, a linha `png:` e a última linha `ok  0 falha(s)`.
  - Falha: alguma linha `FALHA`, `Evidência desconhecida`, a falta da linha `png:` ou código de saída diferente de 0; na prancha, a prévia cortada ou passando da tela em 360 px.
  - Espera: `0 falha(s)`
