### Baseline

- `pnpm --filter @atria/web exec vitest run src/features/finance --reporter=verbose 2>&1 | grep -E '^ +(✓|×|↓) ' | sed -E 's/ [0-9]+ms$//' | sort`
- `pnpm --filter @atria/web exec eslint src/features/finance --max-warnings 0`
- `pnpm --filter @atria/web exec prettier --check src/features/finance scripts/evidence-finance.mjs`
- `node --check apps/web/scripts/evidence-finance.mjs && echo sintaxe-ok`
- `pnpm --filter @atria/web typecheck` (muda): depois da TASK-06, a fixture `summary` de `finance-panel-screen.test.tsx` não tem o campo novo `adjustments_by_name` e a checagem de tipos pode falhar; esta tarefa acrescenta o campo e a checagem passa a terminar sem erro.

### Verificação

```bash
# Cartão Descontos do período no painel (Vitest + Testing Library + axe)
# evidência: descontos-painel-testes.txt
pnpm --filter @atria/web exec vitest run src/features/finance/screens/finance-panel-screen.test.tsx --reporter=verbose
# O resto do Financeiro continua passando
pnpm --filter @atria/web exec vitest run src/features/finance
# Tipos do app inteiro, lint e formatação sem erro nem warning (o script fica fora do ESLint)
pnpm --filter @atria/web typecheck
pnpm --filter @atria/web exec eslint src/features/finance --max-warnings 0
pnpm --filter @atria/web exec prettier --check src/features/finance scripts/evidence-finance.mjs
node --check apps/web/scripts/evidence-finance.mjs
# Sem cor literal no CSS do painel
! grep -nE "#[0-9a-fA-F]{3,6}\b|rgba?\(" apps/web/src/features/finance/screens/finance-panel-screen.module.css
```

### Evidências

- `descontos-painel-testes.txt` (automática, da verificação)
  - Prova: o painel tem o cartão "Descontos do período" na zona lateral, com os descontos e os acréscimos em grupos, uma linha por nome com o liquidado e o previsto; um nome que o servidor já somou ("INSS" e "inss") aparece uma vez; sem linhas, o cartão explica o vazio; sem vermelho; no erro, o cartão tem a própria tentativa; sem violações no axe (RF-14, CT-12, CB-07, RNF-04).
  - Trecho: as linhas `✓` de `rf14 shows the deductions and additions of the period by name`, `ct12 shows each name once with the total from the server`, `shows the empty adjustments card`, `rn07 shows the adjustments of the period without red`, `rnf04 has no axe violations with the adjustments card`, `pairs the panel cards in rows` e `shows the panel empty, loading and error states`, e a linha `Tests` sem falhas.
  - Falha: `×`, `FAIL`, `failed` na linha `Tests` ou algum desses nomes ausente.
  - Espera: `rf14 shows the deductions and additions of the period by name`
- `finance-descontos-painel.png` (print): `node apps/web/scripts/evidence-finance.mjs descontos-painel`
  - Prova: com a API simulada, o painel mostra o cartão "Descontos do período" com INSS e IRPF em "Descontos" e Juros em "Acréscimos", com o sinal e sem vermelho, e o cartão vazio com o texto explicativo; nos temas claro e escuro, em 1440 px e em 360 px, sem rolagem horizontal e com o axe sem violações (RF-14, CT-12, RNF-04, RNF-05).
  - Trecho: as linhas `ok` de "Descontos do período por nome", "cartão sem descontos", "sem vermelho", "sem rolagem horizontal" e "axe sem violações (inclusive color-contrast)", a linha `png:` e a última linha `ok  0 falha(s)`.
  - Falha: alguma linha `FALHA`, `Evidência desconhecida`, a falta da linha `png:` ou código de saída diferente de 0; na prancha, o cartão cortado em 360 px ou algum valor em vermelho.
  - Espera: `0 falha(s)`
