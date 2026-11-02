### Baseline

- `pnpm --filter @atria/web exec vitest run src/features/finance/lib --reporter=verbose 2>&1 | grep -E '^\s*(✓|×|↓)' | grep -v 'adjustments.test.ts' | sed -E 's/ [0-9]+ms$//' | sort`
- `pnpm --filter @atria/web exec eslint --max-warnings 0 src/features/finance/lib`
- `pnpm --filter @atria/web exec prettier --check src/features/finance/lib`
- `pnpm --filter @atria/web exec tsc --noEmit --pretty false 2>&1 | grep -E '^src/features/finance/lib/' | sort`

### Verificação

```bash
# evidência: adjustments-lib-tests.txt
pnpm --filter @atria/web exec vitest run src/features/finance/lib/adjustments.test.ts --reporter=verbose
pnpm --filter @atria/web exec vitest run src/features/finance/lib
pnpm --filter @atria/web exec eslint --max-warnings 0 src/features/finance/lib
pnpm --filter @atria/web exec prettier --check src/features/finance/lib
pnpm --filter @atria/web typecheck
```

Resultado esperado: os 17 casos de `adjustments.test.ts` com `✓` e a linha `Tests  17 passed (17)`; os testes de `finance-period.test.ts` continuam passando; ESLint sem aviso, Prettier sem diferença e `tsc --noEmit` sem erro.

### Evidências

- `adjustments-lib-tests.txt` (automática, da verificação)
  - Prova: a biblioteca da tela calcula o líquido e o bruto equivalente com os mesmos números da tabela de casos do servidor (TASK-02), o que garante o líquido previsto ao vivo no formulário igual ao do servidor (RF-13, RNF-02, CT-11), inclusive a base digitada proporcional, o centavo residual e as recusas de validação.
  - Trecho: as linhas `✓` de `adjustments > ct01 percent on gross and fixed deduction`, `ct02 typed base and order do not change net`, `ct05 reverse scales typed base with gross`, `ct07 residual cent goes to last percent`, `ct13 invalid items are refused` e a linha `Tests  17 passed (17)`.
  - Falha: `×`, `FAIL`, `failed` na linha `Tests`, `No test files found` ou um caso com valor esperado e obtido diferentes (por exemplo `expected 188710 to be 188709`).
  - Espera: `17 passed`
