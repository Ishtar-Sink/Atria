### Baseline

- `pnpm --filter @atria/web exec vitest run src/features/finance/screens/transactions-screens src/features/reports src/shared/i18n --reporter=verbose 2>&1 | grep -E '^\s*(✓|×|↓)' | grep -v -E '> (ct15|cb10) ' | sed -E 's/ [0-9]+ms$//' | sort`
- `pnpm --filter @atria/web exec eslint src/features/finance/screens/transactions-screen.tsx src/features/finance/screens/transactions-screens.test.tsx src/features/reports/report-filters.tsx src/features/reports/report-page.test.tsx src/features/reports/reports.e2e.ts --max-warnings 0`
- `pnpm --filter @atria/web exec prettier --check src/features/finance/screens/transactions-screen.tsx src/features/finance/screens/transactions-screens.test.tsx src/features/reports/report-filters.tsx src/features/reports/report-page.test.tsx src/features/reports/reports.e2e.ts src/shared/i18n/pt-br.json`
- `pnpm --filter @atria/web typecheck`
- `pnpm --filter @atria/web exec playwright test --list src/features/reports/reports.e2e.ts --project=desktop 2>&1 | grep '›' | grep -v 'ct15 ' | sed -E 's/:[0-9]+:[0-9]+//' | sort`

### Verificação

```bash
# evidência: filtro-categoria-tests.txt
pnpm --filter @atria/web exec vitest run src/features/finance/screens/transactions-screens src/features/reports --reporter=verbose
pnpm --filter @atria/web exec vitest run src/shared/i18n
pnpm --filter @atria/web typecheck
pnpm --filter @atria/web exec eslint src/features/finance/screens/transactions-screen.tsx src/features/finance/screens/transactions-screens.test.tsx src/features/reports/report-filters.tsx src/features/reports/report-page.test.tsx src/features/reports/reports.e2e.ts --max-warnings 0
pnpm --filter @atria/web exec prettier --check src/features/finance/screens/transactions-screen.tsx src/features/finance/screens/transactions-screens.test.tsx src/features/reports/report-filters.tsx src/features/reports/report-page.test.tsx src/features/reports/reports.e2e.ts src/shared/i18n/pt-br.json
# evidência: filtro-categoria-e2e-list.txt
pnpm --filter @atria/web exec playwright test --list src/features/reports/reports.e2e.ts --project=desktop
```

Resultado esperado: código 0; no primeiro comando, as linhas `✓` de `transactions-screens.test.tsx` e `report-page.test.tsx`, inclusive os casos `ct15` e `cb10`, e nenhuma `×`; no último, os casos `ct15 filters the category by typing and picks it with the keyboard` em `relatorios em 360` e `relatorios em desktop` e `ct15 records the category filter video`.

### Evidências

- `filtro-categoria-tests.txt` (automática, da verificação)
  - Prova: em Entradas, Saídas e Gastos por categoria, o filtro de categoria é o autocomplete: a lista filtra ao digitar, as setas e o Enter escolhem uma só categoria, que vai para a URL e para a consulta, e a busca sem resultado mostra "Nenhuma categoria encontrada" mantendo o filtro anterior; os testes antigos dos filtros continuam passando (RF-22, CT-15, CB-10).
  - Trecho: `✓ src/features/finance/screens/transactions-screens.test.tsx > ... > ct15 filters the category by typing and picks it with the keyboard`, `cb10 keeps the previous category when nothing matches`, `filters by repetition chips, account and category through the url`, `✓ src/features/reports/report-page.test.tsx > ... > ct15 picks the report category by typing and the keyboard`, `cb10 keeps the report category when nothing matches` e `shows the filters of each report`.
  - Falha: uma linha `×`, `FAIL` ou `No test files found`.
- `filtro-categoria-e2e-list.txt` (automática, da verificação)
  - Prova: o e2e do filtro de categoria em Saídas e no relatório existe e compila, em 360 px e em desktop, com o caso do vídeo (CT-15, RNF-05).
  - Trecho: as linhas `relatorios em 360 › ct15 filters the category by typing and picks it with the keyboard`, `relatorios em desktop › ct15 filters the category by typing and picks it with the keyboard` e `ct15 records the category filter video`.
  - Falha: erro de compilação, `Error:` ou um dos casos ausente.
- `filtro-categoria-e2e.txt` (automática): `pnpm --filter @atria/web exec playwright test src/features/reports/reports.e2e.ts --project=desktop`
  - Prova: no build real, com o servidor, em 360 px e em desktop, a pessoa filtra Saídas e o relatório Gastos por categoria digitando e escolhendo pelo teclado, a busca sem resultado mantém o filtro, a lista cabe na tela e o axe não acha violações; os demais fluxos de Relatórios continuam passando (CT-15, CB-10, RNF-05).
  - Trecho: `12 passed` e `1 skipped` (o vídeo, sem `ATRIA_E2E_VIDEO`).
  - Falha: `failed`, `Timed out`, `No tests found` ou menos de 12 aprovados.
  - Tempo-limite: 600
- `filtro-categoria.png` (print): `ATRIA_E2E_SHOT="$VOSTOK_EVIDENCE/filtro-categoria.png" pnpm --filter @atria/web exec playwright test src/features/reports/reports.e2e.ts --project=desktop -g 'relatorios em desktop ct15 filters'`
  - Prova: em Saídas, no tema claro, o filtro de categoria ao lado de Conta mostra a lista filtrada pelo que foi digitado, com a mesma altura e o mesmo visual dos outros filtros (RF-22, CT-15).
  - Trecho: na imagem, o grupo Filtros com Recorrência, Conta e Categoria alinhados, a letra `m` no campo e a lista com Moradia e Mercado; na saída, `1 passed`.
  - Falha: o campo desalinhado dos outros filtros, a lista cortada ou com outras categorias, ou a saída com `failed`.
  - Tempo-limite: 600
- `filtro-categoria.webm` (print): `ATRIA_E2E_VIDEO="$VOSTOK_EVIDENCE/filtro-categoria.webm" pnpm --filter @atria/web exec playwright test src/features/reports/reports.e2e.ts --project=desktop -g 'ct15 records'`
  - Prova: no Chromium, em 1280x800 e tema claro, com o cursor visível, a pessoa digita no filtro de categoria de Saídas e do relatório, escolhe pelas setas e Enter, vê "Nenhuma categoria encontrada" numa busca sem resultado, fecha com Esc mantendo a categoria e gera o relatório filtrado (CT-15, CB-10, RF-22).
  - Trecho: na saída, `1 passed`; no vídeo, o marcador do cursor, a lista encolhendo a cada letra, a lista de Saídas atualizada depois do Enter, a mensagem sem resultado e o relatório gerado com Saúde.
  - Falha: `failed` ou `skipped`, ou no vídeo a lista sem filtrar, o filtro trocado depois do Esc ou o cursor invisível.
  - Tempo-limite: 600
