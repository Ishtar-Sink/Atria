### Baseline

- `pnpm --filter @atria/web exec vitest run src/features/finance/screens/transactions-screens.test.tsx src/features/finance/hooks/use-recurring-transactions.test.tsx --reporter=verbose 2>&1 | grep -E '^\s*(✓|×|↓)' | sed -E 's/ [0-9]+ms$//' | grep -v -E '> (rf01|rf02|rf04|ct01|ct03) ' | grep -v 'deletes a settled copy and explains the occurrence reopens' | sort`
- `pnpm --filter @atria/web exec vitest run src/features/finance/screens/transactions-screens.test.tsx --reporter=verbose 2>&1 | grep -E '^\s*(✓|×|↓)' | sed -E 's/ [0-9]+ms$//' | grep 'deletes a settled copy and explains the occurrence reopens'` (muda): a cópia liquidada deixa de oferecer "Excluir" (RF-04); o teste sai e o comportamento novo fica em `rf04 offers undo instead of delete on a settled copy`.
- `pnpm --filter @atria/web exec eslint --max-warnings 0 src/features/finance/screens/recurrence-detail-screen.tsx src/features/finance/screens/transaction-detail-screen.tsx src/features/finance/hooks/use-recurring-transactions.ts src/features/finance/hooks/use-recurring-transactions.test.tsx src/features/finance/screens/transactions-screens.test.tsx src/features/finance/finance.e2e.ts`
- `pnpm --filter @atria/web exec prettier --check src/features/finance/screens/recurrence-detail-screen.tsx src/features/finance/screens/transaction-detail-screen.tsx src/features/finance/hooks/use-recurring-transactions.ts src/features/finance/hooks/use-recurring-transactions.test.tsx src/features/finance/screens/transactions-screens.test.tsx src/features/finance/finance.e2e.ts src/features/finance/i18n/pt-br.json scripts/evidence-finance.mjs 2>&1 | tail -1`
- `node --check apps/web/scripts/evidence-finance.mjs && echo sintaxe-ok`
- `pnpm --filter @atria/web exec tsc --noEmit --pretty false 2>&1 | grep -E '^src/features/finance/(screens/(recurrence-detail|transaction-detail)-screen|hooks/use-recurring-transactions|finance\.e2e)' | sort`
- `pnpm --filter @atria/web exec playwright test --list src/features/finance/finance.e2e.ts 2>&1 | grep '›' | sed -E 's/:[0-9]+:[0-9]+ ›/ ›/' | grep -v -E 'ct01 |ct03 ' | sort`

### Verificação

```bash
# Testes de tela e de hook da recorrência e do detalhe da movimentação (Vitest + Testing Library + axe)
# evidência: recorrencia-testes.txt
pnpm --filter @atria/web exec vitest run src/features/finance/screens/recurrence-detail-screen.test.tsx src/features/finance/hooks/use-recurring-transactions.test.tsx src/features/finance/screens/transactions-screens.test.tsx --reporter=verbose
# Lint e formatação sem nenhum erro ou warning (o script fica fora do ESLint)
pnpm --filter @atria/web exec eslint --max-warnings 0 src/features/finance/screens/recurrence-detail-screen.tsx src/features/finance/screens/recurrence-detail-screen.test.tsx src/features/finance/screens/transaction-detail-screen.tsx src/features/finance/hooks/use-recurring-transactions.ts src/features/finance/hooks/use-recurring-transactions.test.tsx src/features/finance/screens/transactions-screens.test.tsx src/features/finance/finance.e2e.ts
pnpm --filter @atria/web exec prettier --check src/features/finance/screens/recurrence-detail-screen.tsx src/features/finance/screens/recurrence-detail-screen.test.tsx src/features/finance/screens/transaction-detail-screen.tsx src/features/finance/hooks/use-recurring-transactions.ts src/features/finance/hooks/use-recurring-transactions.test.tsx src/features/finance/screens/transactions-screens.test.tsx src/features/finance/finance.e2e.ts src/features/finance/i18n/pt-br.json scripts/evidence-finance.mjs
node --check apps/web/scripts/evidence-finance.mjs
# Nenhum erro de tipo nos arquivos da tarefa (o typecheck do app inteiro depende das TASK-13 e TASK-14)
test "$(pnpm --filter @atria/web exec tsc --noEmit --pretty false 2>&1 | grep -cE '^src/features/finance/(screens/(recurrence-detail|transaction-detail)-screen|hooks/use-recurring-transactions|finance\.e2e)')" -eq 0
# e2e do CT-01 e do CT-03 escritos e compilando (rodam contra o servidor real na integração)
# evidência: recorrencia-e2e-list.txt
pnpm --filter @atria/web exec playwright test --list src/features/finance/finance.e2e.ts
```

### Evidências

- `recorrencia-testes.txt` (automática, da verificação)
  - Prova: a recorrência é excluída pelo "Mais ações" depois da confirmação, sem liquidar antes; a ocorrência aberta e a previsão somem das listas na hora, as cópias liquidadas continuam no histórico e o saldo não muda; a recusa do servidor desfaz a mudança com aviso; a cópia liquidada oferece "Desfazer liquidação" no lugar de "Excluir", com a confirmação que explica que o valor volta ao saldo e a ocorrência reabre; sem violações no axe (RF-01, RF-02, RF-03, RF-04, CT-01, CT-03, [project/frontend-18]).
  - Trecho: as linhas `✓` de `rf01 deletes a recurrence from more actions after confirmation`, `rf01 keeps the recurrence when the deletion is cancelled`, `ct01 keeps the settled copies in the history after deleting the recurrence`, `rf04 offers undo instead of delete on a settled copy`, `ct03 undoing a settled copy explains the reopening and reopens the occurrence`, `rf02 removes the open occurrence and the forecast from the lists optimistically`, `ct01 keeps the settled copies and the balance when deleting` e `rf01 rolls back and warns when the recurrence delete is refused`, e a linha `Tests` sem falhas.
  - Falha: `×`, `FAIL`, `failed` na linha `Tests`, `No test files found` ou algum desses nomes ausente.
  - Requer: `apps/web/src/features/finance/screens/recurrence-detail-screen.test.tsx`
  - Espera: `ct03 undoing a settled copy explains the reopening and reopens the occurrence`
- `recorrencia-e2e-list.txt` (automática, da verificação)
  - Prova: os e2e do CT-01 e do CT-03 estão escritos e compilam; contra o servidor real (integração), excluem uma recorrência liquidada mantendo a cópia no histórico e desfazem a cópia reabrindo a ocorrência (CT-01, CT-03).
  - Trecho: as linhas com `ct01 deleting a recurrence keeps the settled copies` e `ct03 undoing a settled copy reopens the occurrence`.
  - Falha: erro de compilação, `Error:` ou algum dos dois casos ausente.
  - Espera: `ct01 deleting a recurrence keeps the settled copies`
- `finance-recorrencia.webm` (print): `node apps/web/scripts/evidence-finance.mjs recorrencia`
  - Prova: no Chromium, com a API simulada, a cópia liquidada só com "Desfazer liquidação", a confirmação que explica a reabertura, a ocorrência de 30/09 reaberta, a exclusão da recorrência pelo "Mais ações" com a confirmação e, em Saídas, a cópia de agosto ainda no histórico sem ocorrência aberta nem previsão; as checagens dos diálogos nos temas claro e escuro, em desktop e em 360 px (RF-01, RF-02, RF-03, RF-04, CT-01, CT-03, PD-14, RNF-02).
  - Trecho: uma linha `ok` por conferência dos cenários `recorrencia` em cada tema e largura (incluindo axe sem violações e sem rolagem horizontal), as linhas `ok` de `vídeo: ocorrência de 30/09 reaberta`, `vídeo: aviso de recorrência excluída`, `vídeo: cópia de agosto no histórico` e `vídeo: sem ocorrência aberta nem previsão do Aluguel`, a linha `video:` com `finance-recorrencia.webm` e a última linha `ok  0 falha(s)`; no vídeo, o cursor visível percorrendo o desfazer com o diálogo e a exclusão com o diálogo.
  - Falha: alguma linha `FALHA`, `Evidência desconhecida`, a ausência da linha `video:`, código de saída diferente de 0, ou no vídeo um "Excluir" na cópia liquidada, a ocorrência aberta do Aluguel depois da exclusão ou a cópia de agosto ausente.
  - Espera: `0 falha(s)`
